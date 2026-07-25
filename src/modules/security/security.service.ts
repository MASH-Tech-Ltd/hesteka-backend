import { blockedIpModel, securityLogModel } from "./security.models";
import { userModel } from "../usersAuth/user.models";
import { status } from "../usersAuth/user.interface";
import CustomError from "../../helpers/CustomError";
import { Types } from "mongoose";

// In-memory set of blocked IPs for 0ms overhead checking in middleware
export const ipCache = new Set<string>();
let isCacheInitialized = false;

export const syncIpCache = async () => {
  try {
    const blocked = await blockedIpModel.find({
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).select("ip").lean();
    ipCache.clear();
    blocked.forEach((b) => ipCache.add(b.ip));
    isCacheInitialized = true;
  } catch (err) {
    console.error("Failed to sync IP block cache:", err);
  }
};

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

    ipCache.add(ip);
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

    ipCache.delete(doc.ip);
    return { success: true, message: `IP ${doc.ip} has been unblocked successfully.` };
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

    if (block && reason) {
      await securityLogModel.create({
        ip: "N/A (Admin Action)",
        endpoint: "/api/v1/security/toggle-block-user",
        method: "POST",
        reason: `User account blocked by Admin. Reason: ${reason}`,
        userId: user._id,
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

  async logSecurityIncident(
    ip: string,
    endpoint: string,
    method: string,
    reason: string,
    userAgent = "",
    userId: any = null,
    skipAutoBlock = false,
  ) {
    try {
      await securityLogModel.create({
        ip,
        endpoint,
        method,
        userAgent,
        reason,
        userId,
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
          const incidentCount = await securityLogModel.countDocuments({
            ip,
            createdAt: { $gte: fifteenMinutesAgo },
          });

          const lowerReason = reason.toLowerCase();
          const isHighSeverity =
            lowerReason.includes("probing") ||
            lowerReason.includes("unauthorized") ||
            lowerReason.includes("brute force") ||
            lowerReason.includes("bot attack") ||
            lowerReason.includes("malicious") ||
            lowerReason.includes("active protection");

          // Auto-block if >= 3 infractions in 15m, or immediately on high severity unusual activity
          if (incidentCount >= 3 || isHighSeverity) {
            const blockReason = isHighSeverity
              ? `[AUTO-BLOCKED] Severe Unusual Activity: ${reason}`
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

  async isIpBlocked(ip: string): Promise<boolean> {
    if (!isCacheInitialized) {
      await syncIpCache();
    }
    return ipCache.has(ip);
  }
}

export const securityService = new SecurityService();
