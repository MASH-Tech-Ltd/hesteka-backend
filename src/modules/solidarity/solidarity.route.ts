import { Router } from "express";
import { getProducts, getCollections, getCustomers } from "./solidarity.controller";
import { rateLimiter } from "../../middleware/rateLimiter.middleware";

const router = Router();

router.get("/shopify-products", rateLimiter(15, 30), getProducts);

router.get("/shopify-collections", rateLimiter(15, 30), getCollections);

router.get("/shopify-customers", rateLimiter(15, 30), getCustomers);

export const solidarityRoute = router;
