import { Schema, model } from "mongoose";
import { ILocationCache } from "./location.interface";

const locationCacheSchema = new Schema<ILocationCache>(
  {
    key: { type: String, required: true, unique: true, index: true },
    data: { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

export const locationCacheModel = model<ILocationCache>("LocationCache", locationCacheSchema);
