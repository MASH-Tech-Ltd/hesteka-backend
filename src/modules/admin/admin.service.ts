import mongoose from "mongoose";
import { userModel } from "../usersAuth/user.models";
import { reportModel } from "../reports/report.models";
import { donationModel } from "../donation/donation.models";
import { donationProofModel } from "../donationProofs/donationProof.models";
import { pointTransactionModel } from "../points/point.models";
import { adminConfigModel } from "./admin.models";
import {
  status as UserStatus,
  role as UserRole,
} from "../usersAuth/user.interface";
import { ReportStatus } from "../reports/report.interface";
import { DonationProofStatus } from "../donationProofs/donationProof.interface";
import {
  PointTransactionType,
  PointTransactionSource,
} from "../points/point.interface";
import { UpdateAdminConfigPayload } from "./admin.interface";
import CustomError from "../../helpers/CustomError";
import { paymentModel } from "../payment/payment.models";
import { localMissionModel } from "../localMissions/localMission.models";
import { localMissionParticipationModel } from "../localMissions/localMissionParticipation.models";
import {
  LocalMissionStatus,
  LocalMissionParticipationStatus,
} from "../localMissions/localMission.interface";
import { partnerAdModel } from "../partnerAds/partnerAd.models";
import { rewardItemModel, redemptionModel } from "../rewards/reward.models";
import { getOnlineUsersCount } from "../../socket/server";
import { SupportMessageModel } from "../supportMessages/supportMessage.models";
import { SupportMessageStatus } from "../supportMessages/supportMessage.interface";

