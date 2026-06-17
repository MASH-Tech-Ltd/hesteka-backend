import mongoose, { Model, Schema } from "mongoose";
import { IFriend, FriendStatus } from "./friend.interface";

const friendSchema = new Schema<IFriend>(
  {
    requester: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(FriendStatus),
      default: FriendStatus.PENDING,
    },
  },
  {
    timestamps: true,
  }
);

friendSchema.index({ requester: 1, recipient: 1 }, { unique: true });

export const FriendModel: Model<IFriend> = mongoose.model<IFriend>("Friend", friendSchema);
