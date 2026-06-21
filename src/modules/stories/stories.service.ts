import { Types } from "mongoose";

import {
  CreateStoryPayload,
  GetStoriesQuery,
  IStory,
  IStoryMedia,
  StoryMediaType,
} from "./stories.interface";
import CustomError from "../../helpers/CustomError";
import {
  CloudinaryResourceType,
  deleteCloudinary,
  uploadMediaCloudinary,
} from "../../helpers/cloudinary";
import {
  buildGeoWithinQuery,
  calculateDistanceKm,
  Coordinates,
  encodeGeohash,
  fromGeoPoint,
  toGeoPoint,
} from "../community/shared/geo.utils";
import { COMMUNITY_CONFIG } from "../community/shared/community.config";
import { resolveCommunityCoordinates } from "../community/shared/location-resolver";
import { storyModel } from "./stories.models";
import { paginationHelper } from "../../utils/pagination";

const getStoryMediaType = (mimetype: string): StoryMediaType => {
  if (mimetype.startsWith("image/")) return StoryMediaType.IMAGE;
  if (mimetype.startsWith("video/")) return StoryMediaType.VIDEO;
  throw new CustomError(
    400,
    "Only image or video files are allowed in stories",
  );
};

const getCloudinaryResourceType = (
  mediaType: StoryMediaType,
): CloudinaryResourceType => {
  return mediaType === StoryMediaType.VIDEO ? "video" : "image";
};

const uploadStoryMedia = async (
  file: Express.Multer.File,
): Promise<IStoryMedia> => {
  const mediaType = getStoryMediaType(file.mimetype);
  const resourceType = getCloudinaryResourceType(mediaType);

  const result = await uploadMediaCloudinary(file.path, resourceType);

  return {
    url: result.secure_url,
    publicId: result.public_id,
    type: mediaType,
  };
};

const createStory = async (
  payload: CreateStoryPayload,
  file: Express.Multer.File,
): Promise<IStory> => {
  if (!file) {
    throw new CustomError(400, "Media file is required for story");
  }

  const { user, caption, lat, lng, address } = payload;

  const resolvedLocation = await resolveCommunityCoordinates({
    userId: user,
    lat,
    lng,
    address,
    action: "create a community story",
  });

  const location = toGeoPoint(
    resolvedLocation.lat,
    resolvedLocation.lng,
    resolvedLocation.address,
  );
  const geohash = encodeGeohash(resolvedLocation.lat, resolvedLocation.lng);

  const media = await uploadStoryMedia(file);

  const expiresAt = new Date(
    Date.now() + COMMUNITY_CONFIG.STORY_EXPIRE_HOURS * 60 * 60 * 1000,
  );

  try {
    const story = await storyModel.create({
      user,
      media,
      caption,
      location,
      geohash,
      expiresAt,
    });

    // Notify friends asynchronously
    import("../notifications/notification.service").then(ns => {
      import("../usersAuth/user.models").then(async um => {
        const creator = await um.userModel.findById(user).select("firstName lastName");
        const name = creator ? `${creator.firstName} ${creator.lastName}` : "A friend";
        ns.notificationService.notifyFriends(
          user.toString(),
          "New Story",
          `${name} just added a new story!`,
          "system" as any,
          { storyId: story._id.toString() }
        );
      });
    });

    return story;
  } catch (error) {
    // Rollback — delete uploaded media if DB save fails
    const resourceType = getCloudinaryResourceType(media.type);
    await deleteCloudinary(media.publicId, resourceType).catch(() => null);
    throw error;
  }
};

const getLocalStories = async (query: GetStoriesQuery) => {
  const { user, lat, lng, radiusKm, page, limit } = query;
  const pagination = paginationHelper(String(page), String(limit));

  const resolvedLocation = await resolveCommunityCoordinates({
    userId: user,
    lat,
    lng,
    action: "fetch local community stories",
  });

  const geoFilter = buildGeoWithinQuery(
    resolvedLocation.lat,
    resolvedLocation.lng,
    radiusKm!,
  );

  const baseFilter = user ? { $or: [geoFilter, { user }] } : geoFilter;

  // Only fetch non-expired stories (TTL should handle this, but safety check)
  const filter = {
    ...baseFilter,
    expiresAt: { $gt: new Date() },
  };

  const [stories, total] = await Promise.all([
    storyModel
      .find(filter)
      .populate("user", "firstName lastName profileImage")
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    storyModel.countDocuments(filter),
  ]);

  const userCoords = {
    lat: resolvedLocation.lat,
    lng: resolvedLocation.lng,
  };
  const storiesWithDistance = stories.map((story) => {
    const storyCoords = fromGeoPoint(story.location);
    const distanceKm = calculateDistanceKm(
      userCoords as Coordinates,
      storyCoords,
    );
    return { ...story, distanceKm: Number(distanceKm.toFixed(2)) };
  });

  return {
    stories: storiesWithDistance,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
};

const getUserStories = async (userId: string) => {
  if (!Types.ObjectId.isValid(userId)) {
    throw new CustomError(400, "Invalid user ID");
  }

  const stories = await storyModel
    .find({
      user: userId,
      expiresAt: { $gt: new Date() },
    })
    .populate("user", "firstName lastName profileImage")
    .sort({ createdAt: -1 })
    .lean();

  return stories;
};

const getStoryById = async (storyId: string): Promise<IStory> => {
  if (!Types.ObjectId.isValid(storyId)) {
    throw new CustomError(400, "Invalid story ID");
  }

  const story = await storyModel
    .findOne({
      _id: storyId,
      expiresAt: { $gt: new Date() },
    })
    .populate("user", "firstName lastName profileImage");

  if (!story) {
    throw new CustomError(404, "Story not found or expired");
  }

  return story;
};

const incrementView = async (storyId: string): Promise<void> => {
  if (!Types.ObjectId.isValid(storyId)) {
    throw new CustomError(400, "Invalid story ID");
  }

  await storyModel.findByIdAndUpdate(storyId, {
    $inc: { viewsCount: 1 },
  });
};

const deleteStory = async (
  storyId: string,
  userId: Types.ObjectId,
): Promise<void> => {
  if (!Types.ObjectId.isValid(storyId)) {
    throw new CustomError(400, "Invalid story ID");
  }

  const story = await storyModel.findById(storyId);

  if (!story) {
    throw new CustomError(404, "Story not found");
  }

  if (story.user?.toString() !== userId.toString()) {
    throw new CustomError(403, "You can only delete your own stories");
  }

  const resourceType = getCloudinaryResourceType(story.media.type);
  await deleteCloudinary(story.media.publicId, resourceType).catch(() => null);

  await storyModel.findByIdAndDelete(storyId);
};

export const storyService = {
  createStory,
  getLocalStories,
  getUserStories,
  getStoryById,
  incrementView,
  deleteStory,
};
