import express from "express";
import {
  createMyanimal,
  getAllMyanimals,
  getMyAnimals,
  getMyanimalById,
  updateMyanimal,
  deleteMyanimal,
} from "./myanimal.controller";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { createMyanimalSchema, updateMyanimalSchema } from "./myanimal.validation";
import { upload } from "../../middleware/multer.midleware";
import { authGuard } from "../../middleware/auth.middleware";
import { contentLimiter } from "../../middleware/rateLimiter.middleware";

const router = express.Router();

router.post(
  "/create",
  contentLimiter,
  authGuard,
  upload.single("image"),
  validateRequest(createMyanimalSchema),
  createMyanimal
);

router.get("/get-all", contentLimiter, authGuard, getAllMyanimals);

router.get("/mine", contentLimiter, authGuard, getMyAnimals);

router.get("/:id", contentLimiter, authGuard, getMyanimalById);

router.patch(
  "/:id",
  contentLimiter,
  authGuard,
  upload.single("image"),
  validateRequest(updateMyanimalSchema),
  updateMyanimal
);

router.delete("/:id", contentLimiter, authGuard, deleteMyanimal);

export const myanimalRoute = router;

