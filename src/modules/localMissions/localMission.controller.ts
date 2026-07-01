import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { localMissionService } from "./localMission.service";

export const createLocalMission = asyncHandler(async (req: Request, res: Response) => {
  const mission = await localMissionService.createLocalMission(req);
  ApiResponse.sendSuccess(res, 201, "Local mission submitted successfully", mission);
});

export const getAllLocalMissions = asyncHandler(async (req: Request, res: Response) => {
  const { missions, meta } = await localMissionService.getAllLocalMissions(req);
  ApiResponse.sendSuccess(res, 200, "Local missions fetched successfully", missions, meta);
});

export const getMyLocalMissions = asyncHandler(async (req: Request, res: Response) => {
  const missions = await localMissionService.getMyLocalMissions(req);
  ApiResponse.sendSuccess(res, 200, "My local missions fetched successfully", missions);
});

export const getLocalMissionParticipants = asyncHandler(async (req: Request, res: Response) => {
  const participants = await localMissionService.getLocalMissionParticipants(req);
  ApiResponse.sendSuccess(res, 200, "Local mission participants fetched successfully", participants);
});

export const getLocalMissionById = asyncHandler(async (req: Request, res: Response) => {
  const mission = await localMissionService.getLocalMissionById(req);
  ApiResponse.sendSuccess(res, 200, "Local mission fetched successfully", mission);
});

export const joinLocalMission = asyncHandler(async (req: Request, res: Response) => {
  const result = await localMissionService.joinLocalMission(req);
  ApiResponse.sendSuccess(res, 200, "Local mission interest submitted successfully", result);
});

export const leaveLocalMission = asyncHandler(async (req: Request, res: Response) => {
  const result = await localMissionService.leaveLocalMission(req);
  ApiResponse.sendSuccess(res, 200, "Local mission participation cancelled successfully", result);
});

export const approveLocalMissionParticipant = asyncHandler(async (req: Request, res: Response) => {
  const result = await localMissionService.approveLocalMissionParticipant(req);
  ApiResponse.sendSuccess(res, 200, "Local mission approved successfully", result);
});

export const rejectLocalMissionParticipant = asyncHandler(async (req: Request, res: Response) => {
  const result = await localMissionService.rejectLocalMissionParticipant(req);
  ApiResponse.sendSuccess(res, 200, "Local mission participant rejected successfully", result);
});

export const updateLocalMission = asyncHandler(async (req: Request, res: Response) => {
  const mission = await localMissionService.updateLocalMission(req);
  ApiResponse.sendSuccess(res, 200, "Local mission updated successfully", mission);
});

export const deleteLocalMission = asyncHandler(async (req: Request, res: Response) => {
  await localMissionService.deleteLocalMission(req);
  ApiResponse.sendSuccess(res, 200, "Local mission deleted successfully");
});
