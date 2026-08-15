import { Schema, model } from "mongoose";
import { ISponsor, SponsorType } from "./sponsor.interface";

const sponsorSchema = new Schema<ISponsor>(
  {
    partner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    actionText: {
      type: String,
      required: true,
    },
    actionLink: {
      type: String,
      required: true,
    },
    image: {
      public_id: { type: String },
      secure_url: { type: String },
    },
    type: {
      type: String,
      enum: Object.values(SponsorType),
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    impressions: {
      type: Number,
      default: 0,
    },
    clicks: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

export const sponsorModel = model<ISponsor>("Sponsor", sponsorSchema);
