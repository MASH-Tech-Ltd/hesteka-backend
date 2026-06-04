import { Router } from "express";
import { authGuard, allowRole } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/multer.midleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import {
  createCollectionPoint,
  deletePartnerAd,
  getAllPartnerAds,
  getMyPartnerAds,
  getPartnerAdById,
  updatePartnerAd,
} from "./partnerAd.controller";
import { partnerAdValidation } from "./partnerAd.validation";

const router = Router();

router.get("/get-all-partner-ads", getAllPartnerAds);
router.get("/get-single-partner-ad/:adId", getPartnerAdById);

router.use(authGuard, allowRole("partners", "admin"));

router.get("/get-my-partner-ads", getMyPartnerAds);

router.post(
  "/create-partner-ad",
  upload.single("image"),
  validateRequest(partnerAdValidation.createCollectionPointSchema),
  createCollectionPoint,
);

router.patch(
  "/update-partner-ad/:adId",
  upload.single("image"),
  validateRequest(partnerAdValidation.updatePartnerAdSchema),
  updatePartnerAd,
);

router.delete("/delete-partner-ad/:adId", deletePartnerAd);

export const partnerAdRoute = router;
