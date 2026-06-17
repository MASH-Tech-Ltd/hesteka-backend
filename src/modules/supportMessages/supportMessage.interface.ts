import { Document, Types } from "mongoose";

export enum SupportMessageStatus {
  PENDING = "pending",
  REVIEWED = "reviewed",
  CLOSED = "closed",
}

export interface ISupportMessage extends Document {
  user: Types.ObjectId;
  email: string;
  name: string;
  subject: string;
  message: string;
  status: SupportMessageStatus;
  adminReply?: string;
}

export interface CreateSupportMessagePayload {
  email: string;
  name: string;
  subject: string;
  message: string;
}
