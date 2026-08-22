import { Router } from "express";
import { authGuard, allowRole } from "../../middleware/auth.middleware";
import { getUserNotifications, getAdminNotifications, getTargetedNotifications, markNotificationAsRead, deleteNotification, sendAdminAlert, sendTargetedAlert, markAllAsRead } from "./notification.controller";
import { role } from "../usersAuth/user.interface";
import { rateLimiter } from "../../middleware/rateLimiter.middleware";

const router = Router();

// Protected routes (requires login)
router.use(authGuard);

router.get("/get-my-notifications", rateLimiter(15, 60), getUserNotifications);
router.patch("/mark-as-read/all", rateLimiter(15, 30), markAllAsRead);
router.patch("/mark-as-read/:notificationId", rateLimiter(15, 60), markNotificationAsRead);
router.delete("/delete-notification/:notificationId", rateLimiter(15, 30), deleteNotification);

// Admin exclusive routes
router.get("/get-all-admin-notifications", allowRole(role.ADMIN), getAdminNotifications);
router.get("/get-targeted-admin-notifications", allowRole(role.ADMIN), getTargetedNotifications);
router.post("/send-admin-alert", rateLimiter(15, 10, "Too many alert sends. Please wait 15 minutes."), allowRole(role.ADMIN), sendAdminAlert);
router.post("/send-targeted-alert", rateLimiter(15, 10, "Too many alert sends. Please wait 15 minutes."), allowRole(role.ADMIN), sendTargetedAlert);


export const notificationRoute = router;
