import express from "express";
import { privateChatController } from "./privatechat.controller";
import { authGuard } from "../../../middleware/auth.middleware";
import { uploadMediaArray } from "../../../middleware/multer.midleware";
import { COMMUNITY_CONFIG } from "../shared/community.config";
import { communityLimiter } from "../../../middleware/rateLimiter.middleware";

export const privateChatRoute = express.Router();

// Start or get existing conversation
privateChatRoute.post(
  "/conversations",
  authGuard,
  communityLimiter,
  privateChatController.startOrGetConversation,
);

// Get all conversations for logged-in user (inbox)
privateChatRoute.get(
  "/conversations",
  authGuard,
  privateChatController.getConversations,
);

// Send a message in a conversation
privateChatRoute.post(
  "/conversations/:conversationId/messages",
  authGuard,
  communityLimiter,
  uploadMediaArray("media", COMMUNITY_CONFIG.CHAT_MEDIA_MAX_COUNT),
  privateChatController.sendMessage,
);

// Get messages of a conversation (paginated)
privateChatRoute.get(
  "/conversations/:conversationId/messages",
  authGuard,
  privateChatController.getMessages,
);

// Mark all messages in a conversation as read
privateChatRoute.patch(
  "/conversations/:conversationId/read",
  authGuard,
  privateChatController.markAsRead,
);
