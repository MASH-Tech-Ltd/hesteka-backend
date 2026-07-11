// modules/user/user.service.ts
import mongoose, { Types } from "mongoose";
import { getOnlineUserIds } from "../../socket/server";
import fs from "fs";
import { userModel } from "./user.models";
import CustomError from "../../helpers/CustomError";
import { deleteCloudinary, uploadCloudinary } from "../../helpers/cloudinary";
import { role, status, UpdateUserPayload } from "./user.interface";
import { paginationHelper } from "../../utils/pagination";
import { mailer } from "../../helpers/nodeMailer";
import {
  partnerApprovalEmailTemplate,
  partnerRejectionEmailTemplate,
} from "../../tempaletes/partner.templates";
import { reportModel } from "../reports/report.models";
import { commentModel } from "../comments/comment.models";
import { storyModel } from "../stories/stories.models";
import { chatModel } from "../community/chat/chat.models";
import { chatLikeModel } from "../community/chatlike/chatlike.models";
import { chatReportModel } from "../community/chatreport/chatreport.models";
import {
  conversationModel,
  privateMessageModel,
} from "../community/privatechat/privatechat.models";
import { localMissionModel } from "../localMissions/localMission.models";
import { localMissionParticipationModel } from "../localMissions/localMissionParticipation.models";
import { partnerAdModel } from "../partnerAds/partnerAd.models";
import { pointTransactionModel } from "../points/point.models";
import { redemptionModel } from "../rewards/reward.models";
import { notificationModel } from "../notifications/notification.models";
import { paymentModel } from "../payment/payment.models";
import { donationModel } from "../donation/donation.models";
import { donationProofModel } from "../donationProofs/donationProof.models";
import { myanimalModel } from "../myanimal/myanimal.models";
import { SupportMessageModel } from "../supportMessages/supportMessage.models";

