import { blockedIpModel, securityLogModel } from "./security.models";
import { userModel } from "../usersAuth/user.models";
import { status } from "../usersAuth/user.interface";
import CustomError from "../../helpers/CustomError";
import { Types } from "mongoose";

export class SecurityService {
  async blockIp(
    ip: string,
    reason: string,
    blockedBy = "admin",
    expiresAt: Date | null = null,
  ) {
    if (!ip) {
      throw new CustomError(400, "IP address is required");
    }

    const existing = await blockedIpModel.findOne({ ip });
    if (existing) {
      existing.reason = reason;
      existing.blockedBy = blockedBy;
      existing.expiresAt = expiresAt;
      await existing.save();
    } else {
      await blockedIpModel.create({
        ip,
        reason,
        blockedBy,
        expiresAt,
      });
    }

    return { success: true, message: `IP ${ip} has been blocked successfully.` };
  }

  async unblockIp(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new CustomError(400, "Invalid blocked IP ID");
    }

    const doc = await blockedIpModel.findByIdAndDelete(id);
    if (!doc) {
      throw new CustomError(404, "Blocked IP entry not found");
    }

    await securityLogModel.updateMany({ ip: doc.ip }, { $set: { resetStrike: true } });

    // Automatically reactivate any user accounts on the server associated with this IP that were suspended
    try {
      const logsWithUsers = await securityLogModel.find({ ip: doc.ip, userId: { $ne: null } }).select("userId").lean();
      const userIds = logsWithUsers.map((log: any) => log.userId).filter(Boolean);
      if (userIds.length > 0) {
        await userModel.updateMany(
          { _id: { $in: userIds }, status: status.BLOCKED },
          { $set: { status: status.ACTIVE } }
        );
      }
      await userModel.updateMany(
        { lastLoginIp: doc.ip, status: status.BLOCKED },
        { $set: { status: status.ACTIVE } }
      );
    } catch (err) {
      console.error("Failed to unblock associated user accounts on server:", err);
    }

