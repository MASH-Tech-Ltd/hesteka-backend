import mongoose, { Schema, Model } from "mongoose";
import { IBadge } from "./badge.interface";

const badgeSchema = new Schema<IBadge>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    icon: {
      secure_url: { type: String, trim: true },
      public_id: { type: String, trim: true },
    },
  },
  {
    timestamps: true,
  }
);

export const BadgeModel: Model<IBadge> = mongoose.model<IBadge>(
  "Badge",
  badgeSchema
);
