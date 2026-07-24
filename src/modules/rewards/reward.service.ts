import mongoose from "mongoose";
import { Request } from "express";
import CustomError from "../../helpers/CustomError";
import { deleteCloudinary, uploadCloudinary } from "../../helpers/cloudinary";
import { paginationHelper } from "../../utils/pagination";
import { userModel } from "../usersAuth/user.models";
import {
  PointTransactionSource,
  PointTransactionType,
} from "../points/point.interface";
import { pointTransactionModel } from "../points/point.models";
import {
  IRedemption,
  IRewardItem,
  RedemptionStatus,
  RewardCategory,
  RewardItemType,
} from "./reward.interface";
import { redemptionModel, rewardItemModel } from "./reward.models";
import { rewardValidation } from "./reward.validation";
import { notificationService } from "../notifications/notification.service";
import { NotificationType } from "../notifications/notification.interface";

const deleteCloudinaryQuietly = async (publicId?: string): Promise<void> => {
  if (!publicId) return;
  try {
    await deleteCloudinary(publicId);
  } catch (error) {
    console.error(`[Cloudinary] Failed to delete ${publicId}:`, error);
  }
};

export const rewardService = {
    async createRewardItem(req: Request): Promise<IRewardItem> {
    const data = req.body;
    const image = req.file;

    // Validation
    if (data.type === RewardItemType.PRODUCT && !data.stock) {
      throw new CustomError(400, "Stock is required for product");
    }
    
    // Require image for products
    if (!image && data.type === RewardItemType.PRODUCT) {
      throw new CustomError(400, "Reward item photo is required");
    }

    // Safely handle image upload
    let photo = undefined;
    if (image) {
      photo = await uploadCloudinary(image.path);
    }

    try {
      const reward = await rewardItemModel.create({
        ...data,
        photo, // Note: This will fail if photo is undefined and required in Model
      });
      return reward;
    } catch (error) {
      if (photo) await deleteCloudinaryQuietly(photo.public_id);
      throw error;
    }
  },


  async getAllRewardItems(req: Request) {
    const {
      page: pagebody,
      limit: limitbody,
      category,
      type,
      search,
      isActive,
      from,
      to,
      sort,
      sortBy,
    } = req.query;
    const { page, limit, skip } = paginationHelper(
      pagebody as string,
      limitbody as string,
    );

    const filter: any = {};
    if (category) filter.category = category as RewardCategory;
    if (type) filter.type = type as RewardItemType;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (search) {
      filter.title = { $regex: search, $options: "i" };
    }

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from as string);
      if (to) {
        const toDate = new Date(to as string);
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }

    const sortFields: Record<string, string> = {
      name: "title",
      title: "title",
      date: "createdAt",
      points: "points",
      stock: "stock",
    };
    const sortByValue = typeof sortBy === "string" ? sortBy : "date";
    const sortField = sortFields[sortByValue.toLowerCase()] ?? "createdAt";
    const sortOrder = sort === "ascending" ? 1 : -1;

    const [rewards, total] = await Promise.all([
      rewardItemModel.find(filter).sort({ [sortField]: sortOrder }).skip(skip).limit(limit),
      rewardItemModel.countDocuments(filter),
    ]);

    return {
      rewards,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getRewardItemById(rewardId: string): Promise<IRewardItem> {
    const reward = await rewardItemModel.findById(rewardId);
    if (!reward) throw new CustomError(404, "Reward item not found");
    return reward;
  },

  async updateRewardItem(req: Request): Promise<IRewardItem> {
    const { rewardId } = req.params;
    const data = req.body;
    const image = req.file;

    const reward = await rewardItemModel.findById(rewardId);
    if (!reward) throw new CustomError(404, "Reward item not found");

    const oldPublicId = image ? reward.photo?.public_id : undefined;
    let newPhoto;

    if (image) {
      newPhoto = await uploadCloudinary(image.path);
      reward.photo = newPhoto;
    }

    Object.assign(reward, data);

    try {
      await reward.save();
      if (oldPublicId) await deleteCloudinaryQuietly(oldPublicId);
      return reward;
    } catch (error) {
      if (newPhoto) await deleteCloudinaryQuietly(newPhoto.public_id);
      throw error;
    }
  },

  async deleteRewardItem(rewardId: string): Promise<boolean> {
    const reward = await rewardItemModel.findById(rewardId);
    if (!reward) throw new CustomError(404, "Reward item not found");

    await reward.deleteOne();
    await deleteCloudinaryQuietly(reward.photo?.public_id);
    return true;
  },

  async redeemRewardItem(req: Request) {
    const userId = req.user?._id;
    const { rewardId } = req.params;

    if (!userId) throw new CustomError(401, "Unauthorized access");

    const reward = await rewardItemModel.findById(rewardId);
    if (!reward) throw new CustomError(404, "Reward item not found");
    if (!reward.isActive) throw new CustomError(400, "This reward is not active");
    if (reward.stock <= 0) {
      throw new CustomError(400, "Out of stock");
    }

    const user = await userModel.findById(userId);
    if (!user) throw new CustomError(404, "User not found");
    if (user.pointsBalance < reward.points) {
      throw new CustomError(400, "Insufficient points balance");
    }

    const session = await mongoose.startSession();
    try {
      let result: any;
      await session.withTransaction(async () => {
        // Deduct points from user
        const updatedUser = await userModel.findByIdAndUpdate(
          userId,
          { $inc: { pointsBalance: -reward.points } },
          { returnDocument: 'after', session },
        );

        if (!updatedUser) throw new CustomError(404, "User not found");

        // Create point transaction
        const transaction = await pointTransactionModel.create(
          [
            {
              user: userId,
              type: PointTransactionType.REDEEM,
              source: PointTransactionSource.REWARD_ITEM,
              points: -reward.points,
              note: `Récompense réclamée : ${reward.title}`,
            },
          ],
          { session },
        );

        // Create redemption record
        const redemption = await redemptionModel.create(
          [
            {
              user: userId,
              rewardItem: reward._id,
              pointsAtRedemption: reward.points,
              status: RedemptionStatus.PENDING,
            },
          ],
          { session },
        );

        // Update stock
        reward.stock -= 1;
        await reward.save({ session });

        if (!redemption || !redemption[0]) {
          throw new CustomError(500, "Failed to create redemption record");
        }

        const redemptionData = redemption[0].toObject();
        delete redemptionData.giftCardCode;

        result = {
          redemption: redemptionData,
          transaction: transaction[0],
          balance: updatedUser.pointsBalance,
        };
      });
      return result;
    } finally {
      await session.endSession();
    }
  },

  async getMyRedemptions(req: Request): Promise<IRedemption[]> {
    const userId = req.user?._id;
    if (!userId) throw new CustomError(401, "Unauthorized access");

    const redemptions = await redemptionModel
      .find({ user: userId })
      .populate("rewardItem")
      .select("-giftCardCode")
      .sort({ createdAt: -1 });
    return redemptions;
  },

  async getAllRedemptions(req: Request) {
    const {
      page: pagebody,
      limit: limitbody,
      status,
      search,
      from,
      to,
      sort,
      sortBy,
    } = req.query;

    const { page, limit, skip } = paginationHelper(
      pagebody as string,
      limitbody as string,
    );

    const filter: any = {};
    if (status) {
      if (!Object.values(RedemptionStatus).includes(status as RedemptionStatus)) {
        throw new CustomError(
          400,
          `Invalid status parameter. Allowed values are: ${Object.values(RedemptionStatus).join(", ")}`,
        );
      }
      filter.status = status as RedemptionStatus;
    }

    if (sort && !["ascending", "descending"].includes(sort as string)) {
      throw new CustomError(
        400,
        "Invalid sort. Allowed values are: ascending, descending",
      );
    }

    if (sortBy && !["date", "points", "status"].includes(sortBy as string)) {
      throw new CustomError(
        400,
        "Invalid sortBy. Allowed values are: date, points, status",
      );
    }

    if (search) {
      const users = await userModel
        .find({
          $or: [
            { firstName: { $regex: search as string, $options: "i" } },
            { lastName: { $regex: search as string, $options: "i" } },
          ],
        })
        .select("_id")
        .lean();
      filter.user = { $in: users.map((u) => u._id) };
    }

    if (from || to) {
      const isValidDate = (date: any) => {
        const parsedDate = new Date(date);
        return !Number.isNaN(parsedDate.getTime());
      };

      if (from && !isValidDate(from)) {
        throw new CustomError(400, "Invalid 'from' date. Format must be YYYY-MM-DD or ISO");
      }
      if (to && !isValidDate(to)) {
        throw new CustomError(400, "Invalid 'to' date. Format must be YYYY-MM-DD or ISO");
      }

      filter.createdAt = {};
      if (from) {
        const fromDate = new Date(from as string);
        fromDate.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to as string);
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }

    const sortFields: Record<string, string> = {
      date: "createdAt",
      points: "pointsAtRedemption",
      status: "status",
    };
    const sortByValue = typeof sortBy === "string" ? sortBy : "date";
    const sortField = sortFields[sortByValue.toLowerCase()] ?? "createdAt";
    const sortOrder = sort === "ascending" ? 1 : -1;

    const [redemptions, total] = await Promise.all([
      redemptionModel
        .find(filter)
        .populate("user", "firstName lastName email phone address provider")
        .populate("rewardItem")
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      redemptionModel.countDocuments(filter),
    ]);

    return {
      redemptions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async updateRedemptionStatus(req: Request): Promise<IRedemption> {
    const { redemptionId } = req.params;
    const { status, giftCardCode } = req.body;

    const session = await mongoose.startSession();
    try {
      let updatedRedemption: any;
      await session.withTransaction(async () => {
        const redemption = await redemptionModel.findById(redemptionId).session(session);
        if (!redemption) throw new CustomError(404, "Redemption not found");

        //if status is completed then 
        if (redemption.status === RedemptionStatus.COMPLETED) {
          throw new CustomError(400, "Redemption is already completed");
        }

        //if status is cancelled then 
        if (redemption.status === RedemptionStatus.CANCELLED) {
          throw new CustomError(400, "Redemption is already cancelled");
        }

        const previousStatus = redemption.status;
        const newStatus = status as RedemptionStatus;

        // Fetch reward item to check type
        const reward = await rewardItemModel.findById(redemption.rewardItem).session(session);
        if (!reward) throw new CustomError(404, "Associated reward item not found");

        if (newStatus === RedemptionStatus.EMAIL_SENT && reward.type !== RewardItemType.GIFTCARD) {
          throw new CustomError(400, "Status 'email_sent' is only allowed for gift cards");
        }

        if (newStatus === RedemptionStatus.SHIPPED && reward.type === RewardItemType.GIFTCARD) {
          throw new CustomError(400, "Status 'shipped' is not allowed for gift cards. Use 'email_sent' instead");
        }

        if (status) redemption.status = newStatus;
        if (giftCardCode) redemption.giftCardCode = giftCardCode;

        // If status changed to CANCELLED, refund points and restore stock
        if (newStatus === RedemptionStatus.CANCELLED) {
          // 1. Refund points to user
          const updatedUser = await userModel.findByIdAndUpdate(
            redemption.user,
            { $inc: { pointsBalance: redemption.pointsAtRedemption } },
            { session, returnDocument: 'after' }
          );

          if (!updatedUser) throw new CustomError(404, "User not found for point refund");

          // 2. Create point transaction for refund
          await pointTransactionModel.create(
            [
              {
                user: redemption.user,
                type: PointTransactionType.EARN,
                source: PointTransactionSource.REWARD_ITEM,
                points: redemption.pointsAtRedemption,
                note: `Remboursement pour réclamation annulée : ${redemptionId}`,
              },
            ],
            { session }
          );

          // 3. Restore stock of the reward item
          await rewardItemModel.findByIdAndUpdate(
            redemption.rewardItem,
            { $inc: { stock: 1 } },
            { session }
          );
        }

        await redemption.save({ session });
        updatedRedemption = redemption;
      });

      // Send notifications (outside transaction, fire & forget)
      if (status) {
        const userId = updatedRedemption.user.toString();
        const newStatus = status as RedemptionStatus;
        let title = "";
        let body = "";

        if (newStatus === RedemptionStatus.SHIPPED) {
          title = "Récompense expédiée !";
          body = "Bonne nouvelle ! Votre récompense a été expédiée et est en route.";
        } else if (newStatus === RedemptionStatus.DELIVERED) {
          title = "Récompense livrée !";
          body = "Votre récompense a été livrée. Profitez-en bien !";
        } else if (newStatus === RedemptionStatus.EMAIL_SENT) {
          title = "Carte cadeau envoyée !";
          body = "Bonne nouvelle ! Votre code de carte cadeau a été envoyé par e-mail. Vérifiez votre boîte de réception !";
        } else if (newStatus === RedemptionStatus.CANCELLED) {
          title = "Échange refusé";
          body = "Votre demande d'échange de récompense a été refusée. Les points ont été remboursés sur votre solde.";
        }

        if (title && body) {
          notificationService.notifySingleUser(userId, title, body, NotificationType.REWARD_UPDATE)
            .catch(err => console.error("[Notification Error] Failed to notify user of reward status change:", err));
        }
      }

      return updatedRedemption;
    } finally {
      await session.endSession();
    }
  },
};