export const adminService = {
  async getStats() {
    const now = new Date();

    // Current Month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    // Last Month
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999,
    );

    // Last Week
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      newUsersThisWeek,
      totalReports,
      resolvedReports,
      pendingReports,
      reportBreakdown,
      reportsForMap,
      donationsThisMonth,
      donationsLastMonth,
      pointsEarnedThisMonth,
      pointsRedeemedThisMonth,
      pendingPointsFromDonations,
      pendingDonationProofs,
      totalPartners,
      activePartners,
      pendingPartners,
      totalMissions,
      activeMissions,
      recentReports,
      recentUsers,
      recentDonations,
      recentDonationProofs,
      inProgressMissions,
      totalDonors,
      pendingSupportMessages,
      config,
    ] = await Promise.all([
      // Users
      userModel.countDocuments(),
      userModel.countDocuments({ status: UserStatus.ACTIVE }),
      userModel.countDocuments({ createdAt: { $gte: lastWeek } }),

      // Reports
      reportModel.countDocuments(),
      reportModel.countDocuments({
        status: { $in: [ReportStatus.FOUND, ReportStatus.RESCUED] },
      }),
      reportModel.countDocuments({
        status: { $in: [ReportStatus.LOST, ReportStatus.SIGHTED] },
      }),
      reportModel.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      reportModel
        .find({
          status: { $in: [ReportStatus.LOST, ReportStatus.SIGHTED] },
          "location.coordinates": { $ne: [0, 0] },
        })
        .sort({ createdAt: -1 })
        .select(
          "location status animalName species breed gender age title images description author eventDate",
        )
        .populate("author", "firstName lastName profileImage")
        .limit(5),

      // Donations (This Month vs Last Month)
      donationModel.aggregate([
        { $match: { createdAt: { $gte: startOfMonth, $lte: endOfMonth } } },
        {
          $lookup: {
            from: "payments",
            localField: "payment",
            foreignField: "_id",
            as: "paymentInfo",
          },
        },
        { $unwind: { path: "$paymentInfo", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            realStatus: {
              $cond: {
                if: "$paymentInfo",
                then: "$paymentInfo.status",
                else: "$status",
              },
            },
          },
        },
        { $match: { realStatus: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      donationModel.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
          },
        },
        {
          $lookup: {
            from: "payments",
            localField: "payment",
            foreignField: "_id",
            as: "paymentInfo",
          },
        },
        { $unwind: { path: "$paymentInfo", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            realStatus: {
              $cond: {
                if: "$paymentInfo",
                then: "$paymentInfo.status",
                else: "$status",
              },
            },
          },
        },
        { $match: { realStatus: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      // Points
      pointTransactionModel.aggregate([
        {
          $match: {
            type: PointTransactionType.EARN,
            createdAt: { $gte: startOfMonth },
          },
        },
        { $group: { _id: null, total: { $sum: "$points" } } },
      ]),
      pointTransactionModel.aggregate([
        {
          $match: {
            type: PointTransactionType.REDEEM,
            createdAt: { $gte: startOfMonth },
          },
        },
        { $group: { _id: null, total: { $sum: { $abs: "$points" } } } },
      ]),
      // Pending Points from Donation Proofs
      donationProofModel.aggregate([
        { $match: { status: DonationProofStatus.PENDING } },
        { $group: { _id: null, total: { $sum: "$pointsAwarded" } } },
      ]),
      donationProofModel.countDocuments({
        status: DonationProofStatus.PENDING,
      }),

      // Partners
      userModel.countDocuments({ role: UserRole.PARTNERS }),
      userModel.countDocuments({
        role: UserRole.PARTNERS,
        status: UserStatus.ACTIVE,
      }),
      userModel.countDocuments({
        role: UserRole.PARTNERS,
        status: UserStatus.PENDING,
      }),

      // Missions
      localMissionModel.countDocuments(),
      localMissionModel.countDocuments({ status: "active" }),

      // Activity Feed Data
      reportModel
        .find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("author", "firstName lastName"),
      userModel.find().sort({ createdAt: -1 }).limit(10),
      donationModel.aggregate([
        { $match: { method: { $ne: "collection_point" } } },
        {
          $lookup: {
            from: "payments",
            localField: "payment",
            foreignField: "_id",
            as: "paymentInfo",
          },
        },
        { $unwind: { path: "$paymentInfo", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            realStatus: {
              $cond: {
                if: "$paymentInfo",
                then: "$paymentInfo.status",
                else: "$status",
              },
            },
          },
        },
        { $match: { realStatus: "completed" } },
        { $sort: { createdAt: -1 } },
        { $limit: 10 },
      ]),
      donationProofModel
        .find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("collectionPoint", "title")
        .populate("user", "firstName lastName"),

      // Missions detail stats for global
      localMissionParticipationModel.countDocuments({
        status: LocalMissionParticipationStatus.PENDING,
      }),
      donationModel.distinct("donorName").then((res) => res.length),

      // Support Messages
      SupportMessageModel.countDocuments({
        status: { $in: [SupportMessageStatus.PENDING, "pending", "PENDING"] },
      }),

      // Config
      this.getConfig(),
    ]);

    const collectedThisMonth = donationsThisMonth[0]?.total || 0;
    const collectedLastMonth = donationsLastMonth[0]?.total || 0;
    const donationGrowth = collectedThisMonth - collectedLastMonth;

    // Format Breakdown
    const breakdownObj: any = {};
    reportBreakdown.forEach((b: any) => {
      breakdownObj[b._id] = b.count;
    });

    // Format Activity
    const activity: any[] = [];
    recentReports.forEach((r: any) =>
      activity.push({
        type: "report",
        text: `${r.animalName || r.species} \u2014 ${r.status} report, ${r.location?.address?.split(",")[0] || "Unknown"}`,
        time: r.createdAt,
        user: `${r.author?.firstName || "User"} ${r.author?.lastName || ""}`,
      }),
    );
    recentUsers.forEach((u: any) =>
      activity.push({
        type: "user",
        text: `${u.firstName} ${u.lastName} \u2014 just registered`,
        time: u.createdAt,
      }),
    );
    recentDonations.forEach((d: any) => {
      activity.push({
        type: "donation",
        text: `${d.amount}\u20AC donation received \u2013 ${d.method || "Stripe"}`,
        time: d.createdAt,
        user: d.donorName,
      });
    });

    recentDonationProofs.forEach((p: any) => {
      const qty = p.quantity || p.amount || 0;
      const cat = p.category || "item";
      const cpName = p.collectionPoint?.title || "HESTEKA";
      const userName =
        p.donorName ||
        (p.user ? `${p.user.firstName} ${p.user.lastName}` : "Manual Donor");

      activity.push({
        type: "donation", // Keeping blue dot per original design
        text: `${qty}x ${cat} support proof received \u2013 ${cpName}`,
        time: p.createdAt,
        user: userName,
      });
    });
    activity.sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
    );

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        online: getOnlineUsersCount(),
        newThisWeek: newUsersThisWeek,
      },
      reports: {
        total: totalReports,
        resolved: resolvedReports,
        pending: pendingReports,
        resolutionRate:
          totalReports > 0
            ? Math.round((resolvedReports / totalReports) * 100)
            : 0,
        breakdown: {
          lost: breakdownObj[ReportStatus.LOST] || 0,
          found: breakdownObj[ReportStatus.FOUND] || 0,
          sheltered: breakdownObj[ReportStatus.RESCUED] || 0,
          injured: breakdownObj[ReportStatus.SIGHTED] || 0,
        },
        map: reportsForMap.map((r: any) => ({
          id: r._id,
          lat: r.location?.coordinates[1],
          lng: r.location?.coordinates[0],
          type: r.status,
          title: r.animalName || r.species,
          breed: r.breed,
          gender: r.gender,
          age: r.age,
          images: r.images,
          description: r.description,
          eventDate: r.eventDate,
          author: {
            name: `${r.author?.firstName || "User"} ${r.author?.lastName || ""}`.trim(),
            image: r.author?.profileImage?.secure_url,
          },
          address: r.location?.address,
        })),
      },
      donations: {
        collectedThisMonth,
        growth: donationGrowth,
        growthText: `${donationGrowth >= 0 ? "+" : ""}${donationGrowth}€ this month`,
      },
      points: {
        totalEarnedThisMonth: pointsEarnedThisMonth[0]?.total || 0,
        totalRedeemedThisMonth: pointsRedeemedThisMonth[0]?.total || 0,
        pending: pendingPointsFromDonations[0]?.total || 0,
      },
      donationProofs: {
        pending: pendingDonationProofs,
      },
      partners: {
        total: totalPartners,
        active: activePartners,
        pending: pendingPartners,
      },
      missions: {
        total: totalMissions,
        active: activeMissions,
        inProgress: inProgressMissions,
      },
      downloads: {
        total: totalUsers * 3, // Mock logic based on users
        growth: 12,
      },
      crowdfunding: {
        totalCollected: config.crowdfundingTotal,
        goalAmount: config.crowdfundingGoal,
        donors: totalDonors || 0,
        percentage:
          config.crowdfundingGoal > 0
            ? Math.min(
                100,
                (config.crowdfundingTotal / config.crowdfundingGoal) * 100,
              )
            : 0,
        left: config.crowdfundingGoal - config.crowdfundingTotal,
      },
      supportMessages: {
        pending: pendingSupportMessages,
      },
      activity: activity.slice(0, 9),
    };
  },

  async getConfig() {
    let config = await adminConfigModel.findOne();
    if (!config) {
      config = await adminConfigModel.create({});
    }
    return config;
  },

  async updateConfig(payload: UpdateAdminConfigPayload) {
    let config = await adminConfigModel.findOne();
    if (!config) {
      config = await adminConfigModel.create(payload);
    } else {
      config = await adminConfigModel.findOneAndUpdate({}, payload, {
        returnDocument: "after",
      });
    }
    return config;
  },

  async getCrowdfundingStats() {
    const config = await this.getConfig();
    return {
      totalCollected: config.crowdfundingTotal,
      goalAmount: config.crowdfundingGoal,
      percentage:
        config.crowdfundingGoal > 0
          ? Math.min(
              100,
              (config.crowdfundingTotal / config.crowdfundingGoal) * 100,
            )
          : 0,
    };
  },

  async approveReportPoints(reportId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Get the report
      const report = await reportModel.findById(reportId).session(session);
      if (!report) {
        throw new CustomError(404, "Report not found");
      }

      // 2. Check if already approved
      if (report.isPointApproved) {
        throw new CustomError(
          400,
          "Points for this report have already been approved",
        );
      }

      // 3. Get point value from config
      const config = await this.getConfig();
      const pointsToAdd = config.pointsPerReport || 10;

      // 4. Update user balance
      const user = await userModel.findByIdAndUpdate(
        report.author,
        { $inc: { pointsBalance: pointsToAdd } },
        { session, returnDocument: "after" },
      );

      if (!user) {
        throw new CustomError(404, "User (author) not found");
      }

      // 5. Create transaction
      await pointTransactionModel.create(
        [
          {
            user: report.author,
            type: PointTransactionType.EARN,
            source: PointTransactionSource.ANIMAL_REPORT,
            points: pointsToAdd,
            note: `Reward for report: ${report.title || report.animalName}`,
          },
        ],
        { session },
      );

      // 6. Mark report as approved
      report.isPointApproved = true;
      await report.save({ session });

      await session.commitTransaction();

      // Fire & Forget Notification
      import("../notifications/notification.service").then(
        ({ notificationService }) => {
          import("../notifications/notification.interface").then(
            ({ NotificationType }) => {
              notificationService
                .notifySingleUser(
                  report.author.toString(),
                  "Points approuvés !",
                  `Félicitations ! Vous avez gagné ${pointsToAdd} points pour votre signalement "${report.title || report.animalName}".`,
                  NotificationType.POINTS_EARNED,
                )
                .catch((err) => console.error("Notification Error:", err));
            },
          );
        },
      );

      return {
        pointsAwarded: pointsToAdd,
        newBalance: user.pointsBalance,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  },

  async getUserStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, active, suspended, newThisMonth, pendingPartners] =
      await Promise.all([
        userModel.countDocuments(),
        userModel.countDocuments({ status: UserStatus.ACTIVE }),
        userModel.countDocuments({ status: { $in: ["blocked", "banned"] } }),
        userModel.countDocuments({ createdAt: { $gte: startOfMonth } }),
        userModel.countDocuments({
          role: UserRole.PARTNERS,
          status: UserStatus.PENDING,
        }),
      ]);
    return { total, active, suspended, newThisMonth, pendingPartners };
  },

  async getReportStats() {
    const [total, resolved, lost, sighted] = await Promise.all([
      reportModel.countDocuments(),
      reportModel.countDocuments({
        status: { $in: [ReportStatus.FOUND, ReportStatus.RESCUED] },
      }),
      reportModel.countDocuments({ status: ReportStatus.LOST }),
      reportModel.countDocuments({ status: ReportStatus.SIGHTED }),
    ]);
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, resolved, lost, sighted, resolutionRate };
  },

  async getPartnerStats() {
    const [total, active, pending] = await Promise.all([
      userModel.countDocuments({ role: UserRole.PARTNERS }),
      userModel.countDocuments({
        role: UserRole.PARTNERS,
        status: UserStatus.ACTIVE,
      }),
      userModel.countDocuments({
        role: UserRole.PARTNERS,
        status: UserStatus.PENDING,
      }),
    ]);
    return { total, active, pending };
  },

  async getMissionStats() {
    const [all, active, inProgress, finished, points] = await Promise.all([
      localMissionModel.countDocuments(),
      localMissionModel.countDocuments({ status: LocalMissionStatus.ACTIVE }),
      localMissionParticipationModel.countDocuments({
        status: LocalMissionParticipationStatus.PENDING,
      }),
      localMissionParticipationModel.countDocuments({
        status: LocalMissionParticipationStatus.COMPLETED,
      }),
      localMissionParticipationModel.aggregate([
        { $match: { status: LocalMissionParticipationStatus.COMPLETED } },
        { $group: { _id: null, total: { $sum: "$pointsAwarded" } } },
      ]),
    ]);

    return {
      all,
      active,
      inProgress,
      toCome: active, // Current logic: active missions are to come
      finished,
      pointsAttributed: points[0]?.total || 0,
    };
  },

  async getDonationStats() {
    const [stats] = await donationModel.aggregate([
      {
        $lookup: {
          from: "payments",
          localField: "payment",
          foreignField: "_id",
          as: "paymentInfo",
        },
      },
      { $unwind: { path: "$paymentInfo", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          realStatus: {
            $cond: {
              if: "$paymentInfo",
              then: "$paymentInfo.status",
              else: "$status",
            },
          },
        },
      },
      {
        $facet: {
          completedStats: [
            { $match: { realStatus: "completed" } },
            {
              $group: {
                _id: null,
                totalCollected: { $sum: "$amount" },
                avgBasket: { $avg: "$amount" },
              },
            },
          ],
          pendingStats: [
            { $match: { realStatus: "pending" } },
            {
              $group: {
                _id: null,
                totalPending: { $sum: "$amount" },
              },
            },
          ],
        },
      },
    ]);

    const completed = stats.completedStats[0] || {
      totalCollected: 0,
      avgBasket: 0,
    };
    const pending = stats.pendingStats[0] || { totalPending: 0 };

    return {
      totalCollected: completed.totalCollected,
      pendingAmount: pending.totalPending,
      averageBasket: completed.avgBasket,
      returnedToAsso: completed.totalCollected * 0.9,
    };
  },

  async getPhysicalItemStats() {
    const [totalItems, totalRedemptions, pendingRedemptions] =
      await Promise.all([
        rewardItemModel.countDocuments(),
        redemptionModel.countDocuments(),
        redemptionModel.countDocuments({ status: "pending" }),
      ]);
    return { totalItems, totalRedemptions, pendingRedemptions };
  },

  async getCollectionPointStats() {
    const total = await partnerAdModel.countDocuments({
      type: "collection_point",
    });
    return { total };
  },

  async getAnalytics() {
    const now = new Date();
    const months: { month: string; date: Date; count: number }[] = [];
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    // Get last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        month: monthNames[d.getMonth()]!,
        date: d,
        count: 0,
      });
    }

    const startOfPeriod = months[0]?.date || now;

    const reportStats = await reportModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfPeriod },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    // Map stats to months array
    months.forEach((m) => {
      const stat = reportStats.find(
        (s) => s._id.month - 1 === monthNames.indexOf(m.month),
      );
      if (stat) m.count = stat.count;
    });

    // Mock data for other metrics as requested in screenshot
    return {
      overview: {
        sessionsMonth: { value: 8420, trend: 10 },
        retention: { value: 67, trend: -5 },
        avgDuration: "4m32s",
        conversion: 12,
      },
      reportsPerMonth: months.map((m) => ({ name: m.month, reports: m.count })),
      activeZones: [
        {
          name: "Provence-Alpes-Côte d'Azur",
          percentage: 38,
          color: "bg-orange-600",
        },
        { name: "Île-de-France", percentage: 24, color: "bg-green-600" },
        { name: "Occitanie", percentage: 18, color: "bg-blue-600" },
        {
          name: "Auvergne-Rhône-Alpes",
          percentage: 12,
          color: "bg-purple-600",
        },
      ],
    };
  },
};
