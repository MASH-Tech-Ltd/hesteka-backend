import { z } from "zod";

export const redeemPointsSchema = z
  .object({
    points: z.coerce.number().int("Points must be a whole number").positive("Points must be greater than 0"),
    note: z.string().trim().max(200, "Note cannot exceed 200 characters").optional(),
  })
  .strict();

export const assignCustomPointsSchema = z
  .object({
    userId: z.string().min(1, "User ID is required"),
    points: z.coerce.number().int("Points must be a whole number").positive("Points must be greater than 0"),
    note: z.string().trim().max(200, "Note cannot exceed 200 characters").optional(),
  })
  .strict();

export const pointValidation = {
  redeemPointsSchema,
  assignCustomPointsSchema,
};

