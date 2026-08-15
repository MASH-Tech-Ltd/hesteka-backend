import { Request, Response, NextFunction } from "express";
import { badgeService } from "./badge.service";

export const badgeController = {
  async createBadge(req: Request, res: Response, next: NextFunction) {
    try {
      const badge = await badgeService.createBadge(req.body, req.file);
      res.status(201).json({
        success: true,
        message: "Badge created successfully",
        data: badge,
      });
    } catch (error) {
      next(error);
    }
  },

  async getAllBadges(req: Request, res: Response, next: NextFunction) {
    try {
      const badges = await badgeService.getAllBadges();
      res.status(200).json({
        success: true,
        message: "Badges fetched successfully",
        data: badges,
      });
    } catch (error) {
      next(error);
    }
  },

  async getBadgeById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const badge = await badgeService.getBadgeById(id as string);
      res.status(200).json({
        success: true,
        message: "Badge fetched successfully",
        data: badge,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateBadge(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const badge = await badgeService.updateBadge(id as string, req.body, req.file);
      res.status(200).json({
        success: true,
        message: "Badge updated successfully",
        data: badge,
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteBadge(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await badgeService.deleteBadge(id as string);
      res.status(200).json({
        success: true,
        message: "Badge deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },
};
