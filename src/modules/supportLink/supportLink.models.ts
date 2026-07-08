import mongoose, { Schema, Model } from "mongoose";
import { ISupportLink } from "./supportLink.interface";

const supportLinkSchema = new Schema<ISupportLink>(
  {
    link: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const supportLinkModel: Model<ISupportLink> = mongoose.model<ISupportLink>(
  "SupportLink",
  supportLinkSchema
);
