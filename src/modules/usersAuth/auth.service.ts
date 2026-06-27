import { userModel } from "./user.models";
import { notificationService } from "../notifications/notification.service";
import { NotificationType } from "../notifications/notification.interface";
import fs from "fs";
import jwt from "jsonwebtoken";
import CustomError from "../../helpers/CustomError";
import config from "../../config";
import { IUser, role, status, authProvider } from "./user.interface";
import { deleteCloudinary, uploadCloudinary } from "../../helpers/cloudinary";
import { emailValidator } from "../../helpers/emailValidator";
import { generateOTP } from "../../utils/otpGenerator";
import { mailer } from "../../helpers/nodeMailer";
import { verificationOtpEmailTemplate, forgotPasswordOtpEmailTemplate } from "../../tempaletes/auth.templates";
import admin from "firebase-admin";

// Firebase Admin SDK is already initialized in src/utils/firebase.ts (for FCM)
// We reuse it here to verify Google & Apple ID tokens issued by Firebase Auth



type RegisterPartnerPayload = Partial<IUser> & {
  latitude?: number;
  longitude?: number;
  locationAddress?: string;
};

export const authService = {
  //register
  async registerUser(payload: Partial<IUser>) {
    if (payload.role === "admin")
      throw new CustomError(400, "Admin is reserved, you can't create admin");
    if (payload.email) {
      emailValidator(payload.email);
    }

    const adminEmails = config.adminEmails;
    const role = adminEmails.includes(payload.email!) ? "admin" : "user";
    // const otp = generateOTP();
    // console.log(`\n\n[DEV OTP] Registration OTP for ${payload.email}: ${otp}\n\n`);
    const user = await userModel.create({
      ...payload,
      role: role,
      provider: authProvider.LOCAL,
      isVerified: true, // Direct register bypasses OTP
      // verificationOtp: otp,
      // verificationOtpExpire: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    // try {
    //   await mailer({
    //     email: user.email,
    //     subject: "Your HESTEKA verification code",
    //     template: verificationOtpEmailTemplate(user.firstName, otp),
    //   });
    // } catch (error) {
    //   console.error("[Auth] Failed to send verification email:", error);
    // }

    return user;
  },

  //register partner
  async registerPartner(
    payload: RegisterPartnerPayload,
    logo?: Express.Multer.File,
    partnerImage?: Express.Multer.File,
  ): Promise<IUser> {
    const cleanupFiles = () => {
      if (logo?.path && fs.existsSync(logo.path)) {
        fs.unlinkSync(logo.path);
      }
      if (partnerImage?.path && fs.existsSync(partnerImage.path)) {
        fs.unlinkSync(partnerImage.path);
      }
    };

    if (!payload.company) {
      cleanupFiles();
      throw new CustomError(400, "Company is required");
    }
    if (!payload.email) {
      cleanupFiles();
      throw new CustomError(400, "Email is required");
    }
    if (!payload.phone) {
      cleanupFiles();
      throw new CustomError(400, "Phone number is required");
    }
    if (!logo) {
      cleanupFiles();
      throw new CustomError(400, "Partner logo is required");
    }
    emailValidator(payload.email);

    const email = payload.email.trim().toLowerCase();
    const phone = payload.phone.trim();
    const company = payload.company.trim();

    const escapedCompany = company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const [existingEmail, existingPhone, existingPartner] = await Promise.all([
      userModel.exists({ email }),
      userModel.exists({ phone }),
      userModel.exists({
        role: role.PARTNERS,
        company: { $regex: `^${escapedCompany}$`, $options: "i" },
      }),
    ]);

    if (existingEmail) {
      cleanupFiles();
      throw new CustomError(409, "Email already exists");
    }

    if (existingPhone) {
      cleanupFiles();
      throw new CustomError(409, "Phone number already exists");
    }

    if (existingPartner) {
      cleanupFiles();
      throw new CustomError(409, "A partner account already exists for this company");
    }

    const profileImage = await uploadCloudinary(logo.path);
    let uploadedPartnerImage;
    if (partnerImage) {
      try {
        uploadedPartnerImage = await uploadCloudinary(partnerImage.path);
      } catch (err) {
        cleanupFiles();
        if (profileImage?.public_id) {
          await deleteCloudinary(profileImage.public_id).catch((err) =>
            console.error("Cloudinary cleanup error:", err),
          );
        }
        throw err;
      }
    }

    try {
      const { latitude, longitude, locationAddress, ...partnerData } = payload;
      const location =
        typeof latitude === "number" && typeof longitude === "number"
          ? {
              type: "Point",
              coordinates: [longitude, latitude],
              ...(locationAddress !== undefined ? { address: locationAddress } : {}),
            }
          : undefined;

      const user = (await userModel.create({
        ...partnerData,
        email,
        phone,
        company,
        profileImage,
        logo: profileImage,
        ...(uploadedPartnerImage ? { partnerImage: uploadedPartnerImage } : {}),
        ...(location !== undefined ? { location } : {}),
        role: role.PARTNERS,
        status: status.PENDING,
        provider: authProvider.LOCAL,
      })) as IUser;

      cleanupFiles();

      notificationService.notifyAdmins(
        "Nouvelle inscription partenaire",
        `Un nouveau partenaire "${company}" s'est inscrit et nécessite une approbation.`,
        NotificationType.NEW_PARTNER
      ).catch(err => console.error("Admin Notification Error:", err));

      return user;
    } catch (error) {
      cleanupFiles();
      if (profileImage?.public_id) {
        await deleteCloudinary(profileImage.public_id).catch((err) =>
          console.error("Cloudinary cleanup error:", err),
        );
      }
      if (uploadedPartnerImage?.public_id) {
        await deleteCloudinary(uploadedPartnerImage.public_id).catch((err) =>
          console.error("Cloudinary cleanup error:", err),
        );
      }
      throw error;
    }
  },

  //verify account
  async verifyAccount(email: string, otp: string) {
    const user = await userModel.findOne({ email });
    if (!user) throw new CustomError(400, "User not found, register again");

    if (!user.verificationOtp) throw new CustomError(400, "OTP not found");
    if (user.verificationOtp !== otp) throw new CustomError(400, "Invalid OTP");
    if (!user.verificationOtpExpire || user.verificationOtpExpire < new Date()) {
      throw new CustomError(400, "OTP has been expired. Please resend a new OTP.");
    }

    user.isVerified = true;
    user.verificationOtp = null;
    user.verificationOtpExpire = null;
    await user.save();
    return user;
  },

  //login
  async login(email: string, password: string, rememberMe: boolean = false) {
    const user = await userModel.findOne({ email: email }).select("+password");
    if (!user) throw new CustomError(400, "user not found");
    if (user.status !== status.ACTIVE) {
      const message =
        user.status === status.PENDING
          ? "Your account is pending for admin approval."
          : user.status === status.REJECT
            ? "Account is rejected need to admin aproval"
            : `Your account is ${user.status}. Access denied.`;
      throw new CustomError(403, message);
    }
    if (!user.password) {
      throw new CustomError(400, "Password login is not available for this account");
    }

    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) throw new CustomError(400, "incorrect password");

    user.rememberMe = rememberMe;

    const accessToken = user.createAccessToken();
    const refreshToken = user.createRefreshToken();

    user.refreshToken = refreshToken;
    await user.save();

    return { user, accessToken, refreshToken };
  },

  //logout
  async logout(email: string) {
    const user = await userModel.findOne({ email });
    if (!user) throw new CustomError(400, "Email not found");

    user.refreshToken = "";
    await user.save();
  },

  //forget password
  async forgetPassword(email: string) {
    const user = await userModel.findOne({ email: email });
    if (!user) throw new CustomError(400, "User not found");

    if (user.provider !== authProvider.LOCAL) {
      throw new CustomError(
        400,
        `Password reset is not available for this account. Please login using your social account.`,
      );
    }

    if (user.status !== status.ACTIVE) {
      const message =
        user.status === status.PENDING
          ? "Your account is pending for admin approval."
          : user.status === status.REJECT
            ? "Your account is rejected. Access denied."
            : `Your account is ${user.status}. Access denied.`;
      throw new CustomError(403, message);
    }

    const otp = generateOTP();
    console.log(`\n\n[DEV OTP] Forgot Password OTP for ${user.email}: ${otp}\n\n`);

    await mailer({
      email: user.email,
      subject: "Reset your password - OTP",
      template: forgotPasswordOtpEmailTemplate(user.firstName, otp),
    });

    user.resetPassword.otp = otp;
    user.resetPassword.otpExpire = new Date(Date.now() + 2 * 60 * 1000);
    await user.save();

    return {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  },

  //verify otp
  async verifyOtp(email: string, otp: string) {
    const user = await userModel.findOne({ email });
    if (!user) throw new CustomError(400, "User not found");

    if (!user.resetPassword.otp) throw new CustomError(400, "OTP not found");
    if (user.resetPassword.otp !== otp) throw new CustomError(400, "Invalid OTP");

    if (!user.resetPassword.otpExpire || user.resetPassword.otpExpire < new Date(Date.now()))
      throw new CustomError(400, "OTP has been expired");

    user.isVerified = true;
    user.resetPassword.token = user.generateResetPasswordToken();
    user.resetPassword.tokenExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    user.resetPassword.otp = null;
    user.resetPassword.otpExpire = null;
    await user.save();

    return user;
  },

  //reset password
  async resetPassword(token: string, password: string) {
    const decoded = jwt.verify(token, config.passwordResetTokenSecret as string) as jwt.JwtPayload;
    if (!decoded) throw new CustomError(400, "Invalid token");

    const user = await userModel.findOne({ email: decoded.email }).select("+password");
    if (!user) throw new CustomError(400, "User not found");

    if (!user.resetPassword.token) throw new CustomError(400, "There is no request to reset password");
    if (user.resetPassword.token !== token) throw new CustomError(400, "Invalid token");

    if (user.password) {
      const isMatch = await user.comparePassword(password);
      if (isMatch) {
        throw new CustomError(400, "New password must be not similar as old password");
      }
    }

    user.password = password;
    user.resetPassword.token = null;
    user.resetPassword.tokenExpire = null;
    await user.save();

    return true;
  },

  //generate access token
  async generateAccessToken(refreshToken: string) {
    const decoded = jwt.verify(refreshToken, config.jwt.refreshTokenSecret) as jwt.JwtPayload;

    if (!decoded?.userId) {
      throw new CustomError(401, "Invalid refresh token");
    }

    const user = await userModel.findById(decoded.userId);
    if (!user) throw new CustomError(400, "User not found");
    if (user.refreshToken !== refreshToken) {
      throw new CustomError(401, "Invalid refresh token");
    }

    if (user.status !== status.ACTIVE) {
      const message =
        user.status === status.PENDING
          ? "Your account is pending for admin approval."
          : user.status === status.REJECT
            ? "Your account is rejected. Access denied."
            : `Your account is ${user.status}. Access denied.`;
      throw new CustomError(403, message);
    }

    const accessToken = user.createAccessToken();
    const newRefreshToken = user.createRefreshToken();
    
    user.refreshToken = newRefreshToken;
    await user.save();

    return { accessToken, refreshToken: newRefreshToken, rememberMe: user.rememberMe };
  },

  //google login — Firebase Auth token verification
  async googleLogin(idToken: string, extraData?: any) {
    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (error: any) {
      console.error("[Auth] Firebase Google token verification failed:", error.message);
      throw new CustomError(401, "Invalid Google token");
    }

    if (!decoded.email) {
      throw new CustomError(400, "Email not found in Google token");
    }

    // Extract name parts from Firebase decoded token
    const nameParts = (decoded.name as string | undefined)?.split(" ") ?? [];
    const firstName = nameParts[0] || "Google";
    const lastName = nameParts.slice(1).join(" ") || "User";
    const picture = decoded.picture as string | undefined;

    const location = (extraData?.latitude !== undefined && extraData?.longitude !== undefined) ? {
        type: "Point",
        coordinates: [extraData.longitude, extraData.latitude],
        ...(extraData.locationAddress ? { address: extraData.locationAddress } : {})
    } : undefined;

    let user = await userModel.findOne({ email: decoded.email });

    if (!user) {
      // Create new user
      user = await userModel.create({
        firstName,
        lastName,
        email: decoded.email,
        isVerified: true,
        provider: authProvider.GOOGLE,
        ...(picture ? { profileImage: { public_id: "", secure_url: picture } } : {}),
        ...(location ? { location } : {}),
        ...(extraData?.city ? { city: extraData.city } : {}),
        ...(extraData?.postalCode ? { postalCode: extraData.postalCode } : {}),
        ...(extraData?.country ? { country: extraData.country } : {}),
        ...(extraData?.fcmToken ? { fcmTokens: [extraData.fcmToken] } : {}),
      });
    } else {
      let needsSave = false;
      if (!user.provider) {
        user.provider = authProvider.GOOGLE;
        needsSave = true;
      }
      if (!user.profileImage?.secure_url && picture) {
        user.profileImage = { public_id: "", secure_url: picture };
        needsSave = true;
      }

      if (location && (!user.location || !user.location.coordinates || user.location.coordinates.length < 2)) {
         user.location = location as any;
         needsSave = true;
      }
      if (!user.city && extraData?.city) { user.city = extraData.city; needsSave = true; }
      if (!user.postalCode && extraData?.postalCode) { user.postalCode = extraData.postalCode; needsSave = true; }
      if (!user.country && extraData?.country) { user.country = extraData.country; needsSave = true; }

      if (extraData?.fcmToken && (!user.fcmTokens || !user.fcmTokens.includes(extraData.fcmToken))) {
         if (!user.fcmTokens) user.fcmTokens = [];
         user.fcmTokens.push(extraData.fcmToken);
         needsSave = true;
      }

      if (needsSave) await user.save();
    }

    if (user.status !== status.ACTIVE) {
      const message =
        user.status === status.PENDING
          ? "Your account is pending for admin approval."
          : user.status === status.REJECT
            ? "Your account is rejected. Access denied."
            : `Your account is ${user.status}. Access denied.`;
      throw new CustomError(403, message);
    }

    user.rememberMe = true;

    const accessToken = user.createAccessToken();
    const refreshToken = user.createRefreshToken();

    user.refreshToken = refreshToken;
    await user.save();

    return { user, accessToken, refreshToken };
  },

  //apple login — Firebase Auth token verification
  async appleLogin(idToken: string, firstName?: string, lastName?: string, extraData?: any) {
    let decoded: admin.auth.DecodedIdToken;

    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (error: any) {
      console.error("[Auth] Firebase Apple token verification failed:", error.message);
      throw new CustomError(401, "Invalid Apple token");
    }

    const email = decoded.email;
    if (!email) {
      throw new CustomError(400, "Email not found in Apple token");
    }

    const location = (extraData?.latitude !== undefined && extraData?.longitude !== undefined) ? {
        type: "Point",
        coordinates: [extraData.longitude, extraData.latitude],
        ...(extraData.locationAddress ? { address: extraData.locationAddress } : {})
    } : undefined;

    let user = await userModel.findOne({ email });

    if (!user) {
      user = await userModel.create({
        firstName: firstName || "Apple",
        lastName: lastName || "User",
        email,
        isVerified: true,
        provider: authProvider.APPLE,
        ...(location ? { location } : {}),
        ...(extraData?.city ? { city: extraData.city } : {}),
        ...(extraData?.postalCode ? { postalCode: extraData.postalCode } : {}),
        ...(extraData?.country ? { country: extraData.country } : {}),
        ...(extraData?.fcmToken ? { fcmTokens: [extraData.fcmToken] } : {}),
      });
    } else {
      let needsSave = false;
      if (!user.provider) {
        user.provider = authProvider.APPLE;
        needsSave = true;
      }

      if (location && (!user.location || !user.location.coordinates || user.location.coordinates.length < 2)) {
         user.location = location as any;
         needsSave = true;
      }
      if (!user.city && extraData?.city) { user.city = extraData.city; needsSave = true; }
      if (!user.postalCode && extraData?.postalCode) { user.postalCode = extraData.postalCode; needsSave = true; }
      if (!user.country && extraData?.country) { user.country = extraData.country; needsSave = true; }

      if (extraData?.fcmToken && (!user.fcmTokens || !user.fcmTokens.includes(extraData.fcmToken))) {
         if (!user.fcmTokens) user.fcmTokens = [];
         user.fcmTokens.push(extraData.fcmToken);
         needsSave = true;
      }

      if (needsSave) await user.save();
    }

    if (user.status !== status.ACTIVE) {
      const message =
        user.status === status.PENDING
          ? "Your account is pending for admin approval."
          : user.status === status.REJECT
            ? "Your account is rejected. Access denied."
            : `Your account is ${user.status}. Access denied.`;
      throw new CustomError(403, message);
    }

    user.rememberMe = true;

    const accessToken = user.createAccessToken();
    const refreshToken = user.createRefreshToken();

    user.refreshToken = refreshToken;
    await user.save();

    return { user, accessToken, refreshToken };
  },

  //resend verification otp
  async resendVerificationOtp(email: string) {
    const user = await userModel.findOne({ email });
    if (!user) throw new CustomError(400, "User not found");
    if (user.status !== status.ACTIVE) throw new CustomError(400, "Your account is not active");

    if (user.isVerified) {
      throw new CustomError(400, "Account is already verified");
    }

    const otp = generateOTP();
    console.log(`\n\n[DEV OTP] Resend Verification OTP for ${user.email}: ${otp}\n\n`);
    user.verificationOtp = otp;
    user.verificationOtpExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await mailer({
      email: user.email,
      subject: "Your HESTEKA account verification OTP",
      template: verificationOtpEmailTemplate(user.firstName, otp),
    });

    await user.save();
    return user;
  },
};
