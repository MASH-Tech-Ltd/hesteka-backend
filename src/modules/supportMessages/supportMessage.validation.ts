import { z } from "zod";

export const createSupportMessageSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
}).strict();

export const supportMessageValidation = {
  createSupportMessageSchema,
};
