import { Router } from "express";
import {
  registration,
  partnerRegistration,
  verifyAccount,
  login,
  logout,
  forgetPassword,
  verifyOtpForgetPassword,
  resetPassword,
  generateAccessToken,
  googleLogin,
  appleLogin,
  resendVerificationOtp,
} from "./auth.controller";
import { authGuard } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/multer.midleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import {
  forgetPasswordSchema,
  loginSchema,
  registerPartnerSchema,
  registerUserSchema,
  resetPasswordSchema,
  resendOtpSchema,
  verifyAccountSchema,
  verifyOtpSchema,
} from "./auth.validation";
import { rateLimiter, authLimiter, otpLimiter, passwordLimiter } from "../../middleware/rateLimiter.middleware";

const router = Router();

router.post(
  "/register-user",
  authLimiter,
  validateRequest(registerUserSchema),
  registration,
);

router.post(
  "/register-partner",
  authLimiter,
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "partnerImage", maxCount: 1 },
  ]),
  validateRequest(registerPartnerSchema),
  partnerRegistration,
);

router.post(
  "/login",
  rateLimiter(1, 5, "Too many login attempts. Please try again after 1 minute."),
  validateRequest(loginSchema),
  login,
);

router.post("/logout", authGuard, logout);

router.post(
  "/forget-password",
  otpLimiter,
  validateRequest(forgetPasswordSchema),
  forgetPassword,
);

router.post(
  "/verify-otp",
  otpLimiter,
  validateRequest(verifyOtpSchema),
  verifyOtpForgetPassword,
);

router.post(
  "/reset-password/:token",
  passwordLimiter,
  validateRequest(resetPasswordSchema),
  resetPassword,
);

router
  .route("/verify-account")
  .post(otpLimiter, validateRequest(verifyAccountSchema), verifyAccount);

//: Social login routes
router.post("/google-login", authLimiter, googleLogin);
router.post("/apple-login", authLimiter, appleLogin);

router.post(
  "/account-verification-otp",
  otpLimiter,
  validateRequest(resendOtpSchema),
  resendVerificationOtp,
);

//re generate access token
router.post("/generate-access-token", authLimiter, generateAccessToken);

export const authRoute = router;
