import mongoose, { Model, Schema } from "mongoose";
import { IAdminConfig } from "./admin.interface";

const adminConfigSchema = new Schema<IAdminConfig>(
  {
    // Point Scales
    pointsPerPhysicalDonation: { type: Number, default: 10 },
    pointsPerLocalMission: { type: Number, default: 50 },
    pointsPerStoryApproval: { type: Number, default: 20 },
    pointsPerReportResolved: { type: Number, default: 30 },
    pointsPerReport: { type: Number, default: 10 },
    crowdfundingTotal: { type: Number, default: 0 },
    crowdfundingGoal: { type: Number, default: 5000 },
  },
  {
    timestamps: true,
  }
);

export const adminConfigModel: Model<IAdminConfig> = mongoose.model<IAdminConfig>(
  "AdminConfig",
  adminConfigSchema
);
