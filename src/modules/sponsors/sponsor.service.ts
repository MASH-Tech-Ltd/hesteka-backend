import { sponsorModel } from "./sponsor.models";
import { CreateSponsorPayload, UpdateSponsorPayload } from "./sponsor.interface";
import { uploadCloudinary, deleteCloudinary } from "../../helpers/cloudinary";
import CustomError from "../../helpers/CustomError";
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

export const sponsorService = {
  // Create Sponsor
  async createSponsor(payload: CreateSponsorPayload, file?: Express.Multer.File) {
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
      sponsorData.image = image;
    }

    const sponsor = await sponsorModel.create(sponsorData);
    return sponsor;
  },

  // Get All Sponsors (Admin)
  async getAllSponsors() {
    const sponsors = await sponsorModel.find().populate("partner", "firstName lastName company email profileImage").sort({ createdAt: -1 });
    return sponsors;
  },

  // Search Partners
  async searchPartners(query: string) {
    const searchRegex = new RegExp(query, "i");
    const partners = await userModel.find({
      role: role.PARTNERS,
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { company: searchRegex },
      ],
    }).select("firstName lastName company email profileImage").limit(20);
    return partners;
  },

  // Get Single Sponsor
  async getSponsorById(id: string) {
    const sponsor = await sponsorModel.findById(id).populate("partner", "firstName lastName company email profileImage");
    if (!sponsor) throw new CustomError(404, "Sponsor not found");
    return sponsor;
  },

  // Update Sponsor
  async updateSponsor(id: string, payload: UpdateSponsorPayload, file?: Express.Multer.File) {
    const sponsor = await sponsorModel.findById(id);
    if (!sponsor) throw new CustomError(404, "Sponsor not found");

    if (file) {
      if (sponsor.image?.public_id) {
        await deleteCloudinaryQuietly(sponsor.image.public_id);
      }
      try {
        const image = await uploadCloudinary(file.path);
        sponsor.image = image;
      } catch (error) {
        throw new CustomError(500, "Error uploading image");
      }
    }

    Object.assign(sponsor, payload);
    await sponsor.save();
    return sponsor;
  },

  // Delete Sponsor
  async deleteSponsor(id: string) {
    const sponsor = await sponsorModel.findById(id);
    if (!sponsor) throw new CustomError(404, "Sponsor not found");

    if (sponsor.image?.public_id) {
      await deleteCloudinaryQuietly(sponsor.image.public_id);
    }
    await sponsor.deleteOne();
    return sponsor;
  },

  // Random Sponsor (Public Mobile)
  async getRandomSponsor() {
    const now = new Date();
    
    // Aggregate to find random active sponsor within dates
    const sponsors = await sponsorModel.aggregate([
      {
        $match: {
          isActive: true,
          startDate: { $lte: now },
          endDate: { $gte: now },
        },
      },
      { $sample: { size: 1 } },
    ]);

    if (!sponsors.length) return null;

    // Populate partner details
    const sponsor = await sponsorModel.findById(sponsors[0]._id).populate("partner", "firstName lastName company profileImage");
    return sponsor;
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
