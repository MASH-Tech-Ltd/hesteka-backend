import { Document, Types } from "mongoose";

export enum FriendStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  BLOCKED = "blocked",
}

export interface IFriend extends Document {
  requester: Types.ObjectId;
  recipient: Types.ObjectId;
  status: FriendStatus;
  createdAt?: Date;
  updatedAt?: Date;
}
