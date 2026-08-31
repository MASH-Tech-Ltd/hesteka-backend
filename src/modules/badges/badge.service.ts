import mongoose from "mongoose";
import { BadgeModel } from "./badge.model";
import { IBadge } from "./badge.interface";
import CustomError from "../../helpers/CustomError";
import { uploadOriginalCloudinary, deleteCloudinary } from "../../helpers/cloudinary";
import { userModel } from "../usersAuth/user.models";

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
      const uploadResult = await uploadOriginalCloudinary(file.path);
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
    let oldPublicId = badge.icon?.public_id;

    if (file) {
      const uploadResult = await uploadOriginalCloudinary(file.path);
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

    const session = await mongoose.startSession();
    session.startTransaction();

    let updatedBadge;
    try {
      updatedBadge = await BadgeModel.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
        session,
      });

      if (iconData) {
        await userModel.updateMany(
          { badge: id },
          {
            $set: {
              profileImage: iconData
            }
          },
          { session }
        );
      }

      await session.commitTransaction();
      session.endSession();
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      
      if (iconData) {
        await deleteCloudinary(iconData.public_id).catch(e => console.error("Cloudinary cleanup error on abort:", e));
      }
      throw error;
    }

    if (iconData && oldPublicId) {
      await deleteCloudinary(oldPublicId).catch(e => console.error("Cloudinary cleanup error:", e));
    }
    
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
