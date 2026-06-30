import express from "express";
import { chatController } from "./chat.controller";
import { authGuard, allowRole } from "../../../middleware/auth.middleware";
import { uploadMediaArray } from "../../../middleware/multer.midleware";
import { COMMUNITY_CONFIG } from "../shared/community.config";

export const chatRoute = express.Router();

chatRoute.post(
  "/",
  authGuard,
  uploadMediaArray("media", COMMUNITY_CONFIG.CHAT_MEDIA_MAX_COUNT),
  chatController.createChat,
);

chatRoute.get("/local", authGuard, chatController.getLocalChat);

chatRoute.get("/global", authGuard, chatController.getGlobalChat);

chatRoute.get("/:id", authGuard, chatController.getChatById);

chatRoute.delete("/:id", authGuard, chatController.deleteChat);

chatRoute.patch(
  "/:id",
  authGuard,
  uploadMediaArray("media", COMMUNITY_CONFIG.CHAT_MEDIA_MAX_COUNT),
  chatController.updateChat,
);

chatRoute.delete("/admin/:id", authGuard, allowRole("admin"), chatController.adminDeleteChat);
