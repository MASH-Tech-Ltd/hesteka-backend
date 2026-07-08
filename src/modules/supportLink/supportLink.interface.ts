import { Document } from "mongoose";

export interface ISupportLink extends Document {
  link: string;
  createdAt: Date;
  updatedAt: Date;
}
