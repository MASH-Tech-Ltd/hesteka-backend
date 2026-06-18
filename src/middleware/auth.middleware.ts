import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import config from "../config";
import CustomError from "../helpers/CustomError";
import { userModel } from "../modules/usersAuth/user.models";
import { Types } from "mongoose";
import { status } from "../modules/usersAuth/user.interface";
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
      .select("_id email role status")
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

    req.user = {
      _id: user._id,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    next();
  } catch (error) {
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
    } catch (error) {
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
      .select("_id email role status")
      .lean();

    if (user && user.status === status.ACTIVE) {
      req.user = {
        _id: user._id,
        email: user.email,
        role: user.role,
        status: user.status,
      };
    }

    next();
  } catch (error) {
    next();
  }
};
