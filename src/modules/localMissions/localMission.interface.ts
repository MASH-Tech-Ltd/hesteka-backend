import { Document, Types } from "mongoose";

export interface IGeoPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export enum LocalMissionStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export enum LocalMissionParticipationStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  REJECTED = "rejected",
}

export interface ILocalMission extends Document {
  partner: Types.ObjectId | string;
  title: string;
  description: string;
  address: string;
  location?: IGeoPoint;
  duration: string;
  points?: number;
  photo?: {
    public_id: string;
    secure_url: string;
  };
  status: LocalMissionStatus;
  missionDate?: Date;
  region?: string;
  department?: string;
}

export interface CreateLocalMissionPayload {
  title: string;
  description: string;
  address: string;
  location?: IGeoPoint;
  duration: string;
  points?: number;
  missionDate?: Date;
  region?: string;
  department?: string;
  notifyAllFrance?: boolean | string;
}

export interface UpdateLocalMissionPayload {
  title?: string;
  description?: string;
  address?: string;
  location?: IGeoPoint;
  duration?: string;
  points?: number;
  status?: LocalMissionStatus;
  missionDate?: Date;
  region?: string;
  department?: string;
}

export interface ILocalMissionParticipation extends Document {
  mission: Types.ObjectId | string;
  user: Types.ObjectId | string;
  status: LocalMissionParticipationStatus;
  pointsAwarded: number;
  completedAt?: Date;
}
