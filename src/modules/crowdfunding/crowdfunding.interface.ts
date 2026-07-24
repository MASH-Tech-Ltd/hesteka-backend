import { Document } from "mongoose";

export interface ICrowdfundingProject extends Document {
  slug: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
