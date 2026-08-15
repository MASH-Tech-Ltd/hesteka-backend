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
} from "./sponsor.controller";
import {
  createSponsorSchema,
  updateSponsorSchema,
} from "./sponsor.validation";
import { allowRole, authGuard } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/multer.midleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";


const router = Router();

// Public Routes (for Mobile App)
router.get("/random", getRandomSponsor);
router.post("/:id/track", trackSponsor);

// Admin Routes
router.use(authGuard);
router.use(allowRole("admin"));

router.post(
  "/",
  upload.single("image"),
  validateRequest(createSponsorSchema),
  createSponsor
);
router.get("/", getAllSponsors);
router.get("/search-partners", searchPartners);
router.get("/:id", getSponsorById);
router.patch(
  "/:id",
  upload.single("image"),
  validateRequest(updateSponsorSchema),
  updateSponsor
);
router.delete("/:id", deleteSponsor);

export const sponsorRoutes = router;
