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

export interface ILocationApiUsage {
  date: string; // YYYY-MM-DD format
  apiType: string; // "autocomplete" | "details" | "geocode" | "map_load"
  provider: string; // "osm" | "google" | "client"
  source: string; // "admin_dashboard" | "partner_dashboard" | "mobile_app" | "backend" | "unknown"
  count: number;
}

const locationApiUsageSchema = new Schema<ILocationApiUsage>(
  {
    date: { type: String, required: true, index: true },
    apiType: { type: String, required: true },
    provider: { type: String, required: true },
    source: { type: String, required: true, default: "unknown" },
    count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Compound index to ensure uniqueness per day/apiType/provider/source
locationApiUsageSchema.index({ date: 1, apiType: 1, provider: 1, source: 1 }, { unique: true });

export const locationApiUsageModel = model<ILocationApiUsage>("LocationApiUsage", locationApiUsageSchema);
