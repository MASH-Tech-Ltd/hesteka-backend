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
import { rateLimiter } from "../../middleware/rateLimiter.middleware";

const router = Router();

router.post(
  "/register-user",
  validateRequest(registerUserSchema),
  registration,
);

router.post(
  "/register-partner",
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "partnerImage", maxCount: 1 },
  ]),
  validateRequest(registerPartnerSchema),
  partnerRegistration,
);

router.post("/login", rateLimiter(1, 5), validateRequest(loginSchema), login);

router.post("/logout", authGuard, logout);

router.post(
  "/forget-password",
  validateRequest(forgetPasswordSchema),
  forgetPassword,
);

router.post(
  "/verify-otp",
  validateRequest(verifyOtpSchema),
  verifyOtpForgetPassword,
);

router.post(
  "/reset-password/:token",
  validateRequest(resetPasswordSchema),
  resetPassword,
);

router
  .route("/verify-account")
  .post(validateRequest(verifyAccountSchema), verifyAccount);

//: Social login routes
router.post("/google-login", googleLogin);
router.post("/apple-login", appleLogin);

router.post(
  "/account-verification-otp",
  validateRequest(resendOtpSchema),
  resendVerificationOtp,
);

//re generate access token
router.post("/generate-access-token", generateAccessToken);

export const authRoute = router;
