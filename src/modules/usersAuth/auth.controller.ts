import { CookieOptions, Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import config from "../../config";
import { authService } from "./auth.service";
import CustomError from "../../helpers/CustomError";

const ACCESS_TOKEN_MAX_AGE = {
  DEFAULT: 1000 * 60 * 10,
  REMEMBER_ME: 1000 * 60 * 60 * 24 * 3,
} as const;

const REFRESH_TOKEN_MAX_AGE = 1000 * 60 * 60 * 24 * 15;

const cookieOptions = (maxAge?: number): CookieOptions => ({
  httpOnly: true,
  sameSite: config.env === "development" ? "lax" : "none",
  secure: config.env !== "development",
  ...(maxAge ? { maxAge } : {}),
});

const accessTokenMaxAge = (rememberMe?: boolean): number =>
  rememberMe ? ACCESS_TOKEN_MAX_AGE.REMEMBER_ME : ACCESS_TOKEN_MAX_AGE.DEFAULT;

//: Register user
export const registration = asyncHandler(async (req, res) => {
  const user = await authService.registerUser(req.body);
  ApiResponse.sendSuccess(res, 201, "User registered successfully", {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  });
});

//: Register partner
export const partnerRegistration = asyncHandler(async (req, res) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const logo = files?.logo?.[0];
  const partnerImage = files?.partnerImage?.[0];

  const user = await authService.registerPartner(
    req.body,
    logo,
    partnerImage,
  );
  ApiResponse.sendSuccess(res, 201, "Partner registered successfully", {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    company: user.company,
    phone: user.phone,
    address: user.address,
    city: user.city,
    postalCode: user.postalCode,
    country: user.country,
    location: user.location,
    profileImage: user.profileImage,
    role: user.role,
  });
});

//: Verify account by otp sent to email
export const verifyAccount = asyncHandler(async (req, res) => {
  const user = await authService.verifyAccount(req.body.email, req.body.otp);
  ApiResponse.sendSuccess(res, 200, "Account successfully verified", {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  });
});

//: Login user
export const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(
    req.body.email,
    req.body.password,
    req?.body?.rememberMe
  );

  res.cookie("refreshToken", refreshToken, cookieOptions(REFRESH_TOKEN_MAX_AGE));
  res.cookie("accessToken", accessToken, cookieOptions(accessTokenMaxAge(req?.body?.rememberMe)));

  const responsePayload = {
    _id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    language: user.language || "fr",
    accessToken,
    refreshToken,
  };
  
  // console.log("[Auth Controller] Login Response:", responsePayload);

  ApiResponse.sendSuccess(res, 200, "Logged in", responsePayload);
});

//: Logout user
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.user as { email: string };
  const fcmToken = req.body?.fcmToken || req.headers["x-fcm-token"] as string;
  await authService.logout(email, fcmToken);

  res.clearCookie("refreshToken");
  res.clearCookie("accessToken");

  ApiResponse.sendSuccess(res, 200, "Logged out", {});
});

//: forget password
export const forgetPassword = asyncHandler(async (req, res) => {
  const user = await authService.forgetPassword(req.body.email);
  ApiResponse.sendSuccess(res, 200, "Reset password otp sent to your email", {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    message: "Reset password otp sent to your email",
  });
});

//: verify otp
export const verifyOtpForgetPassword = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const user = await authService.verifyOtp(email, otp);
  ApiResponse.sendSuccess(res, 200, "Otp is verified", {
    email: user.email,
    token: user?.resetPassword?.token
  });
});

//: reset password
export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  if (!token) throw new CustomError(400, "Token not found");

  await authService.resetPassword(token as string, password);

  ApiResponse.sendSuccess(res, 200, "Password reset successful");
});

//: generate access token
export const generateAccessToken = asyncHandler(async (req, res) => {
  const refreshToken =
    req.headers?.authorization?.toString().split("Bearer ")[1];

  if (!refreshToken) {
    throw new CustomError(401, "Refresh token not found");
  }

  const { accessToken, refreshToken: newRefreshToken, rememberMe } = await authService.generateAccessToken(refreshToken);

  res.cookie("refreshToken", newRefreshToken, cookieOptions(REFRESH_TOKEN_MAX_AGE));
  res.cookie("accessToken", accessToken, cookieOptions(accessTokenMaxAge(rememberMe)));

  ApiResponse.sendSuccess(res, 201, "New access token generated", {
    accessToken,
    refreshToken: newRefreshToken,
  });
});

//: Google Login callback/token handler
export const googleLogin = asyncHandler(async (req, res) => {
  const { idToken, latitude, longitude, locationAddress, city, postalCode, country, fcmToken } = req.body;
  if (!idToken) throw new CustomError(400, "Google idToken is required");
  
  // console.log("[Auth Controller] Google Login - Received FCM Token:", fcmToken);

  const { user, accessToken, refreshToken } = await authService.googleLogin(idToken, { latitude, longitude, locationAddress, city, postalCode, country, fcmToken });

  res.cookie("refreshToken", refreshToken, cookieOptions(REFRESH_TOKEN_MAX_AGE));
  res.cookie("accessToken", accessToken, cookieOptions(accessTokenMaxAge(user.rememberMe)));

  const responsePayload = {
    _id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    language: user.language || "fr",
    accessToken,
    refreshToken,
  };

  // console.log("[Auth Controller] Google Login Response:", responsePayload);

  ApiResponse.sendSuccess(res, 200, "Logged in with Google", responsePayload);
});

//: Apple Login handler
export const appleLogin = asyncHandler(async (req, res) => {
  const { idToken, firstName, lastName, latitude, longitude, locationAddress, city, postalCode, country, fcmToken } = req.body;
  if (!idToken) throw new CustomError(400, "Apple idToken is required");

  // console.log("[Auth Controller] Apple Login - Received FCM Token:", fcmToken);

  const { user, accessToken, refreshToken } = await authService.appleLogin(idToken, firstName, lastName, { latitude, longitude, locationAddress, city, postalCode, country, fcmToken });

  res.cookie("refreshToken", refreshToken, cookieOptions(REFRESH_TOKEN_MAX_AGE));
  res.cookie("accessToken", accessToken, cookieOptions(accessTokenMaxAge(user.rememberMe)));

  const responsePayload = {
    _id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    language: user.language || "fr",
    accessToken,
    refreshToken,
  };

  // console.log("[Auth Controller] Apple Login Response:", responsePayload);

  ApiResponse.sendSuccess(res, 200, "Logged in with Apple", responsePayload);
});

//: resend verification otp
export const resendVerificationOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  await authService.resendVerificationOtp(email);
  ApiResponse.sendSuccess(res, 200, "Verification otp sent to your email", {
    email,
  });
});
