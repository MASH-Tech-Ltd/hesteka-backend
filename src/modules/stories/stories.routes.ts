import express from "express";
import { authGuard } from "../../middleware/auth.middleware";
import { uploadMediaArray } from "../../middleware/multer.midleware";
import { storyController } from "./stories.controller";
import { contentLimiter } from "../../middleware/rateLimiter.middleware";

export const storyRoute = express.Router();

// Use uploadMediaArray with maxCount=1 (since we only accept 1 media per story)
// Extract single file in controller
storyRoute.post(
  "/",
  authGuard,
  contentLimiter,
  (req, res, next) => {
    uploadMediaArray("media", 1)(req, res, (err) => {
      if (err) return next(err);
      // Convert array to single file for convenience
      if (Array.isArray(req.files) && req.files.length > 0) {
        req.file = req.files[0];
      }
      next();
    });
  },
  storyController.createStory,
);

storyRoute.get("/local", authGuard, storyController.getLocalStories);

storyRoute.get("/user/:userId", authGuard, storyController.getUserStories);

storyRoute.get("/:id", authGuard, storyController.getStoryById);

storyRoute.delete("/:id", authGuard, storyController.deleteStory);
