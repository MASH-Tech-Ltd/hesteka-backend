import mongoose, { Model, Schema } from "mongoose";
import { ISupportMessage, SupportMessageStatus } from "./supportMessage.interface";

const supportMessageSchema = new Schema<ISupportMessage>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(SupportMessageStatus),
      default: SupportMessageStatus.PENDING,
    },
  },
  {
    timestamps: true,
  }
);

supportMessageSchema.index({ user: 1, status: 1 });
supportMessageSchema.index({ email: 1 });

export const SupportMessageModel: Model<ISupportMessage> = mongoose.model<ISupportMessage>(
  "SupportMessage",
  supportMessageSchema
);
