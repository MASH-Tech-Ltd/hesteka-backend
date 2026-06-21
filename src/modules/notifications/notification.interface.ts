import { Document, Types } from "mongoose";

export enum NotificationType {
  NEW_REPORT = "new_report",
  NEW_MISSION = "new_mission",
  POINTS_EARNED = "points_earned",
  MISSION_CANCELLED = "mission_cancelled",
  SYSTEM = "system",
  ACCOUNT_UPDATE = "account_update",
  CHAT_REPLY = "chat_reply",
  REWARD_UPDATE = "reward_update",
  NEW_PAYMENT = "new_payment",
  NEW_DONATION = "new_donation",
  NEW_PARTNER = "new_partner",
  FRIEND_REQUEST = "friend_request",
  FRIEND_ACCEPT = "friend_accept",
  NEW_COMMENT = "new_comment",
  NEW_REPLY = "new_reply",
}

export interface INotification extends Document {
  user: Types.ObjectId;
  title: string;
  description: string;
  type: NotificationType;
  isRead: boolean;
  data?: Record<string, any>;
}

//edit as you need
