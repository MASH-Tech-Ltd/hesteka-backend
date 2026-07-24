import mongoose, { Model, Schema } from "mongoose";
import { ICrowdfundingProject } from "./crowdfunding.interface";

const crowdfundingProjectSchema = new Schema<ICrowdfundingProject>(
  {
    slug: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const crowdfundingProjectModel: Model<ICrowdfundingProject> = mongoose.model<ICrowdfundingProject>(
  "CrowdfundingProject",
  crowdfundingProjectSchema
);
