import { Router } from "express";
import { authGuard } from "../../middleware/auth.middleware";
import { friendController } from "./friend.controller";
import { communityLimiter } from "../../middleware/rateLimiter.middleware";

const router = Router();

router.post("/send/:userId", communityLimiter, authGuard, friendController.sendFriendRequest);
router.patch("/accept/:requestId", communityLimiter, authGuard, friendController.acceptFriendRequest);
router.patch("/reject/:requestId", communityLimiter, authGuard, friendController.rejectFriendRequest);
router.post("/block/:userId", communityLimiter, authGuard, friendController.blockUser);
router.delete("/unblock/:userId", communityLimiter, authGuard, friendController.unblockUser);
router.delete("/remove/:userId", communityLimiter, authGuard, friendController.removeFriend);
router.get("/my-friends", communityLimiter, authGuard, friendController.getMyFriends);
router.get("/active", communityLimiter, authGuard, friendController.getActiveFriends);
router.get("/pending-requests", communityLimiter, authGuard, friendController.getPendingRequests);
router.get("/search", communityLimiter, authGuard, friendController.searchUsers);

export const friendRoute = router;
