import { Request } from "express";
import CustomError from "../../helpers/CustomError";
import { deleteCloudinary, uploadCloudinary } from "../../helpers/cloudinary";
import { paginationHelper } from "../../utils/pagination";
import { role } from "../usersAuth/user.interface";
import { userModel } from "../usersAuth/user.models";
import {
  CreatePartnerAdPayload,
  PartnerAdStatus,
  UpdatePartnerAdPayload,
  PartnerAdType,
} from "./partnerAd.interface";
import { partnerAdModel } from "./partnerAd.models";

const deleteCloudinaryQuietly = async (publicId?: string): Promise<void> => {
  if (!publicId) return;

  try {
    await deleteCloudinary(publicId);
  } catch (error) {
    console.error(`[Cloudinary] Failed to delete ${publicId}:`, error);
  }
};

const getPartnerAccount = async (userId?: unknown) => {
  if (!userId) throw new CustomError(401, "Unauthorized access");

  const partner = await userModel.findById(userId).select("_id role company status");
  if (!partner) throw new CustomError(404, "Partner account not found");
  if (partner.role !== role.PARTNERS && partner.role !== role.ADMIN) {
    throw new CustomError(403, "Only partners can manage partner ads");
  }
  // Admins are allowed to manage ads without a company association
  if (partner.role !== role.ADMIN && !partner.company) {
    throw new CustomError(400, "Partner account must have a company");
  }

  return partner;
};

const buildPayload = async (
  req: Request,
): Promise<CreatePartnerAdPayload & { partner: string; type: PartnerAdType; photo?: { public_id: string; secure_url: string } }> => {
  const partner = await getPartnerAccount(req.user?._id);
  const data = req.body as CreatePartnerAdPayload;
  const image = req.file;
  let photo;

  if (image) {
    photo = await uploadCloudinary(image.path);
  }

  const payload: any = {
    ...data,
    partner: partner._id.toString(),
    type: PartnerAdType.COLLECTION_POINT,
    ...(photo ? { photo } : {}),
  };

  if (data.latitude !== undefined && data.longitude !== undefined) {
    payload.location = {
      type: "Point",
      coordinates: [Number(data.longitude), Number(data.latitude)],
    };
  }

  return payload;
};

