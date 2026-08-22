import express from "express";
import { chatLikeController } from "./chatlike.controller";
import { authGuard } from "../../../middleware/auth.middleware";
import { communityLimiter } from "../../../middleware/rateLimiter.middleware";

export const chatLikeRoute = express.Router();

chatLikeRoute.post("/:id/toggle", communityLimiter, authGuard, chatLikeController.toggleLike);

chatLikeRoute.get("/:id/likes", communityLimiter, authGuard, chatLikeController.getLikes);

chatLikeRoute.get(
  "/:id/liked-by-me",
  communityLimiter,
  authGuard,
  chatLikeController.isLikedByUser,
);
