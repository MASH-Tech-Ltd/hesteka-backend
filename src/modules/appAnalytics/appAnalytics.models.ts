import { Schema, model } from "mongoose";
import { IAppAnalytics } from "./appAnalytics.interface";

const appAnalyticsSchema = new Schema<IAppAnalytics>(
  {
    eventType: {
      type: String,
      enum: ["install", "uninstall", "session", "conversion"],
      required: true,
    },
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    os: {
      type: String,
      enum: ["android", "ios", "web", "unknown"],
      default: "unknown",
    },
    version: {
      type: String,
    },
    duration: {
      type: Number,
      default: 0,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

export const AppAnalytics = model<IAppAnalytics>("AppAnalytics", appAnalyticsSchema);
