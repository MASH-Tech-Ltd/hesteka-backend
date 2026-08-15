import { z } from "zod";
import { SponsorType } from "./sponsor.interface";

export const createSponsorSchema = z.object({
  partner: z.string().min(1, "Partner is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  actionText: z.string().min(1, "Action text is required"),
  actionLink: z.string().url("Valid Action URL is required"),
  type: z.nativeEnum(SponsorType),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isActive: z.union([z.boolean(), z.string().transform((val) => val === "true")]).optional(),
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
  isActive: z.union([z.boolean(), z.string().transform((val) => val === "true")]).optional(),
}).strict();
