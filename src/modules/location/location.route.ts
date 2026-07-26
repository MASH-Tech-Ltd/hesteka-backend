import { Router } from "express";
import { locationLimiter } from "../../middleware/rateLimiter.middleware";
import { authGuardOptional } from "../../middleware/auth.middleware";
import {
  autocompleteController,
  placeDetailsController,
  geocodeController,
  reverseGeocodeController,
  getSavedLocationsController,
  deleteSavedLocationController,
  clearSavedLocationsController,
  trackLocationUsageController,
  getLocationStatsController,
} from "./location.controller";

const router = Router();

// Apply rate limiter and optional authentication to all location endpoints
router.use(locationLimiter, authGuardOptional);

router.get("/autocomplete", autocompleteController);
router.get("/details", placeDetailsController);
router.get("/details/:placeId", placeDetailsController);
router.get("/geocode", geocodeController);
router.get("/reverse-geocode", reverseGeocodeController);

// Saved database locations endpoints for dashboard
router.get("/saved", getSavedLocationsController);
router.delete("/saved/:id", deleteSavedLocationController);
router.delete("/saved", clearSavedLocationsController);
// Tracking metrics
router.post("/track", trackLocationUsageController);
router.get("/track", trackLocationUsageController); // Allow GET as fallback
router.get("/stats", getLocationStatsController);

export const locationRoute = router;
