import { Types } from "mongoose";
import { notificationModel } from "./notification.models";
import { userModel } from "../usersAuth/user.models";
import { NotificationType } from "./notification.interface";
import { sendPushNotification } from "../../utils/firebase";
import { getIo } from "../../socket/server";
import { paginationHelper } from "../../utils/pagination";

export const notificationService = {
  async getUserNotifications(userId: string, pageQuery?: any, limitQuery?: any) {
    const { page, limit, skip } = paginationHelper(pageQuery, limitQuery);

    const [notifications, total] = await Promise.all([
      notificationModel
        .find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      notificationModel.countDocuments({ user: userId }),
    ]);

    const unreadCount = await notificationModel.countDocuments({ user: userId, isRead: false });

    return {
      notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        unreadCount,
      },
    };
  },

  async getAllAdminNotifications(pageQuery?: any, limitQuery?: any) {
    const { page, limit, skip } = paginationHelper(pageQuery, limitQuery);

    const [notifications, total] = await Promise.all([
      notificationModel
        .find()
        .populate("user", "firstName lastName email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      notificationModel.countDocuments(),
    ]);

    return {
      notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async markAsRead(userId: string, notificationId: string) {
    return notificationModel.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { isRead: true },
      { new: true }
    );
  },
  
  async markAllAsRead(userId: string) {
    return notificationModel.updateMany(
      { user: userId, isRead: false },
      { isRead: true }
    );
  },

  async deleteNotification(userId: string, notificationId: string) {
    const result = await notificationModel.deleteOne({ _id: notificationId, user: userId });
    return result.deletedCount > 0;
  },

  async notifyUsersNearby(title: string, body: string, type: NotificationType, lat?: number, lng?: number, radiusKm: number = 15, data?: Record<string, any>) {
    try {
      let filter: any = { status: "active", role: { $ne: "admin" } };

      if (lat !== undefined && lng !== undefined) {
        console.log(`[Notification Service] Filtering for active users/partners within ${radiusKm}km of [${lat}, ${lng}]...`);
        filter.location = {
          $geoWithin: {
            $centerSphere: [[lng, lat], radiusKm / 6378.1],
          },
        };
      } else {
        console.log(`[Notification Service] No event coordinates provided. Broadcasting to ALL active users/partners.`);
      }

      const usersNearby = await userModel.find(filter).select("_id fcmTokens");

      console.log(`[Notification Service] Found ${usersNearby.length} target users.`);

      if (!usersNearby.length) {
        console.log(`[Notification Service] Aborting. Reason: No users found within radius. Ensure testing user has a 'location' saved in the DB!`);
        return;
      }

      const notificationsToSave = usersNearby.map(u => ({
        user: u._id,
        title,
        description: body,
        type,
        isRead: false,
        ...(data ? { data } : {}),
      }));

      // 1. Save to database
      const savedNotifications = await notificationModel.insertMany(notificationsToSave);

      // Extract FCM tokens and prepare Socket logic
      const allTokens: string[] = [];
      let io: any; // using any to bypass strict type here easily, or import Server
      try {
        io = getIo();
      } catch (err) {
        // Socket may not be initialized or caught error
      }

      for (let idx = 0; idx < usersNearby.length; idx++) {
        const user = usersNearby[idx];
        if (!user) continue;

        const userIdStr = user._id.toString();
        let isOnline = false;

        if (io) {
          // Check if user has active sockets
          const sockets = await io.in(userIdStr).fetchSockets();
          if (sockets.length > 0) {
            isOnline = true;
            io.to(userIdStr).emit("notification:new", savedNotifications[idx]);
          }
        }

        // If user is offline, collect FCM tokens
        if (!isOnline && user.fcmTokens && Array.isArray(user.fcmTokens)) {
          allTokens.push(...user.fcmTokens);
        }
      }

      // 3. Send Push Notifications via FCM
      if (allTokens.length > 0) {
        await sendPushNotification(allTokens, title, body, { type, ...data });
      }

    } catch (error) {
      console.error(" Failed in notifyUsersNearby:", error);
    }
  },

  async notifySingleUser(userId: string, title: string, body: string, type: NotificationType) {
    try {
      const user = await userModel.findById(userId).select("_id fcmTokens");
      if (!user) return;

      const notificationToSave = {
        user: user._id,
        title,
        description: body,
        type,
        isRead: false,
      };

      const savedNotification = await notificationModel.create(notificationToSave);

      let isOnline = false;
      let io: any;
      try {
        io = getIo();
      } catch (err) { }

      if (io) {
        const userIdStr = user._id.toString();
        const sockets = await io.in(userIdStr).fetchSockets();
        if (sockets.length > 0) {
          isOnline = true;
          io.to(userIdStr).emit("notification:new", savedNotification);
        }
      }

      // Send Push Notifications via FCM only if offline
      if (!isOnline && user.fcmTokens && Array.isArray(user.fcmTokens) && user.fcmTokens.length > 0) {
        await sendPushNotification(user.fcmTokens, title, body, { type });
      }

    } catch (error) {
      console.error(" Failed in notifySingleUser:", error);
    }
  },

  async notifyAdmins(title: string, body: string, type: NotificationType) {
    try {
      const admins = await userModel.find({ role: "admin", status: "active" }).select("_id fcmTokens");
      if (!admins.length) return;

      const notificationsToSave = admins.map(admin => ({
        user: admin._id,
        title,
        description: body,
        type,
        isRead: false,
      }));

      const savedNotifications = await notificationModel.insertMany(notificationsToSave);

      const allTokens: string[] = [];
      let io: any;
      try {
        io = getIo();
      } catch (err) { }

      for (let idx = 0; idx < admins.length; idx++) {
        const admin = admins[idx];
        if (!admin) continue;
        
        const userIdStr = admin._id.toString();
        let isOnline = false;

        if (io) {
          const sockets = await io.in(userIdStr).fetchSockets();
          if (sockets.length > 0) {
            isOnline = true;
            io.to(userIdStr).emit("notification:new", savedNotifications[idx]);
          }
        }

        if (!isOnline && admin.fcmTokens && Array.isArray(admin.fcmTokens)) {
          allTokens.push(...admin.fcmTokens);
        }
      }

      if (allTokens.length > 0) {
        await sendPushNotification(allTokens, title, body, { type });
      }

    } catch (error) {
      console.error(" Failed in notifyAdmins:", error);
    }
  },
  async sendManualAdminAlert(geoTarget: string, userType: string, message: string) {
    const query: any = {};
    if (userType !== "all") {
      query.role = userType;
    } else {
      query.role = { $in: ["user", "partner"] };
    }

    if (geoTarget !== "all_france" && geoTarget !== "all") {
      if (geoTarget === "paca") {
        // PACA roughly around Marseille
        query.location = {
          $nearSphere: {
            $geometry: { type: "Point", coordinates: [5.3698, 43.2965] }, // Lng, Lat
            $maxDistance: 150000 // 150 km
          }
        };
      } else {
        // Dynamically match exact city string
        query.city = geoTarget;
      }
    }

    const targetUsers = await userModel.find(query).select("_id fcmTokens");

    if (!targetUsers || targetUsers.length === 0) return;

    const type = NotificationType.SYSTEM;
    const title = "Admin Alert";

    const notificationsToSave = targetUsers.map(u => ({
      user: u._id,
      title,
      description: message,
      type,
    }));

    const savedNotifications = await notificationModel.insertMany(notificationsToSave);

    const allTokens: string[] = [];
    let io: any;
    try {
      io = getIo();
    } catch (err) {}

    for (let idx = 0; idx < targetUsers.length; idx++) {
      const u = targetUsers[idx];
      if (!u) continue;
      
      const userIdStr = u._id.toString();
      let isOnline = false;

      if (io) {
        const sockets = await io.in(userIdStr).fetchSockets();
        if (sockets.length > 0) {
          isOnline = true;
          io.to(userIdStr).emit("notification:new", savedNotifications[idx]);
        }
      }

      if (!isOnline && u.fcmTokens && Array.isArray(u.fcmTokens)) {
        allTokens.push(...u.fcmTokens);
      }
    }

    if (allTokens.length > 0) {
      await sendPushNotification(allTokens, title, message, { type });
    }
  },

  async notifyFriends(userId: string, title: string, body: string, type: NotificationType, data?: Record<string, any>) {
    try {
      const { FriendModel } = await import("../friends/friend.models");
      const { FriendStatus } = await import("../friends/friend.interface");

      const relations = await FriendModel.find({
        $or: [{ requester: userId }, { recipient: userId }],
        status: FriendStatus.ACCEPTED
      }).populate("requester recipient", "_id fcmTokens");

      if (!relations.length) return;

      const friendsToNotify = relations.map(r => {
        return r.requester._id.toString() === userId.toString() ? r.recipient : r.requester;
      });

      const notificationsToSave = friendsToNotify.map(friend => ({
        user: friend._id,
        title,
        description: body,
        type,
        isRead: false,
        ...(data ? { data } : {}),
      }));

      const savedNotifications = await notificationModel.insertMany(notificationsToSave);

      const allTokens: string[] = [];
      let io: any;
      try {
        io = getIo();
      } catch (err) { }

      for (let idx = 0; idx < friendsToNotify.length; idx++) {
        const friend = friendsToNotify[idx] as any;
        if (!friend) continue;

        const friendIdStr = friend._id.toString();
        let isOnline = false;

        if (io) {
          const sockets = await io.in(friendIdStr).fetchSockets();
          if (sockets.length > 0) {
            isOnline = true;
            io.to(friendIdStr).emit("notification:new", savedNotifications[idx]);
          }
        }

        if (!isOnline && friend.fcmTokens && Array.isArray(friend.fcmTokens)) {
          allTokens.push(...friend.fcmTokens);
        }
      }

      if (allTokens.length > 0) {
        await sendPushNotification(allTokens, title, body, { type, ...data });
      }
    } catch (error) {
      console.error(" Failed in notifyFriends:", error);
    }
  }
};
