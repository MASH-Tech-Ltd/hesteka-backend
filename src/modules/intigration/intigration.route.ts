import { Router } from "express";
import cors from "cors";
import { getShopifyUsers } from "./intigration.controller";
import { rateLimiter } from "../../middleware/rateLimiter.middleware";

const router = Router();

// Allow all origins from CORS perspective since we'll validate the domain dynamically in the controller
const shopifyCors = cors({
  origin: function (origin, callback) {
    callback(null, true);
  },
  methods: ["GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-key", "Authorization"],
  credentials: true
});

router.get("/shopify/users", shopifyCors, rateLimiter(15, 20, "Too many Shopify sync requests. Please try again after 15 minutes."), getShopifyUsers);

export const intigrationRoute = router;
