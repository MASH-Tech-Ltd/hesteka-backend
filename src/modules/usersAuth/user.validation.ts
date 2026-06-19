import { z } from "zod";
import { updateStatus } from "./user.interface";

const acceptedStatuses = Object.values(updateStatus);
const statusSchema = z.enum(acceptedStatuses as [string, ...string[]], {
  message: `Invalid status. Accepted statuses are: ${acceptedStatuses.join(", ")}`,
});
const optionalCoordinate = (fieldName: string, min: number, max: number) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.coerce
      .number({
        message: `${fieldName} must be a number`,
      })
      .min(min, `${fieldName} must be at least ${min}`)
      .max(max, `${fieldName} must be at most ${max}`)
      .optional(),
  );

//update user info schema
export const updateUserSchema = z
  .object({
    // Basic info
    firstName: z.string().min(1, "First name cannot be empty").optional(),
    lastName: z.string().min(1, "Last name cannot be empty").optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    company: z.string().optional(),
    selfIntroduction: z
      .string()
      .max(100, "Self introduction cannot be longer than 100 characters")
      .optional(),
    profession: z.string().optional(),
    city: z.string().optional(),
    postalCode: z
      .string()
      .regex(/^\d{5}$/, "Postal code must be a valid 5-digit French postal code")
      .optional(),
    country: z.string().optional(),
    region: z.string().optional(),
    department: z.string().optional(),
    status: statusSchema.optional(),
    image: z.any().optional(),
    website: z.string().url("Invalid website URL").optional().or(z.literal("")),
    latitude: optionalCoordinate("Latitude", -90, 90),
    longitude: optionalCoordinate("Longitude", -180, 180),
    locationAddress: z.string().optional(),
  })
  .strict()
  .refine((data) => (data.latitude === undefined) === (data.longitude === undefined), {
    message: "Latitude and longitude must be provided together",
    path: ["coordinates"],
  });

export const updateStatusSchema = z
  .object({
    status: statusSchema.optional(),
  })
  .strict();

export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(16, "Password must be at most 16 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
        "Password must contain at least 1 uppercase, 1 lowercase, 1 number, and 1 special character",
      ),
    confirmPassword: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(16, "Password must be at most 16 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
        "Password must contain at least 1 uppercase, 1 lowercase, 1 number, and 1 special character",
      ),
  })
  .strict()
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirm password do not match",
    path: ["confirmPassword"],
  });

export const deleteAccountSchema = z
  .object({
    password: z.string().min(1, "Password is required"),
  })
  .strict();

export const updateFcmTokenSchema = z
  .object({
    fcmToken: z.string().min(1, "FCM token cannot be empty"),
  })
  .strict();
