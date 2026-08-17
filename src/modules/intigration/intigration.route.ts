import { Router } from "express";
import cors from "cors";
import { getShopifyUsers } from "./intigration.controller";

const router = Router();

// Allow all origins from CORS perspective since we'll validate the domain dynamically in the controller
const shopifyCors = cors({
  origin: "*", 
  methods: ["GET"],
  allowedHeaders: ["Content-Type", "x-api-key", "Authorization"]
});

router.get("/shopify/users", shopifyCors, getShopifyUsers);

export const intigrationRoute = router;
