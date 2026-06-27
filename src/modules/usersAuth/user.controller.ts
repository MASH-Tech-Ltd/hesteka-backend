// modules/user/user.controller.ts
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { userService } from "./user.service";
import CustomError from "../../helpers/CustomError";
import { Types } from "mongoose";

//: get all users
export const getalluser = asyncHandler(async (req, res) => {
  const { users, meta } = await userService.getAllUsers(req);
  ApiResponse.sendSuccess(res, 200, "User fetched successfully", users, meta);
});

//: get unique locations
export const getUniqueLocations = asyncHandler(async (req, res) => {
  const cities = await userService.getUniqueCities();
  ApiResponse.sendSuccess(res, 200, "Locations fetched successfully", cities);
});

//: get single user
export const getSingleUser = asyncHandler(async (req, res) => {
  const { userId } = req?.params as { userId: string };
  const user = await userService.getUser(userId);
  ApiResponse.sendSuccess(res, 200, "User fetched successfully", user);
});

//: get my profile
export const getmyprofile = asyncHandler(async (req, res) => {
  const user = await userService.getmyprofile(req);
  ApiResponse.sendSuccess(res, 200, "Profile data fetched successfully", user);
});

//: get partner stats
export const getPartnerStats = asyncHandler(async (req, res) => {
  const stats = await userService.getPartnerStats(req);
  ApiResponse.sendSuccess(res, 200, "Partner stats fetched successfully", stats);
});

//: update user also profile image
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.updateUser(req);
  ApiResponse.sendSuccess(res, 200, "User updated successfully", {
    _id: result.id,
    email: result.email,
    firstName: result.firstName,
    lastName: result.lastName,
    phone: result.phone,
    address: result.address,
    city: result.city,
    postalCode: result.postalCode,
    country: result.country,
    company: result.company,
    pointsBalance: result.pointsBalance,
    selfIntroduction: result.selfIntroduction,
    profession: result.profession,
    role: result.role,
    status: result.status,
    isVerified: result.isVerified,
    location: result.location,
    profileImage: result.profileImage,
    provider: result.provider,
  });
});

//: update user status by id
export const updateStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await userService.updateStatus(req);
    ApiResponse.sendSuccess(
      res,
      200,
      "User status updated successfully",
      result,
    );
  },
);

//: update user by admin
export const updateUserByAdmin = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await userService.updateUserByAdmin(req);
    ApiResponse.sendSuccess(
      res,
      200,
      "User updated successfully by admin",
      result,
    );
  },
);

//: approve partner
export const approvePartner = asyncHandler(
  async (req: Request, res: Response) => {
    const { partnerId } = req?.params as { partnerId: string };
    const result = await userService.approvePartner(partnerId);
    ApiResponse.sendSuccess(res, 200, "Partner approved successfully", result);
  },
);

//: reject partner
export const rejectPartner = asyncHandler(
  async (req: Request, res: Response) => {
    const { partnerId } = req?.params as { partnerId: string };
    const result = await userService.rejectPartner(partnerId);
    ApiResponse.sendSuccess(res, 200, "Partner rejected successfully", result);
  },
);

//: update password
export const updatePassword = asyncHandler(
  async (req: Request, res: Response) => {
    await userService.updatePassword(req);
    ApiResponse.sendSuccess(
      res,
      200,
      "Password changed successfully. Please login again.",
    );
  },
);

//: delete account
export const deleteAccount = asyncHandler(
  async (req: Request, res: Response) => {
    await userService.deleteAccount(req);
    ApiResponse.sendSuccess(res, 200, "Account deleted successfully");
  },
);

//: update fcm token
export const updateFcmToken = asyncHandler(
  async (req: Request, res: Response) => {
    console.log("[User Controller] Update FCM Token - Received Payload:", req.body);
    await userService.updateFcmToken(req);
    ApiResponse.sendSuccess(res, 200, "FCM Token registered successfully");
  },
);

//: delete user by admin
export const deleteUserByAdmin = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = req.params;
    await userService.deleteUserByAdmin(userId as string);
    ApiResponse.sendSuccess(res, 200, "User deleted successfully");
  },
);

// ─── Block System ─────────────────────────────────────────────────────────────

//: block a user
export const blockUser = asyncHandler(async (req: Request, res: Response) => {
  const blockerId = req.user?._id;
  if (!blockerId) throw new CustomError(401, "Unauthorized");

  const { userId } = req.params as { userId: string };
  await userService.blockUser(blockerId as Types.ObjectId, userId);

  ApiResponse.sendSuccess(res, 200, "User blocked successfully");
});

//: unblock a user
export const unblockUser = asyncHandler(async (req: Request, res: Response) => {
  const blockerId = req.user?._id;
  if (!blockerId) throw new CustomError(401, "Unauthorized");

  const { userId } = req.params as { userId: string };
  await userService.unblockUser(blockerId as Types.ObjectId, userId);

  ApiResponse.sendSuccess(res, 200, "User unblocked successfully");
});

//: get blocked users list
export const getBlockedUsers = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    if (!userId) throw new CustomError(401, "Unauthorized");

    const blockedUsers = await userService.getBlockedUsers(
      userId as Types.ObjectId,
    );

    ApiResponse.sendSuccess(
      res,
      200,
      "Blocked users fetched successfully",
      blockedUsers,
    );
  },
);
