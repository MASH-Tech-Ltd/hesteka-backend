import { z } from "zod";
import { LocalMissionStatus } from "./localMission.interface";

const pointsSchema = z.coerce.number().min(0, "Points cannot be negative").optional();

const geoPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z
    .array(z.number())
    .length(2, "Coordinates must contain exactly [longitude, latitude]"),
});

const locationField = z
  .preprocess((val) => {
    if (typeof val === "string") {
      try { return JSON.parse(val); } catch { return val; }
    }
    return val;
  }, geoPointSchema)
  .optional();

export const createLocalMissionSchema = z
  .object({
    title: z.string().min(1, "Local mission title is required"),
    description: z.string().min(1, "Local mission description is required"),
    address: z.string().min(1, "Local mission address is required"),
    location: locationField,
    duration: z.string().min(1, "Local mission duration is required"),
    points: pointsSchema,
    image: z.any().optional(),
    createdAt: z.any().optional(),
  })
  .strict();

export const updateLocalMissionSchema = z
  .object({
    title: z.string().min(1, "Title cannot be empty").optional(),
    description: z.string().min(1, "Description cannot be empty").optional(),
    address: z.string().min(1, "Address cannot be empty").optional(),
    location: locationField,
    duration: z.string().min(1, "Duration cannot be empty").optional(),
    points: pointsSchema,
    status: z.enum(Object.values(LocalMissionStatus) as [string, ...string[]]).optional(),
    image: z.any().optional(),
    createdAt: z.any().optional(),
  })
  .strict();

export const localMissionValidation = {
  createLocalMissionSchema,
  updateLocalMissionSchema,
};
