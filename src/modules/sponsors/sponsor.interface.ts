import { Document, Types } from "mongoose";

export enum SponsorType {
  BANNER = "banner",
  FEATURED = "featured",
}

export enum SponsorStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  EXPIRED = "expired",
}

export interface ISponsor extends Document {
  partner: Types.ObjectId | string;
  title: string;
  description?: string;
  actionText: string;
  actionLink: string;
  sponsorImage?: {
    public_id: string;
    secure_url: string;
  };
  type: SponsorType;
  startDate: Date;
  endDate: Date;
  status: SponsorStatus;
  targetAllUsers: boolean;
  regions: string[];
  departments: string[];
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
  status?: SponsorStatus;
  targetAllUsers?: boolean;
  regions?: string[];
  departments?: string[];
}

export interface UpdateSponsorPayload extends Partial<CreateSponsorPayload> {
  status?: SponsorStatus;
}
