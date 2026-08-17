import { Request, Response } from "express";
import ApiResponse from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { solidarityService } from "./solidarity.service";

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const { collectionId, limit, pageInfo } = req.query;
  const data = await solidarityService.getProducts({ 
    collectionId: collectionId as string | undefined, 
    limit: limit ? parseInt(limit as string) : undefined,
    pageInfo: pageInfo as string | undefined
  });

  ApiResponse.sendSuccess(res, 200, "Products fetched successfully", data);
});

export const getCollections = asyncHandler(async (req: Request, res: Response) => {
  const collections = await solidarityService.getCollections();

  ApiResponse.sendSuccess(res, 200, "Collections fetched successfully", collections);
});

export const getCustomers = asyncHandler(async (req: Request, res: Response) => {
  const { limit, pageInfo } = req.query;
  const data = await solidarityService.getCustomers({ 
    limit: limit ? parseInt(limit as string) : undefined,
    pageInfo: pageInfo as string | undefined
  });

  ApiResponse.sendSuccess(res, 200, "Customers fetched successfully", data);
});
