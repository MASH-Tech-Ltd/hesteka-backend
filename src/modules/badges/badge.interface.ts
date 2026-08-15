import { Document } from "mongoose";

export interface IBadge extends Document {
  name: string;
  description?: string;
  icon?: {
    secure_url: string;
    public_id: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
