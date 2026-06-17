import mongoose, { Schema, Document, Model } from "mongoose";
import { INotification, NotificationType } from "./notification.interface";

const notificationSchema = new Schema<INotification>(
  {
    user: {
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
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      default: NotificationType.SYSTEM,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    data: {
      type: Schema.Types.Mixed,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index to automatically delete notifications after 30 days if you ever want TTL,
// or just standard indexes for fetching user notifications faster.
notificationSchema.index({ user: 1, createdAt: -1 });

export const notificationModel: Model<INotification> = mongoose.model<INotification>(
  "Notification",
  notificationSchema
);
