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
    alertRadius: { type: Number, default: 5 },
  },
  { timestamps: true }
);

export const settingsModel = model("Settings", settingsSchema);
