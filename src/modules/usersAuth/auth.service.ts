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
import { OAuth2Client } from "google-auth-library";
import appleSignin from "apple-signin-auth";

const googleClient = new OAuth2Client(
  config.provider.googleClientId,
  // config.provider.googleClientSecret,
  // process.env.GOOGLE_REDIRECT_URI
);

// Note: For a true "callback" flow (redirect-based), you need a redirect URI and client secret.
// I am implementing the idToken verification flow which is standard for modern apps,
// but adding a placeholder for getting user info from a code if redirected.

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
    const otp = generateOTP();
    console.log(`\n\n[DEV OTP] Registration OTP for ${payload.email}: ${otp}\n\n`);
    const user = await userModel.create({
      ...payload,
      role: role,
      provider: authProvider.LOCAL,
      verificationOtp: otp,
      verificationOtpExpire: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    try {
      await mailer({
        email: user.email,
        subject: "Your HESTEKA verification code",
        template: verificationOtpEmailTemplate(user.firstName, otp),
      });
    } catch (error) {
      console.error("[Auth] Failed to send verification email:", error);
    }

    return user;
  },

  //register partner
  async registerPartner(
    payload: RegisterPartnerPayload,
    logo?: Express.Multer.File,
  ): Promise<IUser> {
    const cleanupLogoFile = () => {
      if (logo?.path && fs.existsSync(logo.path)) {
        fs.unlinkSync(logo.path);
      }
    };

    if (!payload.company) {
      cleanupLogoFile();
      throw new CustomError(400, "Company is required");
    }
    if (!payload.email) {
      cleanupLogoFile();
      throw new CustomError(400, "Email is required");
    }
    if (!payload.phone) {
      cleanupLogoFile();
      throw new CustomError(400, "Phone number is required");
    }
    if (!logo) {
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
      cleanupLogoFile();
      throw new CustomError(409, "Email already exists");
    }

    if (existingPhone) {
      cleanupLogoFile();
      throw new CustomError(409, "Phone number already exists");
    }

    if (existingPartner) {
      cleanupLogoFile();
      throw new CustomError(409, "A partner account already exists for this company");
    }

    const profileImage = await uploadCloudinary(logo.path);

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
        ...(location !== undefined ? { location } : {}),
        role: role.PARTNERS,
        status: status.PENDING,
        provider: authProvider.LOCAL,
      })) as IUser;

      notificationService.notifyAdmins(
        "New Partner Registration",
        `A new partner "${company}" has registered and requires approval.`,
        NotificationType.NEW_PARTNER
      ).catch(err => console.error("Admin Notification Error:", err));

      return user;
    } catch (error) {
      if (profileImage?.public_id) {
        await deleteCloudinary(profileImage.public_id).catch((err) =>
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
    return { accessToken, rememberMe: user.rememberMe };
  },

  //google login callback logic
  async googleLogin(idToken: string) {
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken,
        audience: [
          config.provider.googleClientId as string,
          config.provider.googleIosClientId as string,
          config.provider.googleAndroidClientId as string,
        ],
      });
    } catch (error: any) {
      console.error("[Auth] Google token verification failed:", error.message);
      throw new CustomError(401, "Invalid Google token");
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new CustomError(400, "Invalid Google token");
    }

    let user = await userModel.findOne({ email: payload.email });

    if (!user) {
      // Create new user if not exists
      user = await userModel.create({
        firstName: payload.given_name || "Google",
        lastName: payload.family_name || "User",
        email: payload.email,
        isVerified: true, // Google emails are already verified
        address: "Social Login", // Default for social
        company: "Social Login", // Default for social
        provider: authProvider.GOOGLE,
        phone: `google-${payload.sub}`, // Unique placeholder for social users
      });
    } else {
      // Update provider if not set (optional migration)
      if (!user.provider) {
        user.provider = authProvider.GOOGLE;
        await user.save();
      }
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
    const refreshToken = user.createRefreshToken();

    user.refreshToken = refreshToken;
    await user.save();

    return { user, accessToken, refreshToken };
  },

  //apple login logic
  async appleLogin(idToken: string, firstName?: string, lastName?: string) {
    let appleId: string;
    let email: string | undefined;

    try {
      const decoded = await appleSignin.verifyIdToken(idToken, {
        audience: config.provider.appleClientId as string,
      });
      appleId = decoded.sub;
      email = decoded.email;
    } catch (error: any) {
      console.error("[Auth] Apple token verification failed:", error.message);
      throw new CustomError(401, "Invalid Apple token");
    }

    if (!email) {
      throw new CustomError(400, "Email not found in Apple token");
    }

    let user = await userModel.findOne({ email });

    if (!user) {
      user = await userModel.create({
        firstName: firstName || "Apple",
        lastName: lastName || "User",
        email: email,
        isVerified: true,
        address: "Social Login",
        company: "Social Login",
        provider: authProvider.APPLE,
        phone: `apple-${appleId}`,
      });
    } else {
      if (!user.provider) {
        user.provider = authProvider.APPLE;
        await user.save();
      }
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
