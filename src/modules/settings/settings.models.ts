import { Schema, model } from "mongoose";

const settingsSchema = new Schema(
  {
    supportEmail: { type: String, default: "support@hesteka.com" },
    platformName: { type: String, default: "Hesteka" },
    socialLinks: {
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      twitter: { type: String, default: "" },
    },
    maintenanceMode: { type: Boolean, default: false },
    devMode: { type: Boolean, default: false },
    reportRadius: { type: Number, default: 50 },
    localMissionRadius: { type: Number, default: 50 },
    shopifyApiKey: { type: String, default: "" },
    shopifyAllowedDomain: { type: String, default: "" },
  },
  { timestamps: true }
);

export const settingsModel = model("Settings", settingsSchema);
