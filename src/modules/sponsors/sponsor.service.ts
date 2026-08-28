import { sponsorModel } from "./sponsor.models";
import {
  CreateSponsorPayload,
  UpdateSponsorPayload,
  SponsorStatus,
} from "./sponsor.interface";
import { uploadCloudinary, deleteCloudinary } from "../../helpers/cloudinary";
import CustomError from "../../helpers/CustomError";
import { userModel } from "../usersAuth/user.models";
import { role } from "../usersAuth/user.interface";
import { paginationHelper } from "../../utils/pagination";

const deleteCloudinaryQuietly = async (publicId?: string): Promise<void> => {
  if (!publicId) return;
  try {
    await deleteCloudinary(publicId);
  } catch (error) {
    console.error(`[Cloudinary] Failed to delete ${publicId}:`, error);
  }
};

export const sponsorService = {
  // Get Sponsor Stats
  async getSponsorStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999,
    );

    const [
      total,
      active,
      expired,
      inactive,
      metrics,
      cmTotal,
      pmTotal,
      cmActive,
      pmActive,
      cmExpired,
      pmExpired,
    ] = await Promise.all([
      sponsorModel.countDocuments(),
      sponsorModel.countDocuments({ status: SponsorStatus.ACTIVE }),
      sponsorModel.countDocuments({ status: SponsorStatus.EXPIRED }),
      sponsorModel.countDocuments({ status: SponsorStatus.INACTIVE }),
      sponsorModel.aggregate([
        {
          $group: {
            _id: null,
            totalImpressions: { $sum: "$impressions" },
            totalClicks: { $sum: "$clicks" },
          },
        },
      ]),
      sponsorModel.countDocuments({
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      }),
      sponsorModel.countDocuments({
        createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
      }),
      sponsorModel.countDocuments({
        status: SponsorStatus.ACTIVE,
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      }),
      sponsorModel.countDocuments({
        status: SponsorStatus.ACTIVE,
        createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
      }),
      sponsorModel.countDocuments({
        status: SponsorStatus.EXPIRED,
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      }),
      sponsorModel.countDocuments({
        status: SponsorStatus.EXPIRED,
        createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
      }),
    ]);

    const calcTrend = (cm: number, pm: number) => {
      if (pm === 0) return cm > 0 ? 100 : 0;
      return Math.round(((cm - pm) / pm) * 100);
    };

    const totalImpressions = metrics[0]?.totalImpressions || 0;
    const totalClicks = metrics[0]?.totalClicks || 0;
    const avgCtr =
      totalImpressions > 0
        ? ((totalClicks / totalImpressions) * 100).toFixed(2)
        : 0;

    return {
      total,
      active,
      expired,
      inactive,
      totalImpressions,
      totalClicks,
      avgCtr,
      trends: {
        total: calcTrend(cmTotal, pmTotal),
        active: calcTrend(cmActive, pmActive),
        expired: calcTrend(cmExpired, pmExpired),
        impressions: 12, // Mocked as we don't have time-series impression data
        avgCtr: 2, // Mocked
      },
    };
  },

  // Create Sponsor
  async createSponsor(
    payload: CreateSponsorPayload,
    file?: Express.Multer.File,
  ) {
    let image: any = undefined;

    if (file) {
      try {
        image = await uploadCloudinary(file.path);
      } catch (error) {
        throw new CustomError(500, "Error uploading image");
      }
    }

    const sponsorData: any = { ...payload };
    if (image) {
      sponsorData.sponsorImage = image;
    }

    // Auto-expire logic on creation
    if (sponsorData.endDate && new Date(sponsorData.endDate) < new Date()) {
      sponsorData.status = SponsorStatus.EXPIRED;
    }

    const sponsor = await sponsorModel.create(sponsorData);
    return sponsor;
  },

  // Get All Sponsors (Admin)
  async getAllSponsors(query: any = {}) {
    // 1. Process Query Params
    const { page, limit, skip } = paginationHelper(
      query.page as string,
      query.limit as string,
    );

    const search = query.search || "";
    const status = query.status || "all";
    const sortBy = query.sortBy || "date";
    const sortOrder = query.sort === "ascending" ? 1 : -1;

    // 2. Build Filter
    const filter: any = {};
    if (status && status !== "all") {
      filter.status = status;
    }

    // 3. Handle Search
    if (search) {
      const searchRegex = new RegExp(search, "i");

      // Find matching partners
      const matchingPartners = await userModel
        .find({
          role: role.PARTNERS,
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { email: searchRegex },
            { company: searchRegex },
          ],
        })
        .select("_id");

      const partnerIds = matchingPartners.map((p) => p._id);

      filter.$or = [{ title: searchRegex }, { partner: { $in: partnerIds } }];
    }

    // 4. Handle Sorting
    let sortConfig: any = { createdAt: sortOrder };
    if (sortBy === "title") {
      sortConfig = { title: sortOrder };
    } else if (sortBy === "impressions") {
      sortConfig = { impressions: sortOrder };
    } else if (sortBy === "clicks") {
      sortConfig = { clicks: sortOrder };
    } else if (sortBy === "date") {
      sortConfig = { createdAt: sortOrder };
    }

    // 5. Execute Query
    const total = await sponsorModel.countDocuments(filter);
    const sponsors = await sponsorModel
      .find(filter)
      .populate("partner", "firstName lastName company email profileImage")
      .sort(sortConfig)
      .skip(skip)
      .limit(limit);

    // Auto-expire check when fetching
    const now = new Date();
    for (const sponsor of sponsors) {
      if (sponsor.endDate < now && sponsor.status !== SponsorStatus.EXPIRED) {
        sponsor.status = SponsorStatus.EXPIRED;
        await sponsor.save();
      }
    }

    return {
      data: sponsors,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  // Search Partners
  async searchPartners(query: string) {
    const searchRegex = new RegExp(query, "i");
    const partners = await userModel
      .find({
        role: role.PARTNERS,
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { company: searchRegex },
        ],
      })
      .select("firstName lastName company email profileImage")
      .limit(20);
    return partners;
  },

  // Get Single Sponsor
  async getSponsorById(id: string) {
    const sponsor = await sponsorModel
      .findById(id)
      .populate("partner", "firstName lastName company email profileImage");
    if (!sponsor) throw new CustomError(404, "Sponsor not found");
    return sponsor;
  },

  // Update Sponsor
  async updateSponsor(
    id: string,
    payload: UpdateSponsorPayload,
    file?: Express.Multer.File,
  ) {
    const sponsor = await sponsorModel.findById(id);
    if (!sponsor) throw new CustomError(404, "Sponsor not found");

    if (file) {
      if (sponsor.sponsorImage?.public_id) {
        await deleteCloudinaryQuietly(sponsor.sponsorImage.public_id);
      }
      try {
        const image = await uploadCloudinary(file.path);
        sponsor.sponsorImage = image;
      } catch (error) {
        throw new CustomError(500, "Error uploading image");
      }
    }

    Object.assign(sponsor, payload);

    // Auto-expire check during update
    if (sponsor.endDate < new Date()) {
      sponsor.status = SponsorStatus.EXPIRED;
    } else if (
      sponsor.status === SponsorStatus.EXPIRED &&
      sponsor.endDate >= new Date()
    ) {
      // If admin extended the date but left status as EXPIRED, they probably meant to reactivate or at least INACTIVE
      // We'll trust payload.status if provided, otherwise default to ACTIVE since it was EXPIRED before
      sponsor.status =
        payload.status && payload.status !== SponsorStatus.EXPIRED
          ? payload.status
          : SponsorStatus.ACTIVE;
    }

    await sponsor.save();
    return sponsor;
  },

  // Delete Sponsor
  async deleteSponsor(id: string) {
    const sponsor = await sponsorModel.findById(id);
    if (!sponsor) throw new CustomError(404, "Sponsor not found");

    if (sponsor.sponsorImage?.public_id) {
      await deleteCloudinaryQuietly(sponsor.sponsorImage.public_id);
    }
    await sponsor.deleteOne();
    return sponsor;
  },

  // Random Sponsor (Public Mobile)
  async getRandomSponsor(userRegion?: string, userDepartment?: string) {
    const now = new Date();

    // Build matching criteria
    const matchCriteria: any = {
      status: SponsorStatus.ACTIVE,
      startDate: { $lte: now },
      endDate: { $gte: now },
    };

    // Region & Department Targeting
    // If region or department is passed, we want ads that targetAllUsers OR target that region OR target that department.
    // If the user is NOT logged in (no region and no department provided), we show ANY active ad without filtering.
    if (userRegion || userDepartment) {
      const orConditions: any[] = [{ targetAllUsers: true }];
      if (userRegion) {
        orConditions.push({ regions: { $in: [userRegion] } });
      }
      if (userDepartment) {
        orConditions.push({ departments: { $in: [userDepartment] } });
      }
      matchCriteria.$or = orConditions;
    }

    // Aggregate to find random active sponsors within dates and targeting rules
    const sponsors = await sponsorModel.aggregate([
      { $match: matchCriteria },
      { $sample: { size: 3 } },
    ]);

    if (!sponsors.length) return [];

    const sponsorIds = sponsors.map((s) => s._id);

    // Populate partner details and select only public fields (omit sensitive metrics & targeting info)
    const populatedSponsors = await sponsorModel
      .find({ _id: { $in: sponsorIds } })
      .select(
        "title description actionText actionLink type sponsorImage partner",
      )
      .populate("partner", "firstName lastName company profileImage");

    return populatedSponsors;
  },

  // Track Impression/Click (Public Mobile)
  async trackSponsor(id: string, action: "impression" | "click") {
    const sponsor = await sponsorModel.findById(id);
    if (!sponsor) throw new CustomError(404, "Sponsor not found");

    if (action === "impression") {
      sponsor.impressions += 1;
    } else if (action === "click") {
      sponsor.clicks += 1;
    }

    await sponsor.save();
    return sponsor;
  },
};
