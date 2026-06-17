import { Router } from "express";
import { authGuard } from "../../middleware/auth.middleware";
import { friendController } from "./friend.controller";

const router = Router();

router.post("/send/:userId", authGuard, friendController.sendFriendRequest);
router.patch("/accept/:requestId", authGuard, friendController.acceptFriendRequest);
router.patch("/reject/:requestId", authGuard, friendController.rejectFriendRequest);
router.post("/block/:userId", authGuard, friendController.blockUser);
router.delete("/unblock/:userId", authGuard, friendController.unblockUser);
router.delete("/remove/:userId", authGuard, friendController.removeFriend);
router.get("/my-friends", authGuard, friendController.getMyFriends);
router.get("/pending-requests", authGuard, friendController.getPendingRequests);
router.get("/search", authGuard, friendController.searchUsers);

export const friendRoute = router;
