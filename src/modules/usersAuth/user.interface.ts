import { Request } from "express";
import { Document, Types } from "mongoose";

export enum role {
  ADMIN = "admin",
  USER = "user",
  PARTNERS = "partners",
}

export enum authProvider {
  GOOGLE = "google",
  APPLE = "apple",
  LOCAL = "local",
}

export enum status {
  ACTIVE = "active",
  INACTIVE = "inactive",
  BLOCKED = "blocked",
  BANNED = "banned",
  PENDING = "pending",
  REJECT = "reject",
}

export enum updateStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  BLOCKED = "blocked",
  BANNED = "banned",
}

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  provider: authProvider;
  password?: string;
  role: string;
  partnerType?: string;
  profession: string;
  profileImage: {
    public_id: string;
    secure_url: string;
  };
  status: status;
  selfIntroduction: string;
  address: string;
  city?: string;
  postalCode?: string;
  country?: string;
  region?: string;
  department?: string;
  location?: {
    type: string;
    coordinates: number[];
    address?: string;
  };
  company?: string;
  website?: string;
  pointsBalance: number;
  isVerified: boolean;
  verificationOtp: string | null;
  verificationOtpExpire: Date | null;
  refreshToken: string | null;
  resetPassword: {
    otp: string | null;
    otpExpire: Date | null;
    token: string | null;
    tokenExpire: Date | null;
  };
  rememberMe: boolean;
  fcmTokens: string[];
  language?: string;
  lastLogin: Date;
  stripeCustomerId?: string;
  blockedUsers: Types.ObjectId[]; // users blocked by this user
  description?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  logo?: {
    public_id: string;
    secure_url: string;
  };
  partnerImage?: {
    public_id: string;
    secure_url: string;
  };
  comparePassword: (password: string) => Promise<boolean>;
  createAccessToken: () => string;
  createRefreshToken: () => string;
  generateResetPasswordToken(): string;
  verifyResetPasswordToken(token: string): any;
  updatePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<boolean>;
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  region?: string;
  department?: string;
  company?: string;
  partnerType?: string;
  website?: string;
  profession?: string;
  selfIntroduction?: string;
  status?: status;
  latitude?: number;
  longitude?: number;
  locationAddress?: string;
  description?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  language?: string;
}
