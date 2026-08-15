import { Document, Types } from "mongoose";

export enum SponsorType {
  BANNER = "banner",
  FEATURED = "featured",
}

export interface ISponsor extends Document {
  partner: Types.ObjectId | string;
  title: string;
  description?: string;
  actionText: string;
  actionLink: string;
  image?: {
    public_id: string;
    secure_url: string;
  };
  type: SponsorType;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  impressions: number;
  clicks: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSponsorPayload {
  partner: string;
  title: string;
  description?: string;
  actionText: string;
  actionLink: string;
  type: SponsorType;
  startDate: Date | string;
  endDate: Date | string;
  isActive?: boolean;
}

export interface UpdateSponsorPayload extends Partial<CreateSponsorPayload> {
  isActive?: boolean;
}
