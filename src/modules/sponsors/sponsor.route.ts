import { Router } from "express";
import {
  createSponsor,
  getAllSponsors,
  getSponsorById,
  updateSponsor,
  deleteSponsor,
  getRandomSponsor,
  trackSponsor,
  searchPartners,
  getSponsorStats,
} from "./sponsor.controller";
import {
  createSponsorSchema,
  updateSponsorSchema,
} from "./sponsor.validation";
import { allowRole, authGuard, authGuardOptional } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/multer.midleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { rateLimiter } from "../../middleware/rateLimiter.middleware";

const router = Router();

// Public Routes (for Mobile App)
router.get("/random", rateLimiter(15, 60), authGuardOptional, getRandomSponsor);
router.post("/:id/track", rateLimiter(15, 30, "Too many tracking requests. Please wait 15 minutes."), trackSponsor);

// Admin Routes
router.use(authGuard);  
router.use(allowRole("admin"));

router.get("/stats", getSponsorStats);

router.post(
  "/",
  upload.single("sponsorImage"),
  validateRequest(createSponsorSchema),
  createSponsor
);
router.get("/", getAllSponsors);
router.get("/search-partners", searchPartners);
router.get("/:id", getSponsorById);
router.patch(
  "/:id",
  upload.single("sponsorImage"),
  validateRequest(updateSponsorSchema),
  updateSponsor
);
router.delete("/:id", deleteSponsor);

export const sponsorRoutes = router;
