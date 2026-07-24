import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { crowdfundingService } from "./crowdfunding.service";

export const getProjects = asyncHandler(
  async (req: Request, res: Response) => {
    const projects = await crowdfundingService.getAllProjects();
    ApiResponse.sendSuccess(
      res,
      200,
      "Projects fetched successfully",
      projects,
    );
  }
);

export const addProject = asyncHandler(
  async (req: Request, res: Response) => {
    const { slug } = req.body;
    if (!slug) {
      return ApiResponse.sendError(res, 400, "Slug is required");
    }
    const project = await crowdfundingService.addProject(slug);
    ApiResponse.sendSuccess(
      res,
      201,
      "Project added successfully",
      project,
    );
  }
);

export const removeProject = asyncHandler(
  async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    await crowdfundingService.removeProject(slug);
    ApiResponse.sendSuccess(
      res,
      200,
      "Project removed successfully",
    );
  }
);

export const setActiveProject = asyncHandler(
  async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    await crowdfundingService.setActiveProject(slug);
    ApiResponse.sendSuccess(
      res,
      200,
      "Project set as default successfully",
    );
  }
);

export const getCrowdfundingStats = asyncHandler(
  async (req: Request, res: Response) => {
    const slug = req.query.slug as string;
    const stats = await crowdfundingService.getCrowdfundingStats(slug);
    ApiResponse.sendSuccess(
      res,
      200,
      "Crowdfunding statistics fetched successfully",
      stats,
    );
  }
);

export const getCrowdfundingDonors = asyncHandler(
  async (req: Request, res: Response) => {
    const slug = req.query.slug as string;
    const donors = await crowdfundingService.getCrowdfundingDonors(slug);
    ApiResponse.sendSuccess(
      res,
      200,
      "Crowdfunding donors fetched successfully",
      donors,
    );
  }
);
