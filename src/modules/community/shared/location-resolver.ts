import { Types } from "mongoose";

import CustomError from "../../../helpers/CustomError";
import { userModel } from "../../usersAuth/user.models";

export interface ResolvedCommunityCoordinates {
  lat: number;
  lng: number;
  address?: string | undefined;
}

interface ResolveCommunityCoordinatesParams {
  userId: Types.ObjectId;
  lat?: number | undefined;
  lng?: number | undefined;
  address?: string | undefined;
  action: string;
}

const isFiniteCoordinate = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const getUserProfileCoordinates = async (
  userId: Types.ObjectId,
): Promise<ResolvedCommunityCoordinates | null> => {
  const user = await userModel.findById(userId).select("location").lean();
  const coordinates = user?.location?.coordinates;

  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    lat,
    lng,
    address: user?.location?.address,
  };
};

export const resolveCommunityCoordinates = async ({
  userId,
  lat,
  lng,
  address,
  action,
}: ResolveCommunityCoordinatesParams): Promise<ResolvedCommunityCoordinates> => {
  if (isFiniteCoordinate(lat) && isFiniteCoordinate(lng)) {
    return { lat, lng, address };
  }

  const profileCoordinates = await getUserProfileCoordinates(userId);
  if (profileCoordinates) {
    return {
      ...profileCoordinates,
      address: address ?? profileCoordinates.address,
    };
  }

  // Fallback to default coordinates (e.g. Paris 48.8566, 2.3522) if location is not set/available.
  // This prevents breaking the user experience when profile has no location and GPS is not resolved yet.
  return {
    lat: 48.8566,
    lng: 2.3522,
    address: address ?? "Paris, France",
  };
};
