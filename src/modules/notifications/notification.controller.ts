import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { notificationService } from "./notification.service";

export const getUserNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)._id;
  const { page, limit } = req.query;

  const result = await notificationService.getUserNotifications(userId, page, limit);

  ApiResponse.sendSuccess(res, 200, "Notifications fetched successfully", result.notifications, result.meta);
});

export const getAdminNotifications = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = req.query;

  const result = await notificationService.getAllAdminNotifications(page, limit);

  ApiResponse.sendSuccess(res, 200, "Admin notifications fetched successfully", result.notifications, result.meta);
});

export const getTargetedNotifications = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search } = req.query;

  const result = await notificationService.getTargetedAdminNotifications(page, limit, search as string);

  ApiResponse.sendSuccess(res, 200, "Targeted notifications fetched successfully", result.notifications, result.meta);
});

export const markNotificationAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)._id;
  const { notificationId } = req.params as { notificationId: string };

  const updated = await notificationService.markAsRead(userId, notificationId);

  if (!updated) {
    ApiResponse.sendError(res, 404, "Notification not found or already read");
    return;
  }

  ApiResponse.sendSuccess(res, 200, "Notification marked as read successfully", updated);
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)._id;
  await notificationService.markAllAsRead(userId);
  ApiResponse.sendSuccess(res, 200, "All notifications marked as read successfully");
});

export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)._id;
  const { notificationId } = req.params as { notificationId: string };

  const isDeleted = await notificationService.deleteNotification(userId, notificationId);

  if (!isDeleted) {
    ApiResponse.sendError(res, 404, "Notification not found or access denied");
    return;
  }

  ApiResponse.sendSuccess(res, 200, "Notification deleted successfully");
});

import { NotificationType } from "./notification.interface";

export const sendAdminAlert = asyncHandler(async (req: Request, res: Response) => {
  const { geoTarget, userType, message } = req.body;

  if (!message) {
    ApiResponse.sendError(res, 400, "Message is required");
    return;
  }

  await notificationService.sendManualAdminAlert(geoTarget, userType, message);

  ApiResponse.sendSuccess(res, 200, "Alert sent successfully");
});

export const sendTargetedAlert = asyncHandler(async (req: Request, res: Response) => {
  const { userId, message } = req.body;

  if (!userId || !message) {
    ApiResponse.sendError(res, 400, "User ID and message are required");
    return;
  }

  await notificationService.notifySingleUser(
    userId,
    "Message de l'Administrateur",
    message,
    NotificationType.SYSTEM
  );

  ApiResponse.sendSuccess(res, 200, "Targeted alert sent successfully");
});
