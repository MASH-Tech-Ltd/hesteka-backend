import { z } from "zod";
import { PartnerAdStatus } from "./partnerAd.interface";

const geoPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z
    .array(z.number())
    .length(2, "Coordinates must contain exactly [longitude, latitude]"),
});

export const createCollectionPointSchema = z
  .object({
    title: z.string().min(1, "Collection point title is required"),
    description: z.string().optional(),
    address: z.string().min(1, "Collection point address is required"),
    latitude: z.any().optional(),
    longitude: z.any().optional(),
    partner: z.string().optional(),
    location: z
      .preprocess((val) => {
        if (typeof val === "string") {
          try { return JSON.parse(val); } catch { return val; }
        }
        return val;
      }, geoPointSchema)
      .optional(),
    image: z.any().optional(),
  })
  .strict();

export const updatePartnerAdSchema = z
  .object({
    title: z.string().min(1, "Title cannot be empty").optional(),
    description: z.string().optional(),
    address: z.string().min(1, "Address cannot be empty").optional(),
    latitude: z.any().optional(),
    longitude: z.any().optional(),
    partner: z.string().optional(),
    location: z
      .preprocess((val) => {
        if (typeof val === "string") {
          try { return JSON.parse(val); } catch { return val; }
        }
        return val;
      }, geoPointSchema)
      .optional(),
    status: z.enum(Object.values(PartnerAdStatus) as [string, ...string[]]).optional(),
    image: z.any().optional(),
  })
  .strict();

export const partnerAdValidation = {
  createCollectionPointSchema,
  updatePartnerAdSchema,
};
