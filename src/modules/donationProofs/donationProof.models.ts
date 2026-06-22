import mongoose, { Model, Schema } from "mongoose";
import {
  DonationCategory,
  DonationProofStatus,
  IDonationProof,
  RefusalReason,
} from "./donationProof.interface";

const donationProofSchema = new Schema<IDonationProof>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    donorName: {
      type: String,
      trim: true,
    },
    donorEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    collectionPoint: {
      type: Schema.Types.ObjectId,
      ref: "PartnerAd",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: false,
      min: 0,
    },
    category: {
      type: String,
      enum: Object.values(DonationCategory),
      default: DonationCategory.FOOD,
    },
    photo: {
      public_id: { type: String, required: true },
      secure_url: { type: String, required: true },
    },
    status: {
      type: String,
      enum: Object.values(DonationProofStatus),
      default: DonationProofStatus.PENDING,
    },
    pointsAwarded: {
      type: Number,
      default: 0,
    },
    adminNote: {
      type: String,
      trim: true,
    },
    refusalReason: {
      type: String,
      enum: Object.values(RefusalReason),
    },
  },
  {
    timestamps: true,
  }
);

donationProofSchema.index({ user: 1, status: 1 });
donationProofSchema.index({ status: 1 });

export const donationProofModel: Model<IDonationProof> = mongoose.model<IDonationProof>(
  "DonationProof",
  donationProofSchema
);
