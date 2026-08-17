import { Router } from "express";
import { getShopifyUsers } from "./intigration.controller";

const router = Router();

router.get("/shopify/users", getShopifyUsers);

export const intigrationRoute = router;
