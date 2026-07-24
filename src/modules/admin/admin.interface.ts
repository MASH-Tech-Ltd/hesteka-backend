import { Document } from "mongoose";

export interface IAdminConfig extends Document {
  // Point Scales
  pointsPerPhysicalDonation: number;
  pointsPerLocalMission: number;
  pointsPerStoryApproval: number;
  pointsPerReportResolved: number;
  
  pointsPerReport: number;
  
  crowdfundingTotal?: number;
  crowdfundingGoal?: number;

  createdAt: Date;
  updatedAt: Date;
}

export interface IAdminStats {
  users: {
    total: number;
    active: number;
    pendingPartners: number;
  };
  reports: {
    total: number;
    resolved: number;
    lost: number;
    sighted: number;
  };
  donations: {
    collectedThisMonth: number;
    totalDigital: number;
    totalPhysical: number;
  };
  points: {
    totalEarnedThisMonth: number;
    totalRedeemedThisMonth: number;
  };
}

export interface UpdateAdminConfigPayload {
  pointsPerPhysicalDonation?: number;
  pointsPerLocalMission?: number;
  pointsPerStoryApproval?: number;
  pointsPerReportResolved?: number;
  pointsPerReport?: number;
  crowdfundingTotal?: number;
  crowdfundingGoal?: number;
}
