import mongoose, { Schema, Document, Model } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import CustomError from "../../helpers/CustomError";
import config from "../../config";
import { IUser, role, status, authProvider } from "./user.interface";

const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phone: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
    },
    address: {
      type: String,
      required: false,
    },
    city: {
      type: String,
      required: false,
      trim: true,
    },
    postalCode: {
      type: String,
      required: false,
      trim: true,
    },
    country: {
      type: String,
      required: false,
      trim: true,
      default: "France",
    },
    region: {
      type: String,
      required: false,
      trim: true,
    },
    department: {
      type: String,
      required: false,
      trim: true,
    },
    company: {
      type: String,
      required: false,
    },
    website: {
      type: String,
      required: false,
    },
    pointsBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    selfIntroduction: {
      type: String,
      trim: true,
      maxLength: 100,
    },
    profession: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: false,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(role),
      default: role.USER,
    },
    partnerType: {
      type: String,
      enum: ["association", "brand", "collection_point"],
      required: false,
    },
    provider: {
      type: String,
      enum: Object.values(authProvider),
      default: authProvider.LOCAL,
    },
    profileImage: {
      public_id: String,
      secure_url: String,
      _id: false,
    },
    status: {
      type: String,
      enum: Object.values(status),
      default: status.ACTIVE,
    },
    isVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
    verificationOtp: {
      type: String,
      required: false,
    },
    verificationOtpExpire: {
      type: Date,
    },
    refreshToken: {
      type: String,
    },
    resetPassword: {
      otp: { type: String },
      otpExpire: { type: Date },
      token: { type: String },
      tokenExpire: { type: Date },
    },
    rememberMe: {
      type: Boolean,
      default: false,
    },
    fcmTokens: {
      type: [String],
      default: [],
    },
    language: {
      type: String,
      enum: ["en", "fr"],
      default: "fr",
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
      address: String,
    },
    // ─── Block System ────────────────────────────────────────────────
    blockedUsers: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    stripeCustomerId: {
      type: String,
      required: false,
    },
    description: {
      type: String,
      required: false,
    },
    facebook: {
      type: String,
      required: false,
    },
    instagram: {
      type: String,
      required: false,
    },
    twitter: {
      type: String,
      required: false,
    },
    linkedin: {
      type: String,
      required: false,
    },
    logo: {
      public_id: String,
      secure_url: String,
      _id: false,
    },
    partnerImage: {
      public_id: String,
      secure_url: String,
      _id: false,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre<IUser>("save", async function () {
  const userModel = this.constructor as Model<IUser>;
  const existingUser = await userModel.findOne({ email: this.email });

  if (existingUser && existingUser._id.toString() !== this._id.toString()) {
    throw new CustomError(409, "Email already exists");
  }
});

userSchema.pre<IUser & Document>("save", async function () {
  if (!this.isModified("password") || !this.password) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.index(
  { role: 1, company: 1 },
  {
    unique: true,
    partialFilterExpression: { role: role.PARTNERS },
    collation: { locale: "en", strength: 2 },
  },
);

userSchema.index({ location: "2dsphere" }, { sparse: true });

userSchema.methods.comparePassword = async function (
  password: string,
): Promise<boolean> {
  if (!this.password) return false;
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.updatePassword = async function (
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const isValid = await this.comparePassword(currentPassword);
  if (!isValid) {
    throw new CustomError(401, "Current password is incorrect");
  }

  const isMatch = await this.comparePassword(newPassword);
  if (isMatch) {
    throw new CustomError(
      400,
      "New password must be different from current password",
    );
  }

  this.password = newPassword;
  return true;
};

userSchema.methods.createAccessToken = function () {
  return jwt.sign(
    { userId: this._id, email: this.email },
    config.jwt.accessTokenSecret as string,
    {
      expiresIn:
        config.env === "development"
          ? "1d"
          : this.rememberMe
            ? "3d"
            : (config.jwt.accessTokenExpires as any),
    },
  );
};

userSchema.methods.createRefreshToken = function () {
  return jwt.sign(
    { userId: this._id },
    config.jwt.refreshTokenSecret as string,
    {
      expiresIn: config.jwt.refreshTokenExpires as any,
    },
  );
};

userSchema.methods.generateResetPasswordToken = function () {
  return jwt.sign(
    { userId: this._id, email: this.email },
    config.passwordResetTokenSecret as string,
    {
      expiresIn: config.passwordResetTokenExpire as any,
    },
  );
};

userSchema.methods.verifyAccessToken = function (token: string) {
  return jwt.verify(token, config.jwt.accessTokenSecret as string);
};

userSchema.methods.verifyRefreshToken = function (token: string) {
  return jwt.verify(token, config.jwt.refreshTokenSecret as string);
};

export const userModel: Model<IUser> = mongoose.model<IUser>(
  "User",
  userSchema,
);
