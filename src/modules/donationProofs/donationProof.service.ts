import { Request } from "express";
import CustomError from "../../helpers/CustomError";
import { uploadCloudinary } from "../../helpers/cloudinary";
import { paginationHelper } from "../../utils/pagination";
import { userModel } from "../usersAuth/user.models";
import { pointTransactionModel } from "../points/point.models";
import { pointConfigModel } from "../points/pointConfig.models";
import { PointTransactionSource, PointTransactionType } from "../points/point.interface";
import { donationProofModel } from "./donationProof.models";
import {
  DonationCategory,
  DonationProofStatus,
  RefusalReason,
  SubmitDonationProofPayload,
  ValidateDonationProofPayload,
} from "./donationProof.interface";
import { notificationService } from "../notifications/notification.service";
import { NotificationType } from "../notifications/notification.interface";
import { partnerAdModel } from "../partnerAds/partnerAd.models";

import { donationService } from "../donation/donation.service";
import { getIo } from "../../socket/server";

export const donationProofService = {
  async submitProof(req: Request) {
    const userId = req.user?._id;
    const data = req.body;

    // Admin or authenticated user check
    if (!userId && !data.donorEmail) {
      throw new CustomError(401, "User ID or Donor Email is required");
    }

    const file = req.file;
    if (!file) {
      throw new CustomError(400, "Donation slip photo is required");
    }

    const photoResult = await uploadCloudinary(file.path);

    const valAmount = data.amount ? Number(data.amount) : undefined;
    const valQuantity = data.quantity ? Number(data.quantity) : undefined;
    const finalQuantity = valQuantity ?? valAmount ?? 0;
    const finalAmount = valAmount ?? valQuantity ?? 0;

    const donationProof = await donationProofModel.create({
      ...(userId && { user: userId }),
      ...(data.donorName && { donorName: data.donorName }),
      ...(data.donorEmail && { donorEmail: data.donorEmail }),
      collectionPoint: data.collectionPointId,
      amount: finalAmount,
      quantity: finalQuantity,
      category: data.category,
      photo: {
        public_id: photoResult.public_id,
        secure_url: photoResult.secure_url,
      },
      status: DonationProofStatus.PENDING,
    });

    // Sync with global Donation collection
    let finalDonorEmail = data.donorEmail;
    let finalDonorName = data.donorName;

    if (userId && (!finalDonorEmail || !finalDonorName)) {
      const user = await userModel.findById(userId);
      if (!finalDonorEmail) finalDonorEmail = user?.email;
      if (!finalDonorName) finalDonorName = `${user?.firstName} ${user?.lastName}`;
    }

    await donationService.syncPhysicalDonation({
      amount: finalAmount,
      donorEmail: finalDonorEmail || "unknown",
      donorName: finalDonorName || "Manual Donor",
      status: "pending",
      referenceId: donationProof._id.toString(),
    });

    notificationService.notifyAdmins(
      "Nouvelle preuve de soutien",
      `Une nouvelle preuve de soutien de ${finalAmount} unités a été soumise et nécessite une approbation.`,
      NotificationType.NEW_DONATION
    ).catch(err => console.error("Admin Notification Error:", err));

    try {
      const io = getIo();
      io.emit("donation_proof_new", {
        proofId: donationProof._id,
        donorName: finalDonorName,
        amount: finalAmount
      });
      io.emit("donation_new", {
        method: "collection_point",
        amount: finalAmount,
        donor: finalDonorEmail
      });
    } catch (error) {
      console.error("Socket emit error:", error);
    }

    return donationProof;
  },

  async getPendingProofs(req: Request) {
    const { page: pagebody, limit: limitbody } = req.query;
    const { page, limit, skip } = paginationHelper(pagebody as string, limitbody as string);

    const [proofs, total] = await Promise.all([
      donationProofModel
        .find({ status: DonationProofStatus.PENDING })
        .populate("user", "firstName lastName email")
        .populate("collectionPoint", "title address")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      donationProofModel.countDocuments({ status: DonationProofStatus.PENDING }),
    ]);

    return {
      proofs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getAllProofs(req: Request) {
    const { page: pagebody, limit: limitbody, status, search } = req.query;
    const { page, limit, skip } = paginationHelper(pagebody as string, limitbody as string);

    const filter: any = {};
    if (status && status !== "all") {
      filter.status = status;
    }
    if (search) {
      const searchRegex = new RegExp(search as string, "i");
      filter.$or = [{ donorName: searchRegex }, { donorEmail: searchRegex }];
    }

    const [proofs, total] = await Promise.all([
      donationProofModel
        .find(filter)
        .populate("user", "firstName lastName email")
        .populate("collectionPoint", "title address")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      donationProofModel.countDocuments(filter),
    ]);

    return {
      proofs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getPartnerProofs(req: Request) {
    const userId = req.user?._id;
    if (!userId) throw new CustomError(401, "access denied or session expired ,please login again ");

    const { page: pagebody, limit: limitbody, status, search } = req.query;
    const { page, limit, skip } = paginationHelper(pagebody as string, limitbody as string);

    // 1. Find all collection points belonging to this partner
    const partnerAds = await partnerAdModel.find({ partner: userId, type: "collection_point" }).lean();
    const collectionPointIds = partnerAds.map(ad => ad._id);

    const filter: any = { collectionPoint: { $in: collectionPointIds } };
    if (status && status !== "all") {
      filter.status = status;
    }
    if (search) {
      const searchRegex = new RegExp(search as string, "i");
      filter.$or = [{ donorName: searchRegex }, { donorEmail: searchRegex }];
    }

    const [proofs, total] = await Promise.all([
      donationProofModel
        .find(filter)
        .populate("user", "firstName lastName email")
        .populate("collectionPoint", "title address")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      donationProofModel.countDocuments(filter),
    ]);

    return {
      proofs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async validateProof(proofId: string, payload: ValidateDonationProofPayload) {
    const proof = await donationProofModel.findById(proofId).populate("user");
    if (!proof) throw new CustomError(404, "Donation proof not found");
    if (proof.status !== DonationProofStatus.PENDING) {
      throw new CustomError(400, `Proof is already ${proof.status}`);
    }

    const { pointsAwarded, adminNote, amount } = payload;

    // 1. Update proof status
    proof.status = DonationProofStatus.APPROVED;
    proof.pointsAwarded = pointsAwarded;
    if (adminNote) proof.adminNote = adminNote;
    if (amount !== undefined) proof.amount = amount;
    await proof.save();

    // 2. Award points to user (if registered user)
    if (proof.user) {
      await userModel.findByIdAndUpdate(proof.user, {
        $inc: { pointsBalance: pointsAwarded },
      });

      // 3. Create point transaction
      await pointTransactionModel.create({
        user: proof.user,
        type: PointTransactionType.EARN,
        source: PointTransactionSource.PHYSICAL_DONATION,
        points: pointsAwarded,
        note: `Points earned from physical donation of ${proof.amount}. ${adminNote || ""}`,
      });
    }

    // 4. Update status in global Donation collection
    const donorEmail = proof.donorEmail || (proof.user as any)?.email || "unknown";
    const donorName = proof.donorName ||
      (proof.user ? `${(proof.user as any).firstName} ${(proof.user as any).lastName}` : "Manual Donor");

    await donationService.syncPhysicalDonation({
      amount: proof.amount,
      donorEmail,
      donorName,
      status: "completed",
      referenceId: proof._id.toString(),
    });

    // 5. Notify user (if registered user)
    if (proof.user) {
      await notificationService.notifySingleUser(
        (proof.user as any)._id.toString(),
        "Soutien approuvé !",
        `Votre preuve de soutien de ${proof.amount} a été approuvée. Vous avez gagné ${pointsAwarded} points.`,
        NotificationType.SYSTEM // Or appropriate type
      );
    }

    // 6. Real-time update for admins
    try {
      getIo().emit("donation_validation_updated", { proofId, status: proof.status });
    } catch (error) {
      console.error("Socket error:", error);
    }

    return proof;
  },

  async rejectProof(proofId: string, adminNote: string, refusalReason?: string) {
    const proof = await donationProofModel.findById(proofId).populate("user");
    if (!proof) throw new CustomError(404, "Donation proof not found");
    if (proof.status !== DonationProofStatus.PENDING) {
      throw new CustomError(400, `Proof is already ${proof.status}`);
    }

    proof.status = DonationProofStatus.REJECTED;
    proof.adminNote = adminNote;
    if (refusalReason) proof.refusalReason = refusalReason as any;
    await proof.save();

    // Update status in global Donation collection
    const donorEmail = proof.donorEmail || (proof.user as any)?.email || "unknown";
    const donorName = proof.donorName ||
      (proof.user ? `${(proof.user as any).firstName} ${(proof.user as any).lastName}` : "Manual Donor");

    await donationService.syncPhysicalDonation({
      amount: proof.amount,
      donorEmail,
      donorName,
      status: "cancelled",
      referenceId: proof._id.toString(),
    });

    // Notify user (if registered user)
    if (proof.user) {
      await notificationService.notifySingleUser(
        (proof.user as any)._id.toString(),
        "Preuve de soutien refusée",
        `Votre preuve de soutien a été refusée. Raison : ${adminNote}`,
        NotificationType.SYSTEM
      );
    }

    // Real-time update for admins
    try {
      getIo().emit("donation_validation_updated", { proofId, status: proof.status });
    } catch (error) {
      console.error("Socket error:", error);
    }

    return proof;
  },

  async validateAll() {
    const pendingProofs = await donationProofModel.find({ status: DonationProofStatus.PENDING }).populate("user");

    if (pendingProofs.length === 0) {
      return { message: "No pending proofs to validate", count: 0 };
    }

    const config = await pointConfigModel.findOne();
    const pointsPerDonation = config ? (config.isDoublePointsActive ? config.pointsPerDonation * 2 : config.pointsPerDonation) : 15;
    const adminNote = "Bulk validate by admin";

    const validationPromises = pendingProofs.map(async (proof) => {
      // 1. Update proof status
      proof.status = DonationProofStatus.APPROVED;
      proof.pointsAwarded = pointsPerDonation;
      proof.adminNote = adminNote;
      await proof.save();

      // 2. Award points to user (if registered user)
      if (proof.user) {
        await userModel.findByIdAndUpdate(proof.user, {
          $inc: { pointsBalance: pointsPerDonation },
        });

        // 3. Create point transaction
        await pointTransactionModel.create({
          user: proof.user,
          type: PointTransactionType.EARN,
          source: PointTransactionSource.PHYSICAL_DONATION,
          points: pointsPerDonation,
          note: `Points earned from physical donation of ${proof.amount}. ${adminNote}`,
        });
      }

      // 4. Update status in global Donation collection
      const donorEmail = proof.donorEmail || (proof.user as any)?.email || "unknown";
      const donorName = proof.donorName ||
        (proof.user ? `${(proof.user as any).firstName} ${(proof.user as any).lastName}` : "Manual Donor");

      await donationService.syncPhysicalDonation({
        amount: proof.amount,
        donorEmail,
        donorName,
        status: "completed",
        referenceId: proof._id.toString(),
      });

      // 5. Notify user (if registered user)
      if (proof.user) {
        await notificationService.notifySingleUser(
          (proof.user as any)._id.toString(),
          "Soutien approuvé !",
          `Votre preuve de soutien de ${proof.amount} a été approuvée par validation groupée. Vous avez gagné ${pointsPerDonation} points.`,
          NotificationType.SYSTEM
        );
      }

      return proof._id;
    });

    const results = await Promise.all(validationPromises);

    // Real-time update for admins
    try {
      getIo().emit("donation_validation_updated", { bulk: true, count: results.length });
    } catch (error) {
      console.error("Socket error:", error);
    }

    return {
      message: `Successfully validated ${results.length} donations`,
      count: results.length
    };
  },

  async getValidationStats(period: string = 'monthly') {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfYear = new Date(now.getFullYear(), 0, 1);

    let trendStart: Date;
    let groupId: any;

    if (period === "weekly") {
      trendStart = new Date(now);
      trendStart.setDate(now.getDate() - 6);
      trendStart.setHours(0, 0, 0, 0);
      groupId = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
        category: { $ifNull: ["$category", DonationCategory.OTHER] }
      };
    } else if (period === "yearly") {
      trendStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      groupId = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        category: { $ifNull: ["$category", DonationCategory.OTHER] }
      };
    } else if (period === "lifetime") {
      trendStart = new Date(now.getFullYear() - 4, 0, 1);
      groupId = {
        year: { $year: "$createdAt" },
        category: { $ifNull: ["$category", DonationCategory.OTHER] }
      };
    } else { // monthly (last 6 months)
      trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      groupId = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        category: { $ifNull: ["$category", DonationCategory.OTHER] }
      };
    }

    const [stats] = await donationProofModel.aggregate([
      {
        $facet: {
          pending: [
            { $match: { status: DonationProofStatus.PENDING } },
            { $count: "count" }
          ],
          currentMonthStats: [
            { $match: { createdAt: { $gte: startOfCurrentMonth } } },
            {
              $group: {
                _id: null,
                validated: { $sum: { $cond: [{ $eq: ["$status", DonationProofStatus.APPROVED] }, 1, 0] } },
                refused: { $sum: { $cond: [{ $eq: ["$status", DonationProofStatus.REJECTED] }, 1, 0] } },
                points: { $sum: "$pointsAwarded" }
              }
            }
          ],
          lastMonthStats: [
            { $match: { createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
            {
              $group: {
                _id: null,
                validated: { $sum: { $cond: [{ $eq: ["$status", DonationProofStatus.APPROVED] }, 1, 0] } },
                refused: { $sum: { $cond: [{ $eq: ["$status", DonationProofStatus.REJECTED] }, 1, 0] } }
              }
            }
          ],
          categoryBreakdown: [
            { $match: { createdAt: { $gte: startOfCurrentMonth }, status: DonationProofStatus.APPROVED } },
            { $group: { _id: { $ifNull: ["$category", DonationCategory.OTHER] }, count: { $sum: 1 } } }
          ],
          refusalReasons: [
            { $match: { status: DonationProofStatus.REJECTED } },
            { $group: { _id: "$refusalReason", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
          ],
          weeklyStats: [
            { $match: { createdAt: { $gte: startOfWeek }, status: DonationProofStatus.APPROVED } },
            { $group: { _id: null, totalCount: { $sum: 1 }, totalQuantity: { $sum: { $ifNull: ["$quantity", "$amount", 0] } } } }
          ],
          monthlyStats: [
            { $match: { createdAt: { $gte: startOfCurrentMonth }, status: DonationProofStatus.APPROVED } },
            { $group: { _id: null, totalCount: { $sum: 1 }, totalQuantity: { $sum: { $ifNull: ["$quantity", "$amount", 0] } } } }
          ],
          yearlyStats: [
            { $match: { createdAt: { $gte: startOfYear }, status: DonationProofStatus.APPROVED } },
            { $group: { _id: null, totalCount: { $sum: 1 }, totalQuantity: { $sum: { $ifNull: ["$quantity", "$amount", 0] } } } }
          ],
          lifetimeStats: [
            { $match: { status: DonationProofStatus.APPROVED } },
            { $group: { _id: null, totalCount: { $sum: 1 }, totalQuantity: { $sum: { $ifNull: ["$quantity", "$amount", 0] } } } }
          ],
          categoryTrendRaw: [
            { $match: { createdAt: { $gte: trendStart }, status: DonationProofStatus.APPROVED } },
            {
              $group: {
                _id: groupId,
                totalQuantity: { $sum: { $ifNull: ["$quantity", "$amount", 0] } }
              }
            }
          ]
        }
      }
    ]);

    const pendingCount = stats.pending[0]?.count || 0;
    const current = stats.currentMonthStats[0] || { validated: 0, refused: 0, points: 0 };
    const last = stats.lastMonthStats[0] || { validated: 0, refused: 0 };

    // Calculate growth
    const calculateGrowth = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    const validatedGrowth = calculateGrowth(current.validated, last.validated);
    const refusedGrowth = calculateGrowth(current.refused, last.refused);

    // Format category breakdown - ensure ALL categories are present even if 0
    const categories = Object.values(DonationCategory);
    const totalCurrentMonthApproved = stats.categoryBreakdown.reduce((acc: number, item: any) => acc + item.count, 0);

    const depositsByCategory = categories.map(cat => {
      const found = stats.categoryBreakdown.find((item: any) => item._id === cat);
      return {
        label: cat,
        val: totalCurrentMonthApproved > 0 && found ? Math.round((found.count / totalCurrentMonthApproved) * 100) : 0
      };
    });

    const trendData: any[] = [];
    const monthPrefixes = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

    if (period === "weekly") {
      const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        trendData.push({
          monthLabel: days[d.getDay()],
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          day: d.getDate(),
          food: 0, litter: 0, toys: 0, medicine: 0, other: 0
        });
      }
    } else if (period === "yearly") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        trendData.push({
          monthLabel: monthPrefixes[d.getMonth()],
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          food: 0, litter: 0, toys: 0, medicine: 0, other: 0
        });
      }
    } else if (period === "lifetime") {
      for (let i = 4; i >= 0; i--) {
        const y = now.getFullYear() - i;
        trendData.push({
          monthLabel: y.toString(),
          year: y,
          food: 0, litter: 0, toys: 0, medicine: 0, other: 0
        });
      }
    } else { // monthly
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        trendData.push({
          monthLabel: monthPrefixes[d.getMonth()],
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          food: 0, litter: 0, toys: 0, medicine: 0, other: 0
        });
      }
    }

    stats.categoryTrendRaw?.forEach((item: any) => {
      let monthObj;
      if (period === "weekly") {
        monthObj = trendData.find(m => m.year === item._id.year && m.month === item._id.month && m.day === item._id.day);
      } else if (period === "lifetime") {
        monthObj = trendData.find(m => m.year === item._id.year);
      } else {
        monthObj = trendData.find(m => m.year === item._id.year && m.month === item._id.month);
      }

      if (monthObj) {
        if (monthObj[item._id.category] !== undefined) {
          monthObj[item._id.category] += item.totalQuantity;
        } else {
          monthObj.other += item.totalQuantity;
        }
      }
    });

    return {
      pendingCount,
      validatedThisMonth: current.validated,
      refusedThisMonth: current.refused,
      pointsGranted: current.points,
      validatedGrowth,
      refusedGrowth,
      depositsByCategory,
      refusalReasons: stats.refusalReasons.map((item: any) => ({
        label: item._id,
        count: item.count
      })),
      periodStats: {
        weekly: stats.weeklyStats[0] || { totalCount: 0, totalQuantity: 0 },
        monthly: stats.monthlyStats[0] || { totalCount: 0, totalQuantity: 0 },
        yearly: stats.yearlyStats[0] || { totalCount: 0, totalQuantity: 0 },
        lifetime: stats.lifetimeStats[0] || { totalCount: 0, totalQuantity: 0 }
      },
      categoryTrend: trendData
    };
  },

  async getPartnerValidationStats(req: Request, period: string = 'monthly') {
    const userId = req.user?._id;
    if (!userId) throw new CustomError(401, "access denied or session expired ,please login again ");


    const partnerAds = await partnerAdModel.find({ partner: userId, type: "collection_point" }).lean();
    const collectionPointIds = partnerAds.map(ad => ad._id);
    const matchPartner = { collectionPoint: { $in: collectionPointIds } };

    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfYear = new Date(now.getFullYear(), 0, 1);

    let trendStart: Date;
    let groupId: any;

    if (period === "weekly") {
      trendStart = new Date(now);
      trendStart.setDate(now.getDate() - 6);
      trendStart.setHours(0, 0, 0, 0);
      groupId = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
        category: { $ifNull: ["$category", DonationCategory.OTHER] }
      };
    } else if (period === "yearly") {
      trendStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      groupId = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        category: { $ifNull: ["$category", DonationCategory.OTHER] }
      };
    } else if (period === "lifetime") {
      trendStart = new Date(now.getFullYear() - 4, 0, 1);
      groupId = {
        year: { $year: "$createdAt" },
        category: { $ifNull: ["$category", DonationCategory.OTHER] }
      };
    } else { // monthly (last 6 months)
      trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      groupId = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        category: { $ifNull: ["$category", DonationCategory.OTHER] }
      };
    }

    const [stats] = await donationProofModel.aggregate([
      {
        $facet: {
          pending: [
            { $match: { ...matchPartner, status: DonationProofStatus.PENDING } },
            { $count: "count" }
          ],
          currentMonthStats: [
            { $match: { ...matchPartner, createdAt: { $gte: startOfCurrentMonth } } },
            {
              $group: {
                _id: null,
                validated: { $sum: { $cond: [{ $eq: ["$status", DonationProofStatus.APPROVED] }, 1, 0] } },
                refused: { $sum: { $cond: [{ $eq: ["$status", DonationProofStatus.REJECTED] }, 1, 0] } },
                points: { $sum: "$pointsAwarded" }
              }
            }
          ],
          lastMonthStats: [
            { $match: { ...matchPartner, createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
            {
              $group: {
                _id: null,
                validated: { $sum: { $cond: [{ $eq: ["$status", DonationProofStatus.APPROVED] }, 1, 0] } },
                refused: { $sum: { $cond: [{ $eq: ["$status", DonationProofStatus.REJECTED] }, 1, 0] } }
              }
            }
          ],
          categoryBreakdown: [
            { $match: { ...matchPartner, createdAt: { $gte: startOfCurrentMonth }, status: DonationProofStatus.APPROVED } },
            { $group: { _id: { $ifNull: ["$category", DonationCategory.OTHER] }, count: { $sum: 1 } } }
          ],
          refusalReasons: [
            { $match: { ...matchPartner, status: DonationProofStatus.REJECTED } },
            { $group: { _id: "$refusalReason", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
          ],
          weeklyStats: [
            { $match: { ...matchPartner, createdAt: { $gte: startOfWeek }, status: DonationProofStatus.APPROVED } },
            { $group: { _id: null, totalCount: { $sum: 1 }, totalQuantity: { $sum: { $ifNull: ["$quantity", "$amount", 0] } } } }
          ],
          monthlyStats: [
            { $match: { ...matchPartner, createdAt: { $gte: startOfCurrentMonth }, status: DonationProofStatus.APPROVED } },
            { $group: { _id: null, totalCount: { $sum: 1 }, totalQuantity: { $sum: { $ifNull: ["$quantity", "$amount", 0] } } } }
          ],
          yearlyStats: [
            { $match: { ...matchPartner, createdAt: { $gte: startOfYear }, status: DonationProofStatus.APPROVED } },
            { $group: { _id: null, totalCount: { $sum: 1 }, totalQuantity: { $sum: { $ifNull: ["$quantity", "$amount", 0] } } } }
          ],
          lifetimeStats: [
            { $match: { ...matchPartner, status: DonationProofStatus.APPROVED } },
            { $group: { _id: null, totalCount: { $sum: 1 }, totalQuantity: { $sum: { $ifNull: ["$quantity", "$amount", 0] } } } }
          ],
          categoryTrendRaw: [
            { $match: { ...matchPartner, createdAt: { $gte: trendStart }, status: DonationProofStatus.APPROVED } },
            {
              $group: {
                _id: groupId,
                totalQuantity: { $sum: { $ifNull: ["$quantity", "$amount", 0] } }
              }
            }
          ]
        }
      }
    ]);

    const pendingCount = stats.pending[0]?.count || 0;
    const current = stats.currentMonthStats[0] || { validated: 0, refused: 0, points: 0 };
    const last = stats.lastMonthStats[0] || { validated: 0, refused: 0 };

    // Calculate growth
    const calculateGrowth = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    const validatedGrowth = calculateGrowth(current.validated, last.validated);
    const refusedGrowth = calculateGrowth(current.refused, last.refused);

    // Format category breakdown
    const categories = Object.values(DonationCategory);
    const totalCurrentMonthApproved = stats.categoryBreakdown.reduce((acc: number, item: any) => acc + item.count, 0);

    const depositsByCategory = categories.map(cat => {
      const found = stats.categoryBreakdown.find((item: any) => item._id === cat);
      return {
        label: cat,
        val: totalCurrentMonthApproved > 0 && found ? Math.round((found.count / totalCurrentMonthApproved) * 100) : 0
      };
    });

    const trendData: any[] = [];
    const monthPrefixes = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

    if (period === "weekly") {
      const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        trendData.push({
          monthLabel: days[d.getDay()],
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          day: d.getDate(),
          food: 0, litter: 0, toys: 0, medicine: 0, other: 0
        });
      }
    } else if (period === "yearly") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        trendData.push({
          monthLabel: monthPrefixes[d.getMonth()],
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          food: 0, litter: 0, toys: 0, medicine: 0, other: 0
        });
      }
    } else if (period === "lifetime") {
      for (let i = 4; i >= 0; i--) {
        const y = now.getFullYear() - i;
        trendData.push({
          monthLabel: y.toString(),
          year: y,
          food: 0, litter: 0, toys: 0, medicine: 0, other: 0
        });
      }
    } else { // monthly
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        trendData.push({
          monthLabel: monthPrefixes[d.getMonth()],
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          food: 0, litter: 0, toys: 0, medicine: 0, other: 0
        });
      }
    }

    stats.categoryTrendRaw?.forEach((item: any) => {
      let monthObj;
      if (period === "weekly") {
        monthObj = trendData.find(m => m.year === item._id.year && m.month === item._id.month && m.day === item._id.day);
      } else if (period === "lifetime") {
        monthObj = trendData.find(m => m.year === item._id.year);
      } else {
        monthObj = trendData.find(m => m.year === item._id.year && m.month === item._id.month);
      }

      if (monthObj) {
        if (monthObj[item._id.category] !== undefined) {
          monthObj[item._id.category] += item.totalQuantity;
        } else {
          monthObj.other += item.totalQuantity;
        }
      }
    });

    return {
      pendingCount,
      validatedThisMonth: current.validated,
      refusedThisMonth: current.refused,
      pointsGranted: current.points,
      validatedGrowth,
      refusedGrowth,
      depositsByCategory,
      refusalReasons: stats.refusalReasons.map((item: any) => ({
        label: item._id,
        count: item.count
      })),
      periodStats: {
        weekly: stats.weeklyStats[0] || { totalCount: 0, totalQuantity: 0 },
        monthly: stats.monthlyStats[0] || { totalCount: 0, totalQuantity: 0 },
        yearly: stats.yearlyStats[0] || { totalCount: 0, totalQuantity: 0 },
        lifetime: stats.lifetimeStats[0] || { totalCount: 0, totalQuantity: 0 }
      },
      categoryTrend: trendData
    };
  }
};

