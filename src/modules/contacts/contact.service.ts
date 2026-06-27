import { Request } from "express";
import CustomError from "../../helpers/CustomError";
import { deleteCloudinary, uploadCloudinary } from "../../helpers/cloudinary";
import { paginationHelper } from "../../utils/pagination";
import { ContactStatus, ContactType, CreateContactPayload, UpdateContactPayload } from "./contact.interface";
import { contactModel } from "./contact.models";
import { userModel } from "../usersAuth/user.models";
import { role } from "../usersAuth/user.interface";
import * as xlsx from "xlsx";
import * as fs from "fs";

const deleteCloudinaryQuietly = async (publicId?: string): Promise<void> => {
  if (!publicId) return;

  try {
    await deleteCloudinary(publicId);
  } catch (error) {
    console.error(`[Cloudinary] Failed to delete ${publicId}:`, error);
  }
};

const applyLocationFilters = (filter: any, params: { city?: any, country?: any, region?: any, department?: any }, isPartner: boolean = false) => {
  const { city, country, region, department } = params;
  const andConditions: any[] = [];

  if (city) {
    if (isPartner) andConditions.push({ address: { $regex: `\\b${city}\\b`, $options: "i" } });
    else filter.city = { $regex: city, $options: "i" };
  }
  if (country) {
    if (isPartner) andConditions.push({ address: { $regex: `\\b${country}\\b`, $options: "i" } });
    else filter.country = { $regex: country, $options: "i" };
  }

  if (region && region !== "all") {
    andConditions.push({
      $or: [
        { region: { $regex: `\\b${region}\\b`, $options: "i" } },
        { address: { $regex: `\\b${region}\\b`, $options: "i" } }
      ]
    });
  }
  if (department && department !== "all") {
    andConditions.push({
      $or: [
        { department: { $regex: `\\b${department}\\b`, $options: "i" } },
        { address: { $regex: `\\b${department}\\b`, $options: "i" } }
      ]
    });
  }

  if (andConditions.length > 0) {
    filter.$and = filter.$and ? [...filter.$and, ...andConditions] : andConditions;
  }
};

