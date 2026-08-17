import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { appmodalService } from "./appmodal.service";

export const getAllModals = asyncHandler(
  async (req: Request, res: Response) => {
    await appmodalService.seedModals(); // Ensure we have the base documents
    const modals = await appmodalService.getAllModals();
    ApiResponse.sendSuccess(res, 200, "Modals fetched", modals);
  },
);

export const updateModal = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const modal = await appmodalService.updateModal(id as string, req.body);
  ApiResponse.sendSuccess(res, 200, "Modal updated", modal);
});

export const checkUpdateModal = asyncHandler(
  async (req: Request, res: Response) => {
    const { appVersion, platform } = req.query;
    const modal = await appmodalService.checkUpdateModal(
      appVersion as string | undefined,
      platform as string | undefined,
    );
    ApiResponse.sendSuccess(res, 200, "Update Modal checked", modal);
  },
);

export const checkRegionDepartmentModal = asyncHandler(
  async (req: Request, res: Response) => {
    const modal = await appmodalService.checkRegionDepartmentModal();
    ApiResponse.sendSuccess(
      res,
      200,
      "Region & Department Modal checked",
      modal,
    );
  },
);

export const checkAnnouncementModal = asyncHandler(
  async (req: Request, res: Response) => {
    const modal = await appmodalService.checkAnnouncementModal();
    ApiResponse.sendSuccess(res, 200, "Announcement Modal checked", modal);
  },
);
