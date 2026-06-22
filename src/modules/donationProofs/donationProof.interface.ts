import { Document, Types } from "mongoose";

export enum DonationProofStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export enum DonationCategory {
  FOOD = "food",
  LITTER = "litter",
  TOYS = "toys",
  MEDICINE = "medicine",
  OTHER = "other",
}

export enum RefusalReason {
  BLURRED_PHOTO = "blurred_photo",
  ITEM_NOT_VISIBLE = "item_not_visible",
  POINT_NOT_RECOGNIZED = "point_not_recognized",
}

export interface IDonationProof extends Document {
  user?: Types.ObjectId | string;
  donorName?: string;
  donorEmail?: string;
  collectionPoint: Types.ObjectId | string;
  amount: number;
  quantity?: number;
  category: DonationCategory;
  photo: {
    public_id: string;
    secure_url: string;
  };
  status: DonationProofStatus;
  pointsAwarded?: number;
  adminNote?: string;
  refusalReason?: RefusalReason;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmitDonationProofPayload {
  amount?: number;
  quantity?: number;
  collectionPointId: string;
  category: DonationCategory;
}

export interface ValidateDonationProofPayload {
  pointsAwarded: number;
  adminNote?: string;
  amount?: number;
}