export const contactService = {
  async createContact(req: Request) {
    const data = req.body as CreateContactPayload;
    const { latitude, longitude, ...rest } = data;
    const image = req.file;
    let photo;

    if (image) {
      photo = await uploadCloudinary(image.path);
    }

    let location;
    if (latitude !== undefined && longitude !== undefined) {
      location = {
        type: "Point",
        coordinates: [Number(longitude), Number(latitude)],
      };
    }

    try {
      return await contactModel.create({
        ...rest,
        creationMethod: "manual", // Explicitly set to manual
        ...(photo ? { photo } : {}),
        ...(location ? { location } : {}),
      });
    } catch (error) {
      await deleteCloudinaryQuietly(photo?.public_id);
      throw error;
    }
  },

  async bulkUploadContacts(req: Request) {
    const file = req.file;
    if (!file) throw new CustomError(400, "No file uploaded");

    const workbook = xlsx.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new CustomError(400, "The uploaded Excel file is empty");
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new CustomError(400, "The requested sheet could not be found");
    const rows = xlsx.utils.sheet_to_json<any>(sheet);

    // Default processing results
    const result = {
      total: rows.length,
      success: 0,
      failed: 0,
      pending: 0, // In synchronous upload, pending might be 0, but included for API structure
      errors: [] as string[],
    };

    const contactsToInsert: any[] = [];
    
    // Fetch existing identifiers for fast duplicate checking
    const existingContacts = await contactModel.find({}, { name: 1, email: 1 }).lean();
    const existingNames = new Set(existingContacts.map(c => c.name?.toLowerCase().trim()));
    const existingEmails = new Set(existingContacts.map(c => c.email?.toLowerCase().trim()).filter(Boolean));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Map excel columns to model fields
        // We do basic normalization of column names (lowercase, remove spaces)
        const getVal = (keys: string[]) => {
          for (const key of Object.keys(row)) {
            const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
            for (const expected of keys) {
              if (normalizedKey === expected) return row[key]?.toString().trim();
            }
          }
          return undefined;
        };

        const name = getVal(["name", "company", "nom", "clinicname", "veterinaryclinic"]);
        const email = getVal(["email", "mail", "courriel"]);
        const phone = getVal(["phone", "phonenumber", "telephone", "tel", "contactnumber"]);
        const address = getVal(["address", "adresse", "location"]);
        let city = getVal(["city", "ville", "town"]) || "";
        const country = getVal(["country", "pays"]);
        const region = getVal(["region", "province", "state"]);
        const website = getVal(["website", "site", "url"]);
        const description = getVal(["description", "notes", "about"]);
        let department = getVal(["department", "departement"]);
        
        let zipCode = getVal(["zipcode", "zip", "postalcode", "codepostal"]);

        // If city starts with 5 digits (like "78860 Saint-Nom-la-Bretèche"), extract it
        const cityMatch = city.match(/^(\d{5})\s+(.*)$/);
        if (cityMatch) {
            if (!zipCode) zipCode = cityMatch[1];
            city = cityMatch[2]; // Leave only the city name
        }
        
        // We will default to extracting the whole zip code into the address if it exists, and using the first 2 chars for department if department is missing.
        if (zipCode && !department && zipCode.length >= 2) {
            department = zipCode.substring(0, 2);
        }

        let typeStr = getVal(["type", "category", "contacttype", "role"]);
        let type = ContactType.VETERINARIAN; // Default to veterinarian based on file name "veterinary clinics"
        
        if (typeStr) {
          typeStr = typeStr.toLowerCase();
          if (typeStr.includes("shelter")) type = ContactType.SHELTER;
          else if (typeStr.includes("csfs") || typeStr.includes("csrf")) type = ContactType.CSFS;
          else if (typeStr.includes("partner")) type = ContactType.PARTNER;
          else type = ContactType.VETERINARIAN;
        }

        if (!name) {
          result.failed++;
          result.errors.push(`Row ${i + 2}: Missing name`);
          continue;
        }

        const normalizedName = name.toLowerCase().trim();
        const normalizedEmail = email?.toLowerCase().trim();

        // Check for duplicates
        if (existingNames.has(normalizedName) || (normalizedEmail && existingEmails.has(normalizedEmail))) {
          result.pending++; // Consider duplicates as "Skipped" / Pending
          continue;
        }

        // Register to prevent duplicates within the same file
        existingNames.add(normalizedName);
        if (normalizedEmail) existingEmails.add(normalizedEmail);

        let fullAddress = address || "";
        if (zipCode && !fullAddress.includes(zipCode)) {
           fullAddress = fullAddress ? `${fullAddress}, ${zipCode}` : zipCode;
        }

        contactsToInsert.push({
          name,
          type,
          email,
          phone,
          address: fullAddress,
          city,
          country,
          region,
          department,
          website,
          description,
          creationMethod: "bulk",
          status: ContactStatus.ACTIVE,
        });

      } catch (error: any) {
        result.failed++;
        result.errors.push(`Row ${i + 2}: ${error.message}`);
      }
    }

    if (contactsToInsert.length > 0) {
      try {
        await contactModel.insertMany(contactsToInsert, { ordered: false });
        result.success = contactsToInsert.length;
      } catch (error: any) {
        // If there is a bulk write error, we can extract details
        if (error.writeErrors) {
           result.success = contactsToInsert.length - error.writeErrors.length;
           result.failed += error.writeErrors.length;
           error.writeErrors.forEach((e: any) => result.errors.push(`Bulk Insert Error: ${e.errmsg}`));
        } else {
           throw error;
        }
      }
    }

    // Cleanup the uploaded file
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    return result;
  },

  async getAllContacts(req: Request) {
    const {
      page: pagebody,
      limit: limitbody,
      type,
      search,
      city,
      country,
      region,
      department,
      from,
      to,
      sort,
      sortBy,
      latitude,
      longitude,
      radius, // in km
      status: queryStatus,
      creationMethod,
    } = req.query;

    const isAdmin = req.user?.role === role.ADMIN;
    const status = isAdmin ? (queryStatus || ContactStatus.ACTIVE) : ContactStatus.ACTIVE;

    const { page, limit, skip } = paginationHelper(
      pagebody as string,
      limitbody as string,
    );
    const filter: any = {};

    // Standard contactModel logic
    if (type && type !== "all" && type !== ContactType.PARTNER && type !== "partners") {
      filter.type = type;
    }
    applyLocationFilters(filter, { city, country, region, department });
    if (status && status !== "all") filter.status = status;
    if (creationMethod && creationMethod !== "all") {
      if (creationMethod === "manual") {
        filter.$and = filter.$and || [];
        filter.$and.push({ $or: [{ creationMethod: "manual" }, { creationMethod: { $exists: false } }] });
      } else {
        filter.creationMethod = creationMethod;
      }
    }
    if (search) {
      const searchRegex = new RegExp(search as string, "i");
      filter.$or = [
        { name: searchRegex },
        { address: searchRegex },
      ];
    }

    if (from || to) {
      const isValidDate = (date: any) => {
        const parsedDate = new Date(date);
        return !Number.isNaN(parsedDate.getTime());
      };

      if (from && !isValidDate(from)) {
        throw new CustomError(400, "Invalid 'from' date. Format must be YYYY-MM-DD or ISO");
      }
      if (to && !isValidDate(to)) {
        throw new CustomError(400, "Invalid 'to' date. Format must be YYYY-MM-DD or ISO");
      }
      if (from && to && new Date(from as string) > new Date(to as string)) {
        throw new CustomError(400, "'from' date cannot be greater than 'to' date");
      }

      filter.createdAt = {};
      if (from) {
        const fromDate = new Date(from as string);
        fromDate.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to as string);
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }

    // Geospatial filter
    if (latitude && longitude) {
      const rad = Number(radius) || 10;
      filter.location = {
        $geoWithin: {
          $centerSphere: [[Number(longitude), Number(latitude)], rad / 6371],
        },
      };
    }

    const sortFields: Record<string, string> = {
      name: "name",
      date: "createdAt",
      city: "city",
      country: "country",
    };
    const sortByValue = typeof sortBy === "string" ? sortBy : "name";
    const sortField = sortFields[sortByValue.toLowerCase()] || "name";
    const sortOrder = sort === "descending" ? -1 : 1;

    // Logic for fetching partners if needed
    const shouldFetchPartners = !type || type === "all" || type === ContactType.PARTNER || type === "partners";
    const shouldFetchStandardContacts = !type || type === "all" || (type !== ContactType.PARTNER && type !== "partners");

    let combinedContacts: any[] = [];
    let totalCount = 0;

    if (shouldFetchPartners && !shouldFetchStandardContacts) {
      // ONLY partners (existing logic)
      const userFilter: any = { role: role.PARTNERS };
      if (status && status !== "all") userFilter.status = status;
      if (creationMethod === "bulk") userFilter._id = null;
      if (latitude && longitude) {
        const rad = Number(radius) || 10;
        userFilter.location = {
          $geoWithin: { $centerSphere: [[Number(longitude), Number(latitude)], rad / 6371] },
        };
      }
      
      // Apply city, country, region, and department filters to the address field for partners
      applyLocationFilters(userFilter, { city, country, region, department }, true);

      if (search) {
        const searchRegex = new RegExp(search as string, "i");
        userFilter.$or = [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { address: searchRegex },
          { company: searchRegex },
        ];
      }

      const [users, total] = await Promise.all([
        userModel.find(userFilter).sort({ createdAt: sortOrder }).skip(skip).limit(limit).lean(),
        userModel.countDocuments(userFilter),
      ]);

      combinedContacts = users.map((user: any) => ({
        _id: user._id,
        name: user.company && user.company.trim() !== "" ? user.company : `${user.firstName} ${user.lastName}`,
        type: ContactType.PARTNER,
        address: user.address,
        phone: user.phone,
        email: user.email,
        photo: (user.profileImage && user.profileImage.secure_url) ? user.profileImage : (user.logo && user.logo.secure_url) ? user.logo : null,
        location: user.location,
        status: user.status,
        company: user.company,
        website: user.website,
        description: user.description,
        facebook: user.facebook,
        instagram: user.instagram,
        twitter: user.twitter,
        linkedin: user.linkedin,
        postalCode: user.postalCode,
        city: user.city,
        country: user.country,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        creationMethod: "manual",
      }));
      totalCount = total;
    } else if (shouldFetchStandardContacts && !shouldFetchPartners) {
      // ONLY standard contacts (existing logic)
      const [contacts, total] = await Promise.all([
        contactModel.find(filter).sort({ [sortField]: sortOrder }).skip(skip).limit(limit).lean(),
        contactModel.countDocuments(filter),
      ]);
      combinedContacts = contacts;
      totalCount = total;
    } else {
      // BOTH - Merge case (when type is "all" or undefined)
      // For simplicity and to support pagination/sorting correctly across two collections,
      // we'll fetch both and merge. In a large dataset, this would need a different approach (like a unified view or shared collection).
      
      const userFilter: any = { role: role.PARTNERS };
      if (status && status !== "all") userFilter.status = status;
      if (creationMethod === "bulk") userFilter._id = null;
      
      // Apply city, country, region, and department filters to the address field for partners
      applyLocationFilters(userFilter, { city, country, region, department }, true);

      if (search) {
        const searchRegex = new RegExp(search as string, "i");
        userFilter.$or = [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { address: searchRegex },
          { company: searchRegex },
        ];
      }

      const [users, contacts] = await Promise.all([
        userModel.find(userFilter).lean(),
        contactModel.find(filter).lean(),
      ]);

      const mappedUsers = users.map((user: any) => ({
        _id: user._id,
        name: user.company && user.company.trim() !== "" ? user.company : `${user.firstName} ${user.lastName}`,
        type: ContactType.PARTNER,
        address: user.address,
        phone: user.phone,
        email: user.email,
        photo: (user.profileImage && user.profileImage.secure_url) ? user.profileImage : (user.logo && user.logo.secure_url) ? user.logo : null,
        location: user.location,
        status: user.status,
        company: user.company,
        website: user.website,
        description: user.description,
        facebook: user.facebook,
        instagram: user.instagram,
        twitter: user.twitter,
        linkedin: user.linkedin,
        postalCode: user.postalCode,
        city: user.city,
        country: user.country,
        region: user.region,
        department: user.department,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        creationMethod: "manual",
      }));

      const allMerged = [...contacts, ...mappedUsers];
      
      // Sort in memory
      allMerged.sort((a: any, b: any) => {
        let valA = a[sortField] || "";
        let valB = b[sortField] || "";
        
        if (sortField === "name" && a.type === ContactType.PARTNER) {
          valA = a.company && a.company.trim() !== "" ? a.company : `${a.firstName} ${a.lastName}`;
        }
        if (sortField === "name" && b.type === ContactType.PARTNER) {
          valB = b.company && b.company.trim() !== "" ? b.company : `${b.firstName} ${b.lastName}`;
        }

        if (typeof valA === "string" && typeof valB === "string") {
          return sortOrder === 1 ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (valA < valB) return sortOrder === 1 ? -1 : 1;
        if (valA > valB) return sortOrder === 1 ? 1 : -1;
        return 0;
      });

      totalCount = allMerged.length;
      combinedContacts = allMerged.slice(skip, skip + limit);
    }

    return {
      contacts: combinedContacts,
      meta: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  },

  async getByContactType(req: Request) {
    const { contactType } = req.params;
    const {
      page: pagebody,
      limit: limitbody,
      search,
      region,
      department,
      latitude,
      longitude,
      radius,
      status: queryStatus,
      creationMethod,
    } = req.query;

    const isAdmin = req.user?.role === role.ADMIN;
    const status = isAdmin ? (queryStatus || ContactStatus.ACTIVE) : ContactStatus.ACTIVE;

    const { page, limit, skip } = paginationHelper(
      pagebody as string,
      limitbody as string,
    );

    if (contactType === ContactType.PARTNER || contactType === "partners") {
      const filter: any = { role: role.PARTNERS };
      if (status && status !== "all") {
        filter.status = status;
      }
      if (creationMethod === "bulk") {
        filter._id = null;
      }
      if (latitude && longitude) {
        const rad = Number(radius) || 10;
        filter.location = {
          $geoWithin: {
            $centerSphere: [[Number(longitude), Number(latitude)], rad / 6371],
          },
        };
      }
      applyLocationFilters(filter, { region, department }, true);

      if (search) {
        const searchRegex = new RegExp(search as string, "i");
        filter.$or = [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { address: searchRegex },
          { company: searchRegex },
        ];
      }

      const [users, total] = await Promise.all([
        userModel.find(filter).skip(skip).limit(limit).lean(),
        userModel.countDocuments(filter),
      ]);

       const mappedContacts = users.map((user: any) => ({
        _id: user._id,
        name: user.company && user.company.trim() !== "" ? user.company : `${user.firstName} ${user.lastName}`,
        type: ContactType.PARTNER,
        address: user.address,
        phone: user.phone,
        email: user.email,
        photo: user.logo || user.profileImage,
        location: user.location,
        status: user.status,
        company: user.company,
        website: user.website,
        description: user.description,
        facebook: user.facebook,
        instagram: user.instagram,
        twitter: user.twitter,
        linkedin: user.linkedin,
        postalCode: user.postalCode,
        city: user.city,
        country: user.country,
        region: user.region,
        department: user.department,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        creationMethod: "manual",
      }));

      return {
        contacts: mappedContacts,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } else {
      const filter: any = { type: contactType };
      if (status && status !== "all") filter.status = status;
      if (creationMethod && creationMethod !== "all") {
        if (creationMethod === "manual") {
          filter.$and = filter.$and || [];
          filter.$and.push({ $or: [{ creationMethod: "manual" }, { creationMethod: { $exists: false } }] });
        } else {
          filter.creationMethod = creationMethod;
        }
      }
      applyLocationFilters(filter, { region, department });

      if (latitude && longitude) {
        const rad = Number(radius) || 10;
        filter.location = {
          $geoWithin: {
            $centerSphere: [[Number(longitude), Number(latitude)], rad / 6371],
          },
        };
      }
      if (search) {
        const searchRegex = new RegExp(search as string, "i");
        filter.$or = [
          { name: searchRegex },
          { address: searchRegex },
        ];
      }

      const [contacts, total] = await Promise.all([
        contactModel.find(filter).skip(skip).limit(limit).lean(),
        contactModel.countDocuments(filter),
      ]);

      return {
        contacts,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  },

  async getContactById(contactId: string) {
    const contact = await contactModel.findById(contactId);
    if (!contact) throw new CustomError(404, "Contact not found");
    return contact;
  },

  async updateContact(req: Request) {
    const { contactId } = req.params;
    const data = req.body as UpdateContactPayload;
    const { latitude, longitude, ...rest } = data;
    const image = req.file;

    const contact = await contactModel.findById(contactId);
    if (!contact) throw new CustomError(404, "Contact not found");

    const oldPublicIdToDelete = image ? contact.photo?.public_id : undefined;
    let newPublicIdToDeleteOnFailure: string | undefined;

    Object.assign(contact, rest);

    if (latitude !== undefined && longitude !== undefined) {
      contact.location = {
        type: "Point",
        coordinates: [Number(longitude), Number(latitude)],
      };
    }

    if (image) {
      const uploaded = await uploadCloudinary(image.path);
      contact.photo = uploaded;
      newPublicIdToDeleteOnFailure = uploaded.public_id;
    }

    try {
      await contact.save();
    } catch (error) {
      await deleteCloudinaryQuietly(newPublicIdToDeleteOnFailure);
      throw error;
    }

    await deleteCloudinaryQuietly(oldPublicIdToDelete);
    return contact;
  },

  async deleteContact(contactId: string) {
    const contact = await contactModel.findById(contactId);
    if (!contact) throw new CustomError(404, "Contact not found");

    await contact.deleteOne();
    await deleteCloudinaryQuietly(contact.photo?.public_id);
    return true;
  },

  async getContactStats() {
    const [standardStats, partnerStats] = await Promise.all([
      contactModel.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ["$status", ContactStatus.ACTIVE] }, 1, 0] } },
            shelter: { $sum: { $cond: [{ $eq: ["$type", ContactType.SHELTER] }, 1, 0] } },
            vet: { $sum: { $cond: [{ $eq: ["$type", ContactType.VETERINARIAN] }, 1, 0] } },
            csfs: { $sum: { $cond: [{ $eq: ["$type", ContactType.CSFS] }, 1, 0] } },
          },
        },
      ]),
      userModel.aggregate([
        { $match: { role: role.PARTNERS } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const s = standardStats[0] || { total: 0, active: 0, shelter: 0, vet: 0, csfs: 0 };
    const p = partnerStats[0] || { total: 0, active: 0 };

    return {
      all: s.total + p.total,
      active: s.active + p.active,
      shelter: s.shelter,
      vet: s.vet,
      csfs: s.csfs,
      partner: p.total,
    };
  },
};
