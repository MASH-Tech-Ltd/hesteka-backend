import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { friendService } from "./friend.service";

export const friendController = {
  sendFriendRequest: asyncHandler(async (req: Request, res: Response) => {
    const relation = await friendService.sendFriendRequest(req);
    ApiResponse.sendSuccess(res, 201, "Friend request sent successfully", relation);
  }),

  acceptFriendRequest: asyncHandler(async (req: Request, res: Response) => {
    const relation = await friendService.acceptFriendRequest(req);
    ApiResponse.sendSuccess(res, 200, "Friend request accepted successfully", relation);
  }),

  rejectFriendRequest: asyncHandler(async (req: Request, res: Response) => {
    const relation = await friendService.rejectFriendRequest(req);
    ApiResponse.sendSuccess(res, 200, "Friend request rejected successfully", relation);
  }),

  blockUser: asyncHandler(async (req: Request, res: Response) => {
    const relation = await friendService.blockUser(req);
    ApiResponse.sendSuccess(res, 200, "User blocked successfully", relation);
  }),

  unblockUser: asyncHandler(async (req: Request, res: Response) => {
    await friendService.unblockUser(req);
    ApiResponse.sendSuccess(res, 200, "User unblocked successfully");
  }),

  removeFriend: asyncHandler(async (req: Request, res: Response) => {
    await friendService.removeFriend(req);
    ApiResponse.sendSuccess(res, 200, "Friend removed successfully");
  }),

  getMyFriends: asyncHandler(async (req: Request, res: Response) => {
    const friends = await friendService.getMyFriends(req);
    ApiResponse.sendSuccess(res, 200, "Friends fetched successfully", friends);
  }),

  getPendingRequests: asyncHandler(async (req: Request, res: Response) => {
    const requests = await friendService.getPendingRequests(req);
    ApiResponse.sendSuccess(res, 200, "Pending requests fetched successfully", requests);
  }),

  searchUsers: asyncHandler(async (req: Request, res: Response) => {
    const users = await friendService.searchUsers(req);
    ApiResponse.sendSuccess(res, 200, "Users searched successfully", users);
  }),
};
