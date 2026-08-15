import { BadgeModel } from "./badge.model";
import { IBadge } from "./badge.interface";
import CustomError from "../../helpers/CustomError";
import { uploadCloudinary, deleteCloudinary } from "../../helpers/cloudinary";

export const badgeService = {
  async createBadge(data: Partial<IBadge>, file?: Express.Multer.File): Promise<IBadge> {
    if (!data.name) {
      throw new CustomError(400, "Badge name is required");
    }

    const existingBadge = await BadgeModel.findOne({ name: data.name });
    if (existingBadge) {
      throw new CustomError(400, "Badge with this name already exists");
    }

    let iconData;
    if (file) {
      const uploadResult = await uploadCloudinary(file.path);
      if (uploadResult) {
        iconData = {
          secure_url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
        };
      }
    }

    const badgeData = {
      ...data,
      ...(iconData && { icon: iconData }),
    };

    const badge = await BadgeModel.create(badgeData);
    return badge;
  },

  async getAllBadges(): Promise<IBadge[]> {
    return BadgeModel.find().sort({ createdAt: -1 });
  },

  async getBadgeById(id: string): Promise<IBadge> {
    const badge = await BadgeModel.findById(id);
    if (!badge) {
      throw new CustomError(404, "Badge not found");
    }
    return badge;
  },

  async updateBadge(id: string, data: Partial<IBadge>, file?: Express.Multer.File): Promise<IBadge> {
    const badge = await BadgeModel.findById(id);
    if (!badge) {
      throw new CustomError(404, "Badge not found");
    }

    let iconData;
    if (file) {
      if (badge.icon?.public_id) {
        await deleteCloudinary(badge.icon.public_id).catch(e => console.error("Cloudinary cleanup error:", e));
      }
      const uploadResult = await uploadCloudinary(file.path);
      if (uploadResult) {
        iconData = {
          secure_url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
        };
      }
    }

    const updateData = {
      ...data,
      ...(iconData && { icon: iconData }),
    };

    const updatedBadge = await BadgeModel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    
    return updatedBadge!;
  },

  async deleteBadge(id: string): Promise<void> {
    const badge = await BadgeModel.findByIdAndDelete(id);
    if (!badge) {
      throw new CustomError(404, "Badge not found");
    }
    if (badge.icon?.public_id) {
      await deleteCloudinary(badge.icon.public_id).catch(e => console.error("Cloudinary cleanup error:", e));
    }
  },
};
