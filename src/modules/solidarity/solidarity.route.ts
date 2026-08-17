import { Router } from "express";
import { getProducts, getCollections, getCustomers } from "./solidarity.controller";

const router = Router();

router.get("/shopify-products", getProducts);

router.get("/shopify-collections", getCollections);

router.get("/shopify-customers", getCustomers);

export const solidarityRoute = router;
