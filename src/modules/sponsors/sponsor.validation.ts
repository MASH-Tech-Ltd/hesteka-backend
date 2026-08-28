import { z } from "zod";
import { SponsorType, SponsorStatus } from "./sponsor.interface";

const parseArray = (val: any) => {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      return val.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
};

export const createSponsorSchema = z.object({
  partner: z.string().min(1, "Partner is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  actionText: z.string().min(1, "Action text is required"),
  actionLink: z.string().url("Valid Action URL is required"),
  type: z.nativeEnum(SponsorType),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: z.nativeEnum(SponsorStatus).optional(),
  targetAllUsers: z.union([z.boolean(), z.string().transform((val) => val === "true")]).optional(),
  regions: z.any().transform(parseArray).optional(),
  departments: z.any().transform(parseArray).optional(),
  sponsorImage: z.any().optional(),
}).strict();

export const updateSponsorSchema = z.object({
  partner: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  actionText: z.string().optional(),
  actionLink: z.string().url("Valid Action URL is required").optional(),
  type: z.nativeEnum(SponsorType).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: z.nativeEnum(SponsorStatus).optional(),
  targetAllUsers: z.union([z.boolean(), z.string().transform((val) => val === "true")]).optional(),
  regions: z.any().transform(parseArray).optional(),
  departments: z.any().transform(parseArray).optional(),
  sponsorImage: z.any().optional(),
}).strict();
