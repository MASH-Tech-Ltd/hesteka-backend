import { ZodSchema, ZodError } from "zod";
import { RequestHandler, NextFunction, Request, Response } from "express";
import CustomError from "../helpers/CustomError";

export const validateRequest = (schema: ZodSchema): RequestHandler => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      console.log("req.body in validation middleware", req.body);
      const hasBody = req.body && Object.keys(req.body).length > 0;

      const hasFile =
        !!req.file ||
        (Array.isArray(req.files) && req.files.length > 0) ||
        (req.files &&
          typeof req.files === "object" &&
          Object.keys(req.files).length > 0);

      // If BOTH body and image are missing
      if (!hasBody && !hasFile) {
        return next(
          new CustomError(400, "At least one field should be updated", [
            {
              field: "request",
              message: "Provide at least one field or image to update",
            },
          ]),
        );
      }

      req.body = await schema.parseAsync(req.body ?? {});

      next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        console.error("Validation Error Request Body:", req.body);
        const errors = err.issues.map((issue) => ({
          field: issue.path[0] ?? "unknown",
          message: issue.message,
        }));
        return next(new CustomError(400, "Validation failed", errors));
      }
      next(err);
    }
  };
};
