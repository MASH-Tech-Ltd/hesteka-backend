import mongoose, { Schema } from "mongoose";
import { IAppModal } from "./appmodal.interface";

const appmodalSchema = new Schema<IAppModal>({
  type: { type: String, enum: ["update", "region_department", "announcement"], required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  isActive: { type: Boolean, default: false },
  actionText: { type: String },
  appstoreLink: { type: String },
  playstoreLink: { type: String },
  iosMinVersion: { type: String },
  androidMinVersion: { type: String },
  platform: { type: String, enum: ["ios", "android", "all"] },
}, { timestamps: true });

export const AppModalModel = mongoose.model<IAppModal>("AppModal", appmodalSchema);
