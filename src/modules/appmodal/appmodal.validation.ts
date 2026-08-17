import { z } from "zod";

export const createAppModalSchema = z.object({
  type: z.enum(["update", "region_department", "announcement"]).optional(),
  title: z.string().min(3).max(100).transform(val => val.trim()).optional(),
  description: z.string().transform(val => val?.trim()).optional(),
  isActive: z.boolean().optional(),
  actionText: z.string().optional(),
  appstoreLink: z.string().optional(),
  playstoreLink: z.string().optional(),
  iosMinVersion: z.string().optional(),
  androidMinVersion: z.string().optional(),
  platform: z.enum(["ios", "android", "all"]).optional(),
});
