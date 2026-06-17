import { Request } from "express";
import CustomError from "../../helpers/CustomError";
import { deleteCloudinary, uploadCloudinary } from "../../helpers/cloudinary";
import { paginationHelper } from "../../utils/pagination";
import { ContactStatus, ContactType, CreateContactPayload, UpdateContactPayload } from "./contact.interface";
import { contactModel } from "./contact.models";
import { userModel } from "../usersAuth/user.models";
import { role } from "../usersAuth/user.interface";

const deleteCloudinaryQuietly = async (publicId?: string): Promise<void> => {
  if (!publicId) return;

  try {
    await deleteCloudinary(publicId);
  } catch (error) {
    console.error(`[Cloudinary] Failed to delete ${publicId}:`, error);
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
        ...(photo ? { photo } : {}),
        ...(location ? { location } : {}),
      });
    } catch (error) {
      await deleteCloudinaryQuietly(photo?.public_id);
      throw error;
    }
  },

  async getAllContacts(req: Request) {
    const {
      page: pagebody,
      limit: limitbody,
      type,
      search,
      city,
      country,
      from,
      to,
      sort,
      sortBy,
      latitude,
      longitude,
      radius, // in km
      status: queryStatus,
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
    if (city) filter.city = { $regex: city, $options: "i" };
    if (country) filter.country = { $regex: country, $options: "i" };
    if (status && status !== "all") filter.status = status;
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
      if (latitude && longitude) {
        const rad = Number(radius) || 10;
        userFilter.location = {
          $geoWithin: { $centerSphere: [[Number(longitude), Number(latitude)], rad / 6371] },
        };
      }
      
      // Apply city and country filters to the address field for partners
      if (city || country) {
        const andConditions: any[] = [];
        if (city) andConditions.push({ address: { $regex: city as string, $options: "i" } });
        if (country) andConditions.push({ address: { $regex: country as string, $options: "i" } });
        
        if (userFilter.$and) {
          userFilter.$and.push(...andConditions);
        } else {
          userFilter.$and = andConditions;
        }
      }

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
        name: `${user.firstName} ${user.lastName}`,
        type: ContactType.PARTNER,
        address: user.address,
        phone: user.phone,
        email: user.email,
        photo: user.profileImage,
        location: user.location,
        status: user.status,
        company: user.company,
        website: user.website,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
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
      
      // Apply city and country filters to the address field for partners
      if (city || country) {
        const andConditions: any[] = [];
        if (city) andConditions.push({ address: { $regex: city as string, $options: "i" } });
        if (country) andConditions.push({ address: { $regex: country as string, $options: "i" } });
        
        if (userFilter.$and) {
          userFilter.$and.push(...andConditions);
        } else {
          userFilter.$and = andConditions;
        }
      }

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

      const pipeline: any[] = [
        { $match: filter },
        {
          $project: {
            _id: 1,
            name: 1,
            type: 1,
            address: 1,
            phone: 1,
            email: 1,
            photo: 1,
            location: 1,
            status: 1,
            company: 1,
            website: 1,
            city: 1,
            country: 1,
            description: 1,
            createdAt: 1,
            updatedAt: 1,
            sortFieldVal: sortField === "createdAt" ? "$createdAt" : { $ifNull: [`$${sortField}`, ""] }
          }
        },
        {
          $unionWith: {
            coll: "users",
            pipeline: [
              { $match: userFilter },
              {
                $project: {
                  _id: 1,
                  name: { $concat: ["$firstName", " ", "$lastName"] },
                  type: { $literal: "partner" },
                  address: 1,
                  phone: 1,
                  email: 1,
                  photo: "$profileImage",
                  location: 1,
                  status: 1,
                  company: 1,
                  website: 1,
                  city: 1,
                  country: 1,
                  description: 1,
                  createdAt: 1,
                  updatedAt: 1,
                  sortFieldVal: sortField === "name" 
                    ? { $concat: ["$firstName", " ", "$lastName"] } 
                    : (sortField === "createdAt" ? "$createdAt" : { $ifNull: [`$${sortField}`, ""] })
                }
              }
            ]
          }
        },
        { $sort: { sortFieldVal: sortOrder, _id: 1 } },
        {
          $facet: {
            metadata: [{ $count: "total" }],
            data: [{ $skip: skip }, { $limit: limit }]
          }
        }
      ];

      const aggResult = await contactModel.aggregate(pipeline);
      const allContacts = aggResult[0]?.data || [];
      totalCount = aggResult[0]?.metadata[0]?.total || 0;
      
      combinedContacts = allContacts.map((c: any) => {
        delete c.sortFieldVal;
        return c;
      });
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
      latitude,
      longitude,
      radius,
      status: queryStatus,
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
        name: `${user.firstName} ${user.lastName}`,
        type: ContactType.PARTNER,
        address: user.address,
        phone: user.phone,
        email: user.email,
        photo: user.profileImage,
        location: user.location,
        status: user.status,
        company: user.company,
        website: user.website,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
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
            csrf: { $sum: { $cond: [{ $eq: ["$type", ContactType.CSRF] }, 1, 0] } },
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

    const s = standardStats[0] || { total: 0, active: 0, shelter: 0, vet: 0, csrf: 0 };
    const p = partnerStats[0] || { total: 0, active: 0 };

    return {
      all: s.total + p.total,
      active: s.active + p.active,
      shelter: s.shelter,
      vet: s.vet,
      csrf: s.csrf,
      partner: p.total,
    };
  },
};
