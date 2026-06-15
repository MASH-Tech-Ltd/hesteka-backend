import { Router } from "express";
import {
  getalluser,
  getUniqueLocations,
  getmyprofile,
  getSingleUser,
  updateStatus,
  updateUserByAdmin,
  approvePartner,
  rejectPartner,
  updatePassword,
  deleteAccount,
  updateUser,
  updateFcmToken,
  blockUser,
  unblockUser,
  getBlockedUsers,
  deleteUserByAdmin,
} from "./user.controller";
import { allowRole, authGuard } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/multer.midleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import {
  updatePasswordSchema,
  deleteAccountSchema,
  updateStatusSchema,
  updateUserSchema,
  updateFcmTokenSchema,
} from "./user.validation";
import { rateLimiter } from "../../middleware/rateLimiter.middleware";

const router = Router();

router.get("/get-all-user", authGuard, allowRole("admin"), getalluser);

router.get("/get-unique-locations", authGuard, allowRole("admin"), getUniqueLocations);

router.get("/get-single-user/:userId", authGuard, getSingleUser);

router.get("/get-my-profile", authGuard, getmyprofile);

router.patch(
  "/update-user",
  authGuard,
  upload.single("image"),
  validateRequest(updateUserSchema),
  updateUser,
);

router.patch(
  "/update-status/:userId",
  authGuard,
  allowRole("admin"),
  validateRequest(updateStatusSchema),
  updateStatus,
);

router.patch(
  "/update-user-admin/:userId",
  authGuard,
  allowRole("admin"),
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "partnerImage", maxCount: 1 },
    { name: "profileImage", maxCount: 1 },
  ]),
  updateUserByAdmin,
);

router.patch(
  "/approve-partner/:partnerId",
  authGuard,
  allowRole("admin"),
  approvePartner,
);

router.patch(
  "/reject-partner/:partnerId",
  authGuard,
  allowRole("admin"),
  rejectPartner,
);

router.patch(
  "/update-password",
  rateLimiter(1, 5),
  authGuard,
  validateRequest(updatePasswordSchema),
  updatePassword,
);

router.delete(
  "/delete-account",
  rateLimiter(1, 5),
  authGuard,
  validateRequest(deleteAccountSchema),
  deleteAccount,
);

router.patch(
  "/update-fcm-token",
  authGuard,
  validateRequest(updateFcmTokenSchema),
  updateFcmToken,
);

// ─── Admin User Actions ────────────────────────────────────────────────────────

router.delete("/delete-user/:userId", authGuard, allowRole("admin"), deleteUserByAdmin);

// ─── Block System ─────────────────────────────────────────────────────────────

router.post("/block/:userId", authGuard, blockUser);

router.delete("/unblock/:userId", authGuard, unblockUser);

router.get("/blocked-list", authGuard, getBlockedUsers);

export const userRoute = router;
