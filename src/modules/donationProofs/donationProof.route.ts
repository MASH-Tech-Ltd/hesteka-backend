import { Router } from "express";
import { authGuard, allowRole } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/multer.midleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import {
  submitDonationProofSchema,
  validateDonationProofSchema,
  rejectDonationProofSchema
} from "./donationProof.validation";
import {
  submitProof,
  getPendingProofs,
  validateProof,
  rejectProof,
  getValidationStats,
  getAcceptedValues,
  validateAll,
  getAllProofs,
  getPartnerProofs,
  getPartnerValidationStats
} from "./donationProof.controller";

const router = Router();

router.post(
  "/validate-all",
  authGuard,
  allowRole("admin"),
  validateAll
);

router.get("/get-accepted-values", getAcceptedValues);

router.get(
  "/stats",
  authGuard,
  allowRole("admin"),
  getValidationStats
);

// User routes
router.post(
  "/submit",
  authGuard,
  upload.single("image"),
  validateRequest(submitDonationProofSchema),
  submitProof
);

// Admin routes
router.get(
  "/pending",
  authGuard,
  allowRole("admin"),
  getPendingProofs
);

router.get(
  "/all",
  authGuard,
  allowRole("admin"),
  getAllProofs
);

// Partner routes
router.get(
  "/partner/proofs",
  authGuard,
  allowRole("partners"),
  getPartnerProofs
);

router.get(
  "/partner/stats",
  authGuard,
  allowRole("partners"),
  getPartnerValidationStats
);

router.patch(
  "/validate/:donationProofId",
  authGuard,
  allowRole("admin"),
  validateRequest(validateDonationProofSchema),
  validateProof
);

router.patch(
  "/reject/:donationProofId",
  authGuard,
  allowRole("admin"),
  validateRequest(rejectDonationProofSchema),
  rejectProof
);

export const donationProofRoute = router;
