import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { locationService } from "./location.service";
import { AutocompleteQuery, PlaceDetailsQuery, GeocodeQuery } from "./location.interface";

export const autocompleteController = asyncHandler(async (req: Request, res: Response) => {
  const query: AutocompleteQuery = {
    input: (req.query.input as string) || "",
    sessionToken: req.query.sessionToken as string,
    language: req.query.language as string,
    types: req.query.types as string,
    components: req.query.components as string,
    lat: req.query.lat ? Number(req.query.lat) : undefined,
    lng: req.query.lng ? Number(req.query.lng) : undefined,
    radius: req.query.radius ? Number(req.query.radius) : undefined,
  };

  const predictions = await locationService.autocomplete(query);
  ApiResponse.sendSuccess(res, 200, "Autocomplete predictions fetched successfully", predictions);
});

export const placeDetailsController = asyncHandler(async (req: Request, res: Response) => {
  const placeId = (req.query.placeId as string) || (req.params.placeId as string) || "";
  const query: PlaceDetailsQuery = {
    placeId,
    sessionToken: req.query.sessionToken as string,
    language: req.query.language as string,
  };

  const details = await locationService.getPlaceDetails(query);
  ApiResponse.sendSuccess(res, 200, "Place details fetched successfully", details);
});

export const geocodeController = asyncHandler(async (req: Request, res: Response) => {
  const query: GeocodeQuery = {
    address: req.query.address as string,
    lat: req.query.lat ? Number(req.query.lat) : undefined,
    lng: req.query.lng ? Number(req.query.lng) : undefined,
    language: req.query.language as string,
  };

  const results = await locationService.geocode(query);
  ApiResponse.sendSuccess(res, 200, "Geocoding results fetched successfully", results);
});

export const reverseGeocodeController = asyncHandler(async (req: Request, res: Response) => {
  const query: GeocodeQuery = {
    lat: req.query.lat ? Number(req.query.lat) : undefined,
    lng: req.query.lng ? Number(req.query.lng) : undefined,
    language: req.query.language as string,
  };

  const results = await locationService.geocode(query);
  ApiResponse.sendSuccess(res, 200, "Reverse geocoding results fetched successfully", results);
});

export const getSavedLocationsController = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const search = (req.query.search as string) || "";
  const type = (req.query.type as string) || "all";
  const result = await locationService.getSavedLocations(page, limit, search, type);
  ApiResponse.sendSuccess(res, 200, "Saved locations fetched successfully", result);
});

export const deleteSavedLocationController = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await locationService.deleteSavedLocation(id);
  ApiResponse.sendSuccess(res, 200, "Saved location deleted successfully");
});

export const clearSavedLocationsController = asyncHandler(async (req: Request, res: Response) => {
  await locationService.clearAllSavedLocations();
  ApiResponse.sendSuccess(res, 200, "All saved locations cleared successfully");
});

export const trackLocationUsageController = asyncHandler(async (req: Request, res: Response) => {
  const type = (req.body?.type || req.query?.type) as string;
  const provider = (req.body?.provider || req.query?.provider) as string;
  const source = (req.body?.source || req.query?.source) as string || "unknown";
  
  if (!type) {
    return ApiResponse.sendError(res, 400, "Tracking type is required");
  }
  
  await locationService.trackUsage(type, provider || "client", source);
  ApiResponse.sendSuccess(res, 200, "Usage tracked successfully");
});

export const getLocationStatsController = asyncHandler(async (req: Request, res: Response) => {
  const stats = await locationService.getUsageStats();
  ApiResponse.sendSuccess(res, 200, "Location stats fetched successfully", stats);
});
