import { userModel } from "../modules/usersAuth/user.models";
import { status } from "../modules/usersAuth/user.interface";
// import { getIo } from "../socket/server";

export enum NotificationType {
  SYSTEM = "system",
}

export const notifyAllUsers = async (title: string, description: string, type: NotificationType = NotificationType.SYSTEM) => {
  try {
    const users = await userModel.find({ status: status.ACTIVE }).select("_id");
    // Socket notifications are disabled for now.
    // const io = getIo();

    if (!users.length) return;

    // users.forEach((user: any) => {
    //   io.to(String(user._id)).emit("notification:new", {
    //     title,
    //     description,
    //     type,
    //   });
    //   io.to(String(user._id)).emit("quiz:updated", {
    //     message: title,
    //     description,
    //   });
    // });

    console.log(`[Notification] Socket disabled. Skipped "${title}" for ${users.length} users.`);
  } catch (error) {
    console.error("[Notification Error] Failed to notify all users:", error);
  }
};
