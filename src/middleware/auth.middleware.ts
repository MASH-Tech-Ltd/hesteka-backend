import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import config from "../config";
import CustomError from "../helpers/CustomError";
import { userModel } from "../modules/usersAuth/user.models";
import { Types } from "mongoose";
import { status } from "../modules/usersAuth/user.interface";
import { securityService } from "../modules/security/security.service";
import { getIpLocation, getClientIp } from "../helpers/getIpLocation";
// import { redisTokenService } from "../helpers/redisTokenService";

interface TokenPayload extends JwtPayload {
  userId: string;
  email: string;
  role: string;
}

// req.user is now globally defined in src/types/index.d.ts Haus

export const authGuard = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const accessToken =
      // req.cookies?.accessToken ||
      req.headers?.authorization?.split("Bearer ")[1];

    if (!accessToken) {
      throw new CustomError(401, "Access token not found!");
    }

    const decoded = jwt.verify(
      accessToken,
      config.jwt.accessTokenSecret,
    ) as TokenPayload;

    if (!decoded || !decoded.userId) {
      throw new CustomError(401, "Invalid access token!");
    }

    const user = await userModel
      .findById(decoded.userId)
      .select("_id email role status lastLoginIp refreshToken")
      .lean();
    if (!user) {
      throw new CustomError(401, "User not found!");
    }

    if (user.status !== status.ACTIVE) {
      throw new CustomError(
        403,
        `Your account is ${user.status}. Access denied.`,
      );
    }

    if (!user.refreshToken || !Array.isArray(user.refreshToken) || user.refreshToken.length === 0) {
      throw new CustomError(401, "Session expired or logged out!");
    }

    const refreshToken = req.cookies?.refreshToken || (req.headers["x-refresh-token"] as string);
    if (refreshToken && !user.refreshToken.includes(refreshToken)) {
      throw new CustomError(401, "Session expired or invalid refresh token!");
    }

    const clientIp = getClientIp(req);
    if (clientIp !== "unknown" && (user as any).lastLoginIp !== clientIp) {
      const loc = getIpLocation(req, clientIp);
      userModel.updateOne(
        { _id: user._id },
        { $set: { lastLoginIp: clientIp, lastLoginLocation: { country: loc.country, city: loc.city }, lastLogin: new Date() } }
      ).exec().catch(() => {});
    }

    req.user = {
      _id: user._id,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    next();
  } catch (error: any) {
    if (req.originalUrl?.startsWith("/api/v1/admin") || req.originalUrl?.startsWith("/api/v1/security")) {
      const clientIp = getClientIp(req);
      const userAgentStr = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "";
      const requestedFrom = securityService.detectRequestedFrom(req.originalUrl || req.url, userAgentStr, req.headers);
      securityService.logSecurityIncident(
        clientIp,
        req.originalUrl || req.url,
        req.method,
        `Unauthorized Admin/Security endpoint access attempt: ${error?.message || "Authentication failed"}`,
        userAgentStr,
        null,
        false,
        requestedFrom
      );
      (req as any).incidentLogged = true;
    }
    next(error);
  }
};

//check role admin or user i want array of roles
export const allowRole = (...roles: string[]) => {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user?.role) {
        throw new CustomError(
          403,
          "You are not authorized to access this route!",
        );
      }
      if (!roles.includes(req.user.role)) {
        throw new CustomError(
          403,
          "You are not authorized to access this route!",
        );
      }
      next();
    } catch (error: any) {
      if (req.originalUrl?.startsWith("/api/v1/admin") || req.originalUrl?.startsWith("/api/v1/security")) {
        const clientIp = getClientIp(req);
        securityService.logSecurityIncident(
          clientIp,
          req.originalUrl || req.url,
          req.method,
          `Unauthorized Admin/Security endpoint access attempt: ${error?.message || "Role authorization failed"}`,
          typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "",
          req.user?._id || null
        );
        (req as any).incidentLogged = true;
      }
      next(error);
    }
  };
};

export const authGuardOptional = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const accessToken = req.headers?.authorization?.split("Bearer ")[1];

    if (!accessToken) {
      return next();
    }

    const decoded = jwt.verify(
      accessToken,
      config.jwt.accessTokenSecret,
    ) as TokenPayload;

    if (!decoded || !decoded.userId) {
      return next();
    }

    const user = await userModel
      .findById(decoded.userId)
      .select("_id email role status refreshToken")
      .lean();

    if (
      user &&
      user.status === status.ACTIVE &&
      Array.isArray(user.refreshToken) &&
      user.refreshToken.length > 0
    ) {
      const refreshToken = req.cookies?.refreshToken || (req.headers["x-refresh-token"] as string);
      if (!refreshToken || user.refreshToken.includes(refreshToken)) {
        req.user = {
          _id: user._id,
          email: user.email,
          role: user.role,
          status: user.status,
        };
      }
    }

    next();
  } catch (error) {
    next();
  }
};
