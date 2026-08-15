import { z } from "zod";
import { SponsorType } from "./sponsor.interface";

export const createSponsorSchema = z.object({
  partner: z.string().min(1, "Partner is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  actionText: z.string().min(1, "Action text is required"),
  actionLink: z.string().url("Valid Action URL is required"),
  type: z.nativeEnum(SponsorType),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  isActive: z.boolean().optional(),
}).strict();

export const updateSponsorSchema = z.object({
  partner: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  actionText: z.string().optional(),
  actionLink: z.string().url("Valid Action URL is required").optional(),
  type: z.nativeEnum(SponsorType).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
}).strict();
