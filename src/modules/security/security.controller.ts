import { Request, Response, NextFunction } from "express";
import { securityService, syncIpCache } from "./security.service";

export const blockIpController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { ip, reason, expiresAt } = req.body;
    const result = await securityService.blockIp(
      (ip || "").toString(),
      (reason || "Blocked by Admin").toString(),
      "admin",
      expiresAt || null,
    );
    res.status(200).json({ status: "ok", data: result });
  } catch (error) {
    next(error);
  }
};

export const unblockIpController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = (req.params.id || "").toString();
    const result = await securityService.unblockIp(id);
    res.status(200).json({ status: "ok", data: result });
  } catch (error) {
    next(error);
  }
};

export const getBlockedIpsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const search = (req.query.search || "").toString();
    const result = await securityService.getBlockedIps(page, limit, search);
    res.status(200).json({ status: "ok", data: result });
  } catch (error) {
    next(error);
  }
};

export const getBlockedUsersController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const search = (req.query.search || "").toString();
    const result = await securityService.getBlockedUsers(page, limit, search);
    res.status(200).json({ status: "ok", data: result });
  } catch (error) {
    next(error);
  }
};

export const toggleBlockUserController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { userIdOrEmail, block, reason } = req.body;
    const result = await securityService.toggleBlockUser(
      (userIdOrEmail || "").toString(),
      Boolean(block),
      reason ? reason.toString() : undefined,
    );
    res.status(200).json({ status: "ok", data: result });
  } catch (error) {
    next(error);
  }
};

export const getSecurityLogsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 30;
    const search = (req.query.search || "").toString();
    const result = await securityService.getSecurityLogs(page, limit, search);
    res.status(200).json({ status: "ok", data: result });
  } catch (error) {
    next(error);
  }
};

export const syncCacheController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await syncIpCache();
    res.status(200).json({ status: "ok", message: "IP block cache synchronized successfully." });
  } catch (error) {
    next(error);
  }
};
