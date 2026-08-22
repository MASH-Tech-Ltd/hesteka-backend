import { Router } from "express";
import { authGuard, allowRole } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/multer.midleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { contentLimiter } from "../../middleware/rateLimiter.middleware";
import {
  createRewardItem,
  deleteRewardItem,
  getAllRedemptions,
  getAllRewardItems,
  getMyRedemptions,
  getRewardItemById,
  redeemRewardItem,
  updateRedemptionStatus,
  updateRewardItem,
} from "./reward.controller";
import { rewardValidation } from "./reward.validation";

const router = Router();

// Public/User Routes
router.get("/get-all-rewards", contentLimiter, getAllRewardItems);
router.get("/get-single-reward/:rewardId", contentLimiter, getRewardItemById);

// Authenticated User Routes
router.post("/redeem-reward/:rewardId", authGuard, allowRole("user"), redeemRewardItem);
router.get("/get-my-redemptions", authGuard, allowRole("user"), getMyRedemptions);

// Admin Routes
router.use(authGuard, allowRole("admin"));

router.post(
  "/admin/create-reward",
  upload.single("image"),
  validateRequest(rewardValidation.createRewardItemSchema),
  createRewardItem,
);

router.patch(
  "/admin/update-reward/:rewardId",
  upload.single("image"),
  validateRequest(rewardValidation.updateRewardItemSchema),
  updateRewardItem,
);

router.delete("/admin/delete-reward/:rewardId", deleteRewardItem);

router.get("/admin/get-all-redemptions", getAllRedemptions);

router.patch(
  "/admin/update-redemption-status/:redemptionId",
  validateRequest(rewardValidation.updateRedemptionStatusSchema),
  updateRedemptionStatus,
);

export const rewardRoute = router;