export const partnerAdService = {
  async createPartnerAd(req: Request) {
    const payload = await buildPayload(req);

    try {
      const ad = await partnerAdModel.create(payload);
      return await ad.populate("partner", "firstName lastName email profileImage company");
    } catch (error) {
      await deleteCloudinaryQuietly(payload.photo?.public_id);
      throw error;
    }
  },

  async getAllPartnerAds(req: Request) {
    const {
      page: pagebody,
      limit: limitbody,
      search,
      company,
      from,
      to,
      sort,
      sortBy,
      status = PartnerAdStatus.ACTIVE,
      lat,
      lng,
      radius, // in km, defaults to 5 km when lat/lng provided
    } = req.query;

    const { page, limit, skip } = paginationHelper(pagebody as string, limitbody as string);
    const filter: any = {};
    const companyQuery = typeof company === "string" && company.trim() ? company.trim() : undefined;

    filter.type = PartnerAdType.COLLECTION_POINT;

    // Radius / geospatial filter
    const hasGeo = lat !== undefined && lng !== undefined;
    if (hasGeo) {
      const latNum = parseFloat(lat as string);
      const lngNum = parseFloat(lng as string);
      const radiusKm = radius !== undefined ? parseFloat(radius as string) : 5;

      if (isNaN(latNum) || isNaN(lngNum)) {
        throw new CustomError(400, "Invalid lat/lng values. Must be valid numbers.");
      }
      if (isNaN(radiusKm) || radiusKm <= 0) {
        throw new CustomError(400, "Invalid radius value. Must be a positive number (km).");
      }

      // Convert km to radians for $centerSphere (Earth radius = 6378.1 km)
      filter.location = {
        $geoWithin: {
          $centerSphere: [[lngNum, latNum], radiusKm / 6378.1],
        },
      };
    }

    if (companyQuery) {
      const partners = await userModel
        .find({
          role: role.PARTNERS,
          company: { $regex: companyQuery, $options: "i" },
        })
        .select("_id")
        .lean();
      filter.partner = { $in: partners.map((partner) => partner._id) };
    }
    if (status && status !== "all") filter.status = status;
    if (search) {
      const searchRegex = new RegExp(search as string, "i");
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
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

    // $geoWithin is compatible with regular sort — always apply it
    if (sort && sort !== "ascending" && sort !== "descending") {
      throw new CustomError(400, "Invalid sort value. Must be 'ascending' or 'descending'");
    }

    const sortFields: Record<string, string> = {
      name: "title",
      title: "title",
      date: "createdAt",
    };
    const sortByValue = typeof sortBy === "string" ? sortBy : "date";
    const sortField = sortFields[sortByValue.toLowerCase()] ?? null;
    if (!sortField) {
      throw new CustomError(400, `Invalid sortBy value. Must be one of: ${Object.keys(sortFields).join(", ")}`);
    }
    const sortOrder: 1 | -1 = sort === "ascending" ? 1 : -1;

    const [ads, total] = await Promise.all([
      partnerAdModel
        .find(filter)
        .select("-company")
        .populate("partner", "firstName lastName email profileImage company")
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      partnerAdModel.countDocuments(filter),
    ]);

    return {
      ads,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getMyPartnerAds(req: Request) {
    const partner = await getPartnerAccount(req.user?._id);
    return await partnerAdModel
      .find({ partner: partner._id, type: PartnerAdType.COLLECTION_POINT })
      .select("-company")
      .populate("partner", "firstName lastName email profileImage company")
      .sort({ createdAt: -1 });
  },

  async getPartnerAdById(adId: string) {
    const ad = await partnerAdModel
      .findOne({ _id: adId, type: PartnerAdType.COLLECTION_POINT })
      .select("-company")
      .populate("partner", "firstName lastName email profileImage company");
    if (!ad) throw new CustomError(404, "Partner ad not found");
    return ad;
  },

  async updatePartnerAd(req: Request) {
    const partner = await getPartnerAccount(req.user?._id);
    const adId = req.params.adId as string;
    const data = req.body as UpdatePartnerAdPayload;
    const image = req.file;

    const ad = await partnerAdModel
      .findOne({ _id: adId, type: PartnerAdType.COLLECTION_POINT })
      .select("-company");
    if (!ad) throw new CustomError(404, "Partner ad not found");
    if (ad.partner.toString() !== partner._id.toString() && partner.role !== role.ADMIN) {
      throw new CustomError(403, "You can only update your own partner ads");
    }

    const oldPublicIdToDelete = image ? ad.photo?.public_id : undefined;
    let newPublicIdToDeleteOnFailure: string | undefined;

    if (data.latitude !== undefined && data.longitude !== undefined) {
      data.location = {
        type: "Point",
        coordinates: [Number(data.longitude), Number(data.latitude)],
      };
    }

    Object.assign(ad, data);

    if (image) {
      const uploaded = await uploadCloudinary(image.path);
      ad.photo = uploaded;
      newPublicIdToDeleteOnFailure = uploaded.public_id;
    }

    try {
      await ad.save();
    } catch (error) {
      await deleteCloudinaryQuietly(newPublicIdToDeleteOnFailure);
      throw error;
    }

    await deleteCloudinaryQuietly(oldPublicIdToDelete);
    return await ad.populate("partner", "firstName lastName email profileImage company");
  },

  async deletePartnerAd(req: Request) {
    const partner = await getPartnerAccount(req.user?._id);
    const adId = req.params.adId as string;

    const ad = await partnerAdModel.findOne({ _id: adId, type: PartnerAdType.COLLECTION_POINT });
    if (!ad) throw new CustomError(404, "Partner ad not found");
    if (ad.partner.toString() !== partner._id.toString() && partner.role !== role.ADMIN) {
      throw new CustomError(403, "You can only delete your own partner ads");
    }

    await ad.deleteOne();
    await deleteCloudinaryQuietly(ad.photo?.public_id);
    return true;
  },
};
