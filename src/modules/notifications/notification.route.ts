import { Router } from "express";
import { authGuard, allowRole } from "../../middleware/auth.middleware";
import { getUserNotifications, getAdminNotifications, getTargetedNotifications, markNotificationAsRead, deleteNotification, sendAdminAlert, sendTargetedAlert, markAllAsRead } from "./notification.controller";
import { role } from "../usersAuth/user.interface";

const router = Router();

// Protected routes (requires login)
router.use(authGuard);

router.get("/get-my-notifications", getUserNotifications);
router.patch("/mark-as-read/all", markAllAsRead);
router.patch("/mark-as-read/:notificationId", markNotificationAsRead);
router.delete("/delete-notification/:notificationId", deleteNotification);

// Admin exclusive routes
router.get("/get-all-admin-notifications", allowRole(role.ADMIN), getAdminNotifications);
router.get("/get-targeted-admin-notifications", allowRole(role.ADMIN), getTargetedNotifications);
router.post("/send-admin-alert", allowRole(role.ADMIN), sendAdminAlert);
router.post("/send-targeted-alert", allowRole(role.ADMIN), sendTargetedAlert);


export const notificationRoute = router;