export const userService = {
  // get unique cities for targeting
  async getUniqueCities() {
    const cities = await userModel.distinct("city", {
      status: "active",
      city: { $nin: [null, ""] },
    });
    return cities;
  },

  // get all user locations
  async getAllLocations() {
    const usersWithLocation = await userModel
      .find({
        "location.coordinates": { $exists: true, $ne: [] },
        role: { $nin: ["admin", "partners"] },
      })
      .select(
        "firstName lastName email role status location profileImage partnerType",
      )
      .lean();

    const onlineIdsArray = getOnlineUserIds();
    const onlineIds = new Set(onlineIdsArray);

    // Find which online users are MISSING from the map
    const usersWithLocationIds = new Set(
      usersWithLocation.map((u) => u._id.toString()),
    );
    const missingOnlineIds = onlineIdsArray.filter(
      (id) => !usersWithLocationIds.has(id),
    );

    let allUsers: any[] = [...usersWithLocation];

    // Fetch missing online users and assign them a default coordinate (Paris, France) so they appear on the Live Map
    if (missingOnlineIds.length > 0) {
      const missingUsers = await userModel
        .find({ _id: { $in: missingOnlineIds }, role: { $nin: ["admin"] } })
        .select("firstName lastName email role status profileImage partnerType")
        .lean();

      const missingUsersWithDefaultLocation = missingUsers.map((u) => ({
        ...u,
        location: {
          type: "Point",
          coordinates: [2.3522, 48.8566], // Default longitude, latitude
        },
      }));

      allUsers = [...allUsers, ...missingUsersWithDefaultLocation];
    }

    const usersWithOnlineStatus = allUsers.map((u) => ({
      ...u,
      isOnline: onlineIds.has(u._id.toString()),
    }));

    return usersWithOnlineStatus;
  },

  //get all users
  async getAllUsers(req: any) {
    const {
      role: roleParam,
      status: statusParam,
      search,
      from,
      to,
      region,
      department,
      partnerType,
      sort,
      sortBy,
      page: pagebody,
      limit: limitbody,
    } = req.query;

    const { page, limit, skip } = paginationHelper(pagebody, limitbody);

    const filter: any = {};

    const allowedRoles = [...Object.values(role), "all"] as const;

    if (roleParam && !allowedRoles.includes(roleParam)) {
      throw new CustomError(
        400,
        `Invalid role "${roleParam}". Allowed roles: ${allowedRoles.join(", ")}`,
      );
    }

    if (!roleParam) {
      filter.role = "user";
    } else if (roleParam !== "all") {
      filter.role = roleParam;
    }

    const allowedStatuses = [...Object.values(status), "all"] as const;

    if (statusParam && !allowedStatuses.includes(statusParam)) {
      throw new CustomError(
        400,
        `Invalid status "${statusParam}". Allowed status: ${allowedStatuses.join(", ")}`,
      );
    }

    if (statusParam && statusParam !== "all") {
      filter.status = statusParam;
    }

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
        { postalCode: { $regex: search, $options: "i" } },
        { "location.address": { $regex: search, $options: "i" } },
      ];
    }

    if (region && region !== "all") {
      filter.region = { $regex: `\\b${region}\\b`, $options: "i" };
    }

    if (department && department !== "all") {
      filter.department = { $regex: `\\b${department}\\b`, $options: "i" };
    }

    if (partnerType && partnerType !== "all") {
      filter.partnerType = partnerType;
    }

    if (from || to) {
      const isValidDate = (date: any) => {
        const parsedDate = new Date(date);
        return !Number.isNaN(parsedDate.getTime());
      };

      if (from && !isValidDate(from)) {
        throw new CustomError(
          400,
          "Invalid 'from' date. Format must be YYYY-MM-DD or ISO",
        );
      }

      if (to && !isValidDate(to)) {
        throw new CustomError(
          400,
          "Invalid 'to' date. Format must be YYYY-MM-DD or ISO",
        );
      }

      if (from && to && new Date(from as string) > new Date(to as string)) {
        throw new CustomError(
          400,
          "'from' date cannot be greater than 'to' date",
        );
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

    if (sort && sort !== "ascending" && sort !== "descending") {
      throw new CustomError(
        400,
        "Invalid sort value. Must be 'ascending' or 'descending'",
      );
    }

    const sortFields: Record<string, string> = {
      name: "firstName",
      email: "email",
      date: "createdAt",
      role: "role",
      status: "status",
      company: "company",
    };
    const sortByValue = typeof sortBy === "string" ? sortBy : "date";
    const sortField = sortFields[sortByValue.toLowerCase()];
    if (!sortField) {
      throw new CustomError(
        400,
        `Invalid sortBy value. Must be one of: ${Object.keys(sortFields).join(", ")}`,
      );
    }
    const sortOrder = sort === "ascending" ? 1 : -1;

    const [users, totalUsers] = await Promise.all([
      userModel
        .find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .select(
          "-password -passwordResetToken -passwordResetExpire -refreshToken -__v -createdAt -updatedAt -emailVerifiedAt -emailVerifiedOtp -verificationOtp -verificationOtpExpire -isDeleted -deletedAt -rememberMe",
        ),
      userModel.countDocuments(filter),
    ]);

    return {
      users,
      meta: {
        page,
        limit,
        totalPages: Math.ceil(totalUsers / limit),
        total: totalUsers,
      },
    };
  },

  //get single user
  async getUser(userId: string) {
    const userDoc = await userModel
      .findOne({ _id: userId })
      .select(
        "-password -passwordResetToken -passwordResetExpire -refreshToken -__v -updatedAt -emailVerifiedAt -emailVerifiedOtp -verificationOtp -verificationOtpExpire -isDeleted -deletedAt -rememberMe",
      );
    if (!userDoc) throw new CustomError(400, "User not found");

    const userObj = userDoc.toJSON() as any;

    const allowedFields = [
      "_id", "firstName", "lastName", "email", "phone", "address", "city", 
      "postalCode", "country", "region", "department", "company", "website", 
      "pointsBalance", "selfIntroduction", "profession", "role", "partnerType", 
      "provider", "profileImage", "status", "isVerified", "fcmTokens", 
      "language", "location", "blockedUsers", "stripeCustomerId", "description", 
      "facebook", "instagram", "twitter", "linkedin", "logo", "partnerImage"
    ];

    allowedFields.forEach((field) => {
      if (userObj[field] === undefined) {
        userObj[field] = null;
      }
    });

    if (!userObj.language) {
      userObj.language = "fr";
    }

    return userObj;
  },

  //get my profile
  async getmyprofile(req: any) {
    const { email } = req?.user as { email: string };
    const userDoc = await userModel
      .findOne({ email: email })
      .select(
        "-password -passwordResetToken -passwordResetExpire -refreshToken -__v -createdAt -updatedAt -emailVerifiedAt -emailVerifiedOtp -verificationOtp -verificationOtpExpire -isDeleted -deletedAt -rememberMe",
      );
    if (!userDoc) throw new CustomError(400, "User not found");

    const userObj = userDoc.toJSON() as any;

    const allowedFields = [
      "_id", "firstName", "lastName", "email", "phone", "address", "city", 
      "postalCode", "country", "region", "department", "company", "website", 
      "pointsBalance", "selfIntroduction", "profession", "role", "partnerType", 
      "provider", "profileImage", "status", "isVerified", "fcmTokens", 
      "language", "location", "blockedUsers", "stripeCustomerId", "description", 
      "facebook", "instagram", "twitter", "linkedin", "logo", "partnerImage"
    ];

    allowedFields.forEach((field) => {
      if (userObj[field] === undefined) {
        userObj[field] = null;
      }
    });

    if (!userObj.language) {
      userObj.language = "fr";
    }

    return userObj;
  },

  //get partner stats
  async getPartnerStats(req: any) {
    const partnerId = req.user?._id;
    if (!partnerId) throw new CustomError(401, "Unauthorized");

    const [
      totalMissions,
      activeMissions,
      totalCollectionPoints,
      activeCollectionPoints,
    ] = await Promise.all([
      localMissionModel.countDocuments({ partner: partnerId }),
      localMissionModel.countDocuments({
        partner: partnerId,
        status: "active",
      }),
      partnerAdModel.countDocuments({ partner: partnerId }),
      partnerAdModel.countDocuments({ partner: partnerId, status: "active" }),
    ]);

    const missions = await localMissionModel
      .find({ partner: partnerId })
      .select("_id");
    const missionIds = missions.map((m) => m._id);

    const [totalParticipants, completedParticipants] = await Promise.all([
      localMissionParticipationModel.countDocuments({
        mission: { $in: missionIds },
      }),
      localMissionParticipationModel.countDocuments({
        mission: { $in: missionIds },
        status: "completed",
      }),
    ]);

    const last6Months = Array.from({ length: 6 })
      .map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        return {
          month: d.getMonth(),
          year: d.getFullYear(),
          name: d.toLocaleString("en-US", { month: "short" }),
        };
      })
      .reverse();

    const participations = await localMissionParticipationModel.aggregate([
      { $match: { mission: { $in: missionIds } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const participationsPerMonth = last6Months.map((m) => {
      const match = participations.find(
        (p) => p._id.year === m.year && p._id.month === m.month + 1,
      );
      return {
        name: m.name,
        participants: match ? match.count : 0,
      };
    });

    return {
      overview: {
        missions: { value: totalMissions, active: activeMissions },
        collectionPoints: {
          value: totalCollectionPoints,
          active: activeCollectionPoints,
        },
        participants: {
          value: totalParticipants,
          completed: completedParticipants,
        },
      },
      participationsPerMonth,
    };
  },

  //update user
  async updateUser(req: any) {
    const { latitude, longitude, locationAddress, ...data } =
      req.body as UpdateUserPayload;
    const { email, role } = req?.user as { email: string; role: string };

    if (data.status) {
      if (role === "admin") {
        if (!Object.values(status).includes(data.status as status)) {
          throw new CustomError(400, "Invalid status");
        }
      } else {
        if (![status.ACTIVE, status.INACTIVE].includes(data.status as status)) {
          throw new CustomError(
            403,
            `You are not allowed to set status to '${data.status}'`,
          );
        }
      }
    }

    const updateData: Record<string, unknown> = { ...data };
    if (latitude !== undefined && longitude !== undefined) {
      updateData.location = {
        type: "Point",
        coordinates: [longitude, latitude],
        ...(locationAddress !== undefined ? { address: locationAddress } : {}),
      };
    } else if (locationAddress !== undefined) {
      updateData["location.address"] = locationAddress;
    }

    const existingUser = await userModel.findOne({ email: email });
    if (!existingUser) throw new CustomError(400, "User not found");

    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;
    const imageFile = files?.image?.[0] || req.file; // Fallback for old 'image' field
    const profileImageFile = files?.profileImage?.[0] || imageFile;
    const logoFile = files?.logo?.[0];
    const partnerImageFile = files?.partnerImage?.[0];

    if (profileImageFile) {
      if (existingUser.profileImage?.public_id) {
        await deleteCloudinary(existingUser.profileImage.public_id).catch(
          console.error,
        );
      }
      const profileImageResult = await uploadCloudinary(profileImageFile.path);
      updateData.profileImage = profileImageResult;
      if (fs.existsSync(profileImageFile.path))
        fs.unlinkSync(profileImageFile.path);
    }

    if (logoFile) {
      if (existingUser.logo?.public_id) {
        await deleteCloudinary(existingUser.logo.public_id).catch(
          console.error,
        );
      }
      const logoResult = await uploadCloudinary(logoFile.path);
      updateData.logo = logoResult;
      if (fs.existsSync(logoFile.path)) fs.unlinkSync(logoFile.path);
    }

    if (partnerImageFile) {
      if (existingUser.partnerImage?.public_id) {
        await deleteCloudinary(existingUser.partnerImage.public_id).catch(
          console.error,
        );
      }
      const partnerImageResult = await uploadCloudinary(partnerImageFile.path);
      updateData.partnerImage = partnerImageResult;
      if (fs.existsSync(partnerImageFile.path))
        fs.unlinkSync(partnerImageFile.path);
    }

    const user = await userModel.findOneAndUpdate(
      { email: email },
      { $set: updateData },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );

    return user;
  },

  //update user status by admin
  async updateStatus(req: any) {
    const { userId } = req?.params as { userId: string };
    const { status: newStatus } = req.body as { status: status };

    const user = await userModel
      .findOneAndUpdate(
        { _id: userId },
        { status: newStatus },
        {
          returnDocument: "after",
        },
      )
      .select(
        "-password -passwordResetToken -passwordResetExpire -refreshToken -__v -createdAt -updatedAt -emailVerifiedAt -emailVerifiedOtp -verificationOtp -isDeleted",
      );
    if (!user) throw new CustomError(400, "User not found");
    return user;
  },

  // update user by admin
  async updateUserByAdmin(req: any) {
    const { userId } = req.params;
    const { latitude, longitude, locationAddress, ...data } = req.body;

    const updateData: Record<string, unknown> = { ...data };
    if (latitude !== undefined && longitude !== undefined) {
      updateData.location = {
        type: "Point",
        coordinates: [longitude, latitude],
        ...(locationAddress !== undefined ? { address: locationAddress } : {}),
      };
    } else if (locationAddress !== undefined) {
      updateData["location.address"] = locationAddress;
    }

    const existingUser = await userModel.findById(userId);
    if (!existingUser) throw new CustomError(400, "User not found");

    //

    if (data.email && data.email !== existingUser.email) {
      if (existingUser.provider !== "local") {
        throw new CustomError(
          400,
          "Only local provider emails can be updated.",
        );
      }
      const emailExists = await userModel.findOne({ email: data.email });
      if (emailExists) throw new CustomError(409, "Email already exists");
    }

    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;
    const logoFile = files?.logo?.[0];
    const partnerImageFile = files?.partnerImage?.[0];
    const profileImageFile = files?.profileImage?.[0];

    if (profileImageFile) {
      if (existingUser.profileImage?.public_id) {
        await deleteCloudinary(existingUser.profileImage.public_id).catch(
          (err) => console.error("Cloudinary profileImage cleanup error:", err),
        );
      }
      const profileImageResult = await uploadCloudinary(profileImageFile.path);
      updateData.profileImage = profileImageResult;
      if (fs.existsSync(profileImageFile.path)) {
        fs.unlinkSync(profileImageFile.path);
      }
    }

    if (logoFile) {
      if (existingUser.logo?.public_id) {
        await deleteCloudinary(existingUser.logo.public_id).catch((err) =>
          console.error("Cloudinary logo cleanup error:", err),
        );
      }
      const logoResult = await uploadCloudinary(logoFile.path);
      updateData.logo = logoResult;
      if (fs.existsSync(logoFile.path)) {
        fs.unlinkSync(logoFile.path);
      }
    }

    if (partnerImageFile) {
      if (existingUser.partnerImage?.public_id) {
        await deleteCloudinary(existingUser.partnerImage.public_id).catch(
          (err) => console.error("Cloudinary partnerImage cleanup error:", err),
        );
      }
      const partnerImageResult = await uploadCloudinary(partnerImageFile.path);
      updateData.partnerImage = partnerImageResult;
      if (fs.existsSync(partnerImageFile.path)) {
        fs.unlinkSync(partnerImageFile.path);
      }
    }

    const user = await userModel.findOneAndUpdate(
      { _id: userId },
      { $set: updateData },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );

    return user;
  },

  // approve partner
  async approvePartner(partnerId: string) {
    const partner = await userModel.findOne({
      _id: partnerId,
      role: role.PARTNERS,
    });

    if (!partner) {
      throw new CustomError(404, "Partner account not found.");
    }

    if (partner.status === status.ACTIVE) {
      throw new CustomError(400, "Partner is already approved.");
    }

    const user = await userModel
      .findOneAndUpdate(
        {
          _id: partnerId,
          role: role.PARTNERS,
          status: { $in: [status.PENDING, status.REJECT] },
        },
        { status: status.ACTIVE },
        { returnDocument: "after" },
      )
      .select(
        "-password -passwordResetToken -passwordResetExpire -refreshToken -__v -createdAt -updatedAt -emailVerifiedAt -emailVerifiedOtp -verificationOtp -isDeleted",
      );

    if (!user) {
      throw new CustomError(
        400,
        "Failed to approve partner. They may have been processed by another admin.",
      );
    }

    mailer({
      email: user.email,
      subject: "Partner Account Approved - HESTEKA",
      template: partnerApprovalEmailTemplate(user.firstName),
    }).catch((err) => console.error("Email Error:", err));

    return user;
  },

  // reject partner
  async rejectPartner(partnerId: string) {
    const partner = await userModel.findOne({
      _id: partnerId,
      role: role.PARTNERS,
    });

    if (!partner) {
      throw new CustomError(404, "Partner account not found.");
    }

    if (partner.status === status.ACTIVE) {
      throw new CustomError(
        400,
        "Partner is already approved. Cannot reject an approved partner.",
      );
    }

    if (partner.status === status.REJECT) {
      throw new CustomError(400, "Partner is already rejected.");
    }

    const user = await userModel
      .findOneAndUpdate(
        { _id: partnerId, role: role.PARTNERS, status: status.PENDING },
        { status: status.REJECT },
        { returnDocument: "after" },
      )
      .select(
        "-password -passwordResetToken -passwordResetExpire -refreshToken -__v -createdAt -updatedAt -emailVerifiedAt -emailVerifiedOtp -verificationOtp -isDeleted",
      );

    if (!user) {
      throw new CustomError(
        400,
        "Failed to reject partner. They may have been processed by another admin.",
      );
    }

    mailer({
      email: user.email,
      subject: "Partner Account Rejected - HESTEKA",
      template: partnerRejectionEmailTemplate(user.firstName),
    }).catch((err) => console.error("Email Error:", err));

    return user;
  },

  //update password
  async updatePassword(req: any) {
    const { email } = req?.user as { email: string };
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };

    const user = await userModel.findOne({ email: email }).select("+password");
    if (!user) {
      throw new CustomError(404, "User not found");
    }

    await user.updatePassword(currentPassword, newPassword);
    await user.save();

    return true;
  },

  //delete my account
  async deleteAccount(req: any) {
    const userId = req.user?._id;
    const { password } = req.body as { password: string };

    if (!userId) {
      throw new CustomError(401, "Unauthorized");
    }

    const user = await userModel.findById(userId).select("+password");
    if (!user) {
      throw new CustomError(404, "User not found");
    }

    const passwordMatches = await user.comparePassword(password);
    if (!passwordMatches) {
      throw new CustomError(401, "Password is incorrect");
    }

    const anonymizedEmail = `deleted-user-${user._id.toString()}@anonymous.local`;
    const anonymizedName = "Deleted User";

    const [
      reportIds,
      userCommentIds,
      userChatIds,
      conversationIds,
      missionIds,
      partnerAdIds,
    ] = await Promise.all([
      reportModel.find({ author: user._id }).distinct("_id"),
      commentModel.find({ author: user._id }).distinct("_id"),
      chatModel.find({ user: user._id }).distinct("_id"),
      conversationModel.find({ participants: user._id }).distinct("_id"),
      localMissionModel.find({ partner: user._id }).distinct("_id"),
      partnerAdModel.find({ partner: user._id }).distinct("_id"),
    ]);

    const commentIdsToDelete = new Set<string>(
      userCommentIds.map((id) => id.toString()),
    );

    const reportCommentIds = await commentModel
      .find({ report: { $in: reportIds } })
      .distinct("_id");
    reportCommentIds.forEach((id) => commentIdsToDelete.add(id.toString()));

    let parentIds = Array.from(commentIdsToDelete);
    while (parentIds.length > 0) {
      const childIds = await commentModel
        .find({ parent: { $in: parentIds } })
        .distinct("_id");
      const newChildIds = childIds
        .map((id) => id.toString())
        .filter((id) => !commentIdsToDelete.has(id));

      newChildIds.forEach((id) => commentIdsToDelete.add(id));
      parentIds = newChildIds;
    }

    const deletedCommentIds = Array.from(commentIdsToDelete).map(
      (id) => new Types.ObjectId(id),
    );

    await Promise.all([
      paymentModel.updateMany(
        {
          $or: [{ user: user._id }, { payerEmail: user.email }],
        },
        {
          $set: {
            payerEmail: anonymizedEmail,
            payerName: anonymizedName,
            metadata: { anonymized: true },
          },
          $unset: { user: "" },
        },
      ),
      donationModel.updateMany(
        { donorEmail: user.email },
        {
          $set: {
            donorEmail: anonymizedEmail,
            donorName: anonymizedName,
          },
          $unset: { companyInfo: "" },
        },
      ),
    ]);

    await Promise.all([
      reportModel.updateMany(
        { comments: { $in: deletedCommentIds } },
        { $pull: { comments: { $in: deletedCommentIds } } },
      ),
      chatLikeModel.deleteMany({
        $or: [{ user: user._id }, { chat: { $in: userChatIds } }],
      }),
      chatReportModel.deleteMany({
        $or: [
          { reporter: user._id },
          { reportedUser: user._id },
          { conversation: { $in: conversationIds } },
        ],
      }),
      privateMessageModel.deleteMany({
        $or: [{ sender: user._id }, { conversation: { $in: conversationIds } }],
      }),
      localMissionParticipationModel.deleteMany({
        $or: [{ user: user._id }, { mission: { $in: missionIds } }],
      }),
      donationProofModel.deleteMany({
        $or: [
          { user: user._id },
          { donorEmail: user.email },
          { collectionPoint: { $in: partnerAdIds } },
        ],
      }),
      pointTransactionModel.deleteMany({ user: user._id }),
      redemptionModel.deleteMany({ user: user._id }),
      notificationModel.deleteMany({ user: user._id }),
      SupportMessageModel.deleteMany({ user: user._id }),
    ]);

    await Promise.all([
      commentModel.deleteMany({ _id: { $in: deletedCommentIds } }),
      reportModel.deleteMany({ _id: { $in: reportIds } }),
      storyModel.deleteMany({ user: user._id }),
      chatModel.deleteMany({
        $or: [{ user: user._id }, { replyTo: { $in: userChatIds } }],
      }),
      conversationModel.deleteMany({ _id: { $in: conversationIds } }),
      localMissionModel.deleteMany({ _id: { $in: missionIds } }),
      partnerAdModel.deleteMany({ _id: { $in: partnerAdIds } }),
      myanimalModel.deleteMany({ user: user._id }),
      userModel.updateMany(
        { blockedUsers: user._id },
        { $pull: { blockedUsers: user._id } },
      ),
    ]);

    if (user.profileImage?.public_id) {
      deleteCloudinary(user.profileImage.public_id).catch((error) =>
        console.error("Cloudinary deletion error:", error),
      );
    }

    await userModel.deleteOne({ _id: user._id });

    return true;
  },

  //delete user by admin
  async deleteUserByAdmin(targetUserId: string) {
    if (!targetUserId) {
      throw new CustomError(400, "User ID is required");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await userModel.findById(targetUserId).session(session);
      if (!user) {
        throw new CustomError(404, "User not found");
      }

      const anonymizedEmail = `deleted-user-${user._id.toString()}@anonymous.local`;
      const anonymizedName = "Deleted User";

      const [
        reportIds,
        userCommentIds,
        userChatIds,
        conversationIds,
        missionIds,
        partnerAdIds,
      ] = await Promise.all([
        reportModel.find({ author: user._id }).session(session).distinct("_id"),
        commentModel
          .find({ author: user._id })
          .session(session)
          .distinct("_id"),
        chatModel.find({ user: user._id }).session(session).distinct("_id"),
        conversationModel
          .find({ participants: user._id })
          .session(session)
          .distinct("_id"),
        localMissionModel
          .find({ partner: user._id })
          .session(session)
          .distinct("_id"),
        partnerAdModel
          .find({ partner: user._id })
          .session(session)
          .distinct("_id"),
      ]);

      const commentIdsToDelete = new Set<string>(
        userCommentIds.map((id) => id.toString()),
      );

      const reportCommentIds = await commentModel
        .find({ report: { $in: reportIds } })
        .session(session)
        .distinct("_id");
      reportCommentIds.forEach((id) => commentIdsToDelete.add(id.toString()));

      let parentIds = Array.from(commentIdsToDelete);
      while (parentIds.length > 0) {
        const childIds = await commentModel
          .find({ parent: { $in: parentIds } })
          .session(session)
          .distinct("_id");
        const newChildIds = childIds
          .map((id) => id.toString())
          .filter((id) => !commentIdsToDelete.has(id));

        newChildIds.forEach((id) => commentIdsToDelete.add(id));
        parentIds = newChildIds;
      }

      const deletedCommentIds = Array.from(commentIdsToDelete).map(
        (id) => new Types.ObjectId(id),
      );

      await Promise.all([
        paymentModel.updateMany(
          {
            $or: [{ user: user._id }, { payerEmail: user.email }],
          },
          {
            $set: {
              payerEmail: anonymizedEmail,
              payerName: anonymizedName,
              metadata: { anonymized: true },
            },
            $unset: { user: "" },
          },
          { session },
        ),
        donationModel.updateMany(
          { donorEmail: user.email },
          {
            $set: {
              donorEmail: anonymizedEmail,
              donorName: anonymizedName,
            },
            $unset: { companyInfo: "" },
          },
          { session },
        ),
      ]);

      await Promise.all([
        reportModel.updateMany(
          { comments: { $in: deletedCommentIds } },
          { $pull: { comments: { $in: deletedCommentIds } } },
          { session },
        ),
        chatLikeModel.deleteMany(
          {
            $or: [{ user: user._id }, { chat: { $in: userChatIds } }],
          },
          { session },
        ),
        chatReportModel.deleteMany(
          {
            $or: [
              { reporter: user._id },
              { reportedUser: user._id },
              { conversation: { $in: conversationIds } },
            ],
          },
          { session },
        ),
        privateMessageModel.deleteMany(
          {
            $or: [
              { sender: user._id },
              { conversation: { $in: conversationIds } },
            ],
          },
          { session },
        ),
        localMissionParticipationModel.deleteMany(
          {
            $or: [{ user: user._id }, { mission: { $in: missionIds } }],
          },
          { session },
        ),
        donationProofModel.deleteMany(
          {
            $or: [
              { user: user._id },
              { donorEmail: user.email },
              { collectionPoint: { $in: partnerAdIds } },
            ],
          },
          { session },
        ),
        pointTransactionModel.deleteMany({ user: user._id }, { session }),
        redemptionModel.deleteMany({ user: user._id }, { session }),
        notificationModel.deleteMany({ user: user._id }, { session }),
        SupportMessageModel.deleteMany({ user: user._id }, { session }),
      ]);

      await Promise.all([
        commentModel.deleteMany(
          { _id: { $in: deletedCommentIds } },
          { session },
        ),
        reportModel.deleteMany({ _id: { $in: reportIds } }, { session }),
        storyModel.deleteMany({ user: user._id }, { session }),
        chatModel.deleteMany(
          {
            $or: [{ user: user._id }, { replyTo: { $in: userChatIds } }],
          },
          { session },
        ),
        conversationModel.deleteMany(
          { _id: { $in: conversationIds } },
          { session },
        ),
        localMissionModel.deleteMany({ _id: { $in: missionIds } }, { session }),
        partnerAdModel.deleteMany({ _id: { $in: partnerAdIds } }, { session }),
        myanimalModel.deleteMany({ user: user._id }, { session }),
        userModel.updateMany(
          { blockedUsers: user._id },
          { $pull: { blockedUsers: user._id } },
          { session },
        ),
      ]);

      await userModel.deleteOne({ _id: user._id }, { session });

      await session.commitTransaction();
      session.endSession();

      // Cloudinary deletion can happen outside the transaction
      if (user.profileImage?.public_id) {
        deleteCloudinary(user.profileImage.public_id).catch((error) =>
          console.error("Cloudinary deletion error:", error),
        );
      }

      if (user.logo?.public_id) {
        deleteCloudinary(user.logo.public_id).catch((error) =>
          console.error("Cloudinary deletion error:", error),
        );
      }

      if (user.partnerImage?.public_id) {
        deleteCloudinary(user.partnerImage.public_id).catch((error) =>
          console.error("Cloudinary deletion error:", error),
        );
      }

      return true;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  },
  // update user language
  async updateLanguage(req: any) {
    const { email } = req?.user as { email: string };
    const { language } = req.body as { language: string };

    const user = await userModel.findOneAndUpdate(
      { email: email },
      { $set: { language: language } },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );

    if (!user) throw new CustomError(400, "User not found");
    return user;
  },

  // get user language
  async getLanguage(req: any) {
    const { email } = req?.user as { email: string };
    const user = await userModel.findOne({ email: email }).select("language");
    if (!user) throw new CustomError(400, "User not found");
    return user.language;
  },

  //update fcm token
  async updateFcmToken(req: any) {
    const { email } = req?.user as { email: string };
    const { fcmToken } = req.body as { fcmToken: string };
    const language = (req.headers["accept-language"] || "fr").startsWith("en")
      ? "en"
      : "fr";

    console.log(
      `[User Service] updateFcmToken called for ${email} with token: ${fcmToken}, language: ${language}`,
    );

    const user = await userModel.findOneAndUpdate(
      { email: email },
      {
        $addToSet: { fcmTokens: fcmToken },
        $set: { language: language },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );

    if (!user) {
      throw new CustomError(404, "User not found");
    }

    // Optional: limit to last 5 tokens to prevent array from growing too large
    if (user.fcmTokens.length > 5) {
      user.fcmTokens = user.fcmTokens.slice(-5);
      await user.save();
    }

    return user;
  },

  // ─── Block System ──────────────────────────────────────────────────────────

  // Block a user
  async blockUser(blockerId: Types.ObjectId, targetId: string) {
    if (!Types.ObjectId.isValid(targetId)) {
      throw new CustomError(400, "Invalid user ID");
    }

    if (blockerId.toString() === targetId) {
      throw new CustomError(400, "You cannot block yourself");
    }

    const targetUser = await userModel.findById(targetId).select("_id");
    if (!targetUser) {
      throw new CustomError(404, "User not found");
    }

    const blocker = await userModel.findById(blockerId).select("blockedUsers");
    if (!blocker) {
      throw new CustomError(404, "User not found");
    }

    const targetObjectId = new Types.ObjectId(targetId);
    const alreadyBlocked = blocker.blockedUsers
      .map((id) => id.toString())
      .includes(targetId);

    if (alreadyBlocked) {
      throw new CustomError(400, "User is already blocked");
    }

    await userModel.findByIdAndUpdate(blockerId, {
      $addToSet: { blockedUsers: targetObjectId },
    });
  },

  // Unblock a user
  async unblockUser(blockerId: Types.ObjectId, targetId: string) {
    if (!Types.ObjectId.isValid(targetId)) {
      throw new CustomError(400, "Invalid user ID");
    }

    const blocker = await userModel.findById(blockerId).select("blockedUsers");
    if (!blocker) {
      throw new CustomError(404, "User not found");
    }

    const isBlocked = blocker.blockedUsers
      .map((id) => id.toString())
      .includes(targetId);

    if (!isBlocked) {
      throw new CustomError(400, "User is not in your blocked list");
    }

    await userModel.findByIdAndUpdate(blockerId, {
      $pull: { blockedUsers: new Types.ObjectId(targetId) },
    });
  },

  // Get blocked users list
  async getBlockedUsers(userId: Types.ObjectId) {
    const user = await userModel
      .findById(userId)
      .select("blockedUsers")
      .populate("blockedUsers", "firstName lastName profileImage");

    if (!user) {
      throw new CustomError(404, "User not found");
    }

    return user.blockedUsers;
  },
};