    return { success: true, message: `IP ${doc.ip} and associated user accounts have been unblocked successfully.` };
  }

  async getBlockedIps(page = 1, limit = 20, search = "") {
    const skip = (page - 1) * limit;
    const query: any = {};
    if (search) {
      query.$or = [
        { ip: { $regex: search, $options: "i" } },
        { reason: { $regex: search, $options: "i" } },
      ];
    }

    const [data, total] = await Promise.all([
      blockedIpModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      blockedIpModel.countDocuments(query),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBlockedUsers(page = 1, limit = 20, search = "") {
    const skip = (page - 1) * limit;
    const query: any = { status: { $in: [status.BLOCKED, status.BANNED] } };

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
      ];
    }

    const [data, total] = await Promise.all([
      userModel
        .find(query)
        .select("_id email firstName lastName role status createdAt lastLogin profileImage")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      userModel.countDocuments(query),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async toggleBlockUser(userIdOrEmail: string, block: boolean, reason?: string) {
    let query: any = {};
    if (Types.ObjectId.isValid(userIdOrEmail)) {
      query._id = userIdOrEmail;
    } else {
      query.email = userIdOrEmail.toLowerCase().trim();
    }

    const user = await userModel.findOne(query);
    if (!user) {
      throw new CustomError(404, "User not found");
    }

    if (user.role === "admin") {
      throw new CustomError(403, "Admin accounts cannot be blocked");
    }

    const newStatus = block ? status.BLOCKED : status.ACTIVE;
    user.status = newStatus;
    await user.save();

    if (!block) {
      // When unblocking a user account, also remove any IP blocks associated with their last login IP from the server
      if (user.lastLoginIp && user.lastLoginIp !== "unknown") {
        try {
          await blockedIpModel.deleteMany({ ip: user.lastLoginIp });
          await securityLogModel.updateMany({ ip: user.lastLoginIp }, { $set: { resetStrike: true } });
        } catch (err) {
          console.error("Failed to unblock user's IP from server:", err);
        }
      }
    } else if (reason) {
      await securityLogModel.create({
        ip: "N/A (Admin Action)",
        endpoint: "/api/v1/security/toggle-block-user",
        method: "POST",
        reason: `User account blocked by Admin. Reason: ${reason}`,
        userId: user._id,
        requestedFrom: "web/admin",
      });
    }

    return {
      success: true,
      message: `User ${user.email} is now ${newStatus}.`,
      user: {
        _id: user._id,
        email: user.email,
        status: user.status,
      },
    };
  }

  detectRequestedFrom(endpoint = "", userAgent = "", reqHeaders: any = null): string {
    if (reqHeaders) {
      const explicit = reqHeaders["x-requested-from"] || reqHeaders["x-app-client"] || reqHeaders["x-client-type"];
      if (explicit && typeof explicit === "string") {
        return explicit.trim().toLowerCase();
      }
      if (reqHeaders["x-admin-dashboard"] === "true" || reqHeaders["x-admin-dashboard"] === "admin") {
        return "web/admin";
      }
      if (reqHeaders["x-partner-dashboard"] === "true" || reqHeaders["x-partner-dashboard"] === "partner") {
        return "web/partner";
      }
      const origin = reqHeaders.origin || "";
      const referer = reqHeaders.referer || "";
      if (origin.includes("admin.hesteka.com") || referer.includes("admin.hesteka.com")) {
        return "web/admin";
      }
      if (origin.includes("partner.hesteka.com") || referer.includes("partner.hesteka.com")) {
        return "web/partner";
      }
      if (origin.includes("charity.hesteka.com") || referer.includes("charity.hesteka.com")) {
        return "web/charity";
      }
    }

    if (userAgent && typeof userAgent === "string") {
      const lowerUA = userAgent.toLowerCase();
      
      // CLI / API Tools / Scripts
      if (lowerUA.includes("curl")) {
        return "curl";
      }
      if (lowerUA.includes("postman") || lowerUA.includes("postmanruntime")) {
        return "postman";
      }
      if (lowerUA.includes("insomnia")) {
        return "insomnia";
      }
      if (
        lowerUA.includes("wget") ||
        lowerUA.includes("httpie") ||
        lowerUA.includes("python-requests") ||
        lowerUA.includes("python-urllib") ||
        lowerUA.includes("go-http-client") ||
        lowerUA.includes("node-fetch") ||
        lowerUA.includes("axios")
      ) {
        return "script / tool";
      }

      // Native App frameworks / clients
      if (
        lowerUA.includes("dart/") ||
        lowerUA.includes("dart:io") ||
        lowerUA.includes("flutter") ||
        lowerUA.includes("dalvik") ||
        lowerUA.includes("cfnetwork") ||
        lowerUA.includes("okhttp") ||
        lowerUA.includes("expo") ||
        lowerUA.includes("react-native")
      ) {
        return "mobile app";
      }
    }

    if (endpoint && typeof endpoint === "string") {
      const lowerEp = endpoint.toLowerCase();
      if (
        lowerEp.includes("/admin/") ||
        lowerEp.includes("/admin-auth/") ||
        lowerEp.includes("/security/") ||
        lowerEp.includes("/blocked-ips") ||
        lowerEp.includes("/blocked-users") ||
        lowerEp.includes("/toggle-block-user")
      ) {
        return "web/admin";
      }
      if (
        lowerEp.includes("/partner/") ||
        lowerEp.includes("/partner-auth/") ||
        lowerEp.includes("/missions/partner/")
      ) {
        return "web/partner";
      }
    }

    if (userAgent && typeof userAgent === "string") {
      const lowerUA = userAgent.toLowerCase();
      if (lowerUA.includes("android") || lowerUA.includes("iphone") || lowerUA.includes("ipad") || lowerUA.includes("mobile")) {
        return "mobile app";
      }
      if (lowerUA.includes("mozilla") || lowerUA.includes("chrome") || lowerUA.includes("safari") || lowerUA.includes("firefox") || lowerUA.includes("edge")) {
        return "web/user";
      }
    }

    return "unknown";
  }

  async logSecurityIncident(
    ip: string,
    endpoint: string,
    method: string,
    reason: string,
    userAgent = "",
    userId: any = null,
    skipAutoBlock = false,
    requestedFrom = "",
  ) {
    try {
      const detectedSource = requestedFrom || this.detectRequestedFrom(endpoint, userAgent, null);
      await securityLogModel.create({
        ip,
        endpoint,
        method,
        userAgent,
        reason,
        userId,
        requestedFrom: detectedSource,
      });

      // Automatic Protection: Auto-block external IPs on repeated unusual activity or rate limit abuse
      const isLoopbackOrLocal =
        !ip ||
        ip === "unknown" ||
        ip === "N/A (Admin Action)" ||
        ip === "127.0.0.1" ||
        ip === "::1" ||
        ip === "::ffff:127.0.0.1" ||
        ip === "localhost";

      if (!skipAutoBlock && !isLoopbackOrLocal) {
        const alreadyBlocked = await this.isIpBlocked(ip);
        if (!alreadyBlocked) {
          const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
          const lowerReason = reason.toLowerCase();
          const isFalseTokenAttempt =
            lowerReason.includes("false token") ||
            lowerReason.includes("invalid token") ||
            lowerReason.includes("invalid access token") ||
            lowerReason.includes("invalid refresh token") ||
            lowerReason.includes("token not found") ||
            lowerReason.includes("session expired") ||
            lowerReason.includes("authentication failed") ||
            lowerReason.includes("unauthorized");

          const isHighSeverity =
            !isFalseTokenAttempt && (
              lowerReason.includes("probing") ||
              lowerReason.includes("brute force") ||
              lowerReason.includes("bot attack") ||
              lowerReason.includes("malicious") ||
              lowerReason.includes("active protection") ||
              lowerReason.includes("api tool") ||
              lowerReason.includes("script detected") ||
              lowerReason.includes("postman") ||
              lowerReason.includes("curl")
            );

          let incidentCount = 0;
          if (isFalseTokenAttempt) {
            incidentCount = await securityLogModel.countDocuments({
              ip,
              createdAt: { $gte: fifteenMinutesAgo },
              resetStrike: { $ne: true },
              reason: { $regex: /false token|invalid token|token not found|session expired|authentication failed|unauthorized/i }
            });
          } else {
            incidentCount = await securityLogModel.countDocuments({
              ip,
              createdAt: { $gte: fifteenMinutesAgo },
              resetStrike: { $ne: true }
            });
          }

          // Auto-block if >= 20 infractions for false token attempts, >= 15 for general rate limit infractions, or immediately on high severity
          if ((isFalseTokenAttempt && incidentCount >= 20) || (!isFalseTokenAttempt && (incidentCount >= 15 || isHighSeverity))) {
            const blockReason = isHighSeverity
              ? `[AUTO-BLOCKED] Severe Unusual Activity: ${reason}`
              : isFalseTokenAttempt
                ? `[AUTO-BLOCKED] Repeated False Token Attempts (${incidentCount} infractions in 15m). Latest: ${reason}`
                : `[AUTO-BLOCKED] Repeated Rate Limit / Unusual Activity (${incidentCount} infractions in 15m). Latest: ${reason}`;

            await this.blockIp(ip, blockReason, "system", null);

            // If userId exists (user is authenticated), block their user account in the database as well
            let accountBlockedMessage = "";
            if (userId) {
              try {
                const user = await userModel.findById(userId);
                if (user && user.role !== "admin" && user.status !== status.BLOCKED) {
                  user.status = status.BLOCKED;
                  await user.save();
                  accountBlockedMessage = ` Also suspended user account: ${user.email}.`;
                }
              } catch (userBlockErr) {
                console.error("Failed to auto-block user account during IP block:", userBlockErr);
              }
            }

            // Log the automatic blocking action so details remain visible in Security Logs
            await securityLogModel.create({
              ip,
              endpoint,
              method,
              userAgent,
              reason: `🚨 ACTIVE PROTECTION: IP automatically blocked.${accountBlockedMessage} ${blockReason}`,
              userId,
              requestedFrom: requestedFrom || "system",
            });
          }
        }
      }
    } catch (err) {
      console.error("Failed to log security incident or auto-block:", err);
    }
  }

  async getSecurityLogs(page = 1, limit = 30, search = "") {
    const skip = (page - 1) * limit;
    const query: any = {};
    if (search) {
      query.$or = [
        { ip: { $regex: search, $options: "i" } },
        { endpoint: { $regex: search, $options: "i" } },
        { reason: { $regex: search, $options: "i" } },
        { requestedFrom: { $regex: search, $options: "i" } },
      ];
    }

    const [data, total] = await Promise.all([
      securityLogModel
        .find(query)
        .populate("userId", "email firstName lastName role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      securityLogModel.countDocuments(query),
    ]);

    const formattedData = data.map((log: any) => ({
      ...log,
      requestedFrom: log.requestedFrom || this.detectRequestedFrom(log.endpoint, log.userAgent, null),
    }));

    return {
      data: formattedData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async isIpBlocked(ip: string): Promise<boolean> {
    const dbEntry = await blockedIpModel.findOne({ ip }).select("expiresAt").lean();
    if (!dbEntry) return false;

    if (dbEntry.expiresAt && new Date(dbEntry.expiresAt) < new Date()) {
      // Temporary block has expired. Clean up from DB.
      blockedIpModel.deleteOne({ ip }).catch((err) =>
        console.error("Failed to delete expired IP block from DB:", err)
      );
      return false;
    }
    return true;
  }
}

export const securityService = new SecurityService();
