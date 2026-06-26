import multer, { StorageEngine, MulterError, FileFilterCallback } from "multer";
import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import CustomError from "../helpers/CustomError";

const storage: StorageEngine = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), "public", "temp");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/\s+/g, "_");
    cb(null, `${name}_${timestamp}${ext}`);
  },
});

// ─────────────────────────────────────────────
// Image Upload (existing — for profile, reports, etc.)
// ─────────────────────────────────────────────

const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/csv",
  ];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new CustomError(400, "Invalid file type", [
        { field: "image", message: "Only JPEG, PNG, JPG, WEBP are allowed" },
      ]),
    );
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: imageFileFilter,
});

export const uploadSingle =
  (fieldName: string) => (req: Request, res: Response, next: NextFunction) => {
    const singleUpload = upload.single(fieldName);

    singleUpload(req, res, (err) => {
      if (err) {
        if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
          return next(
            new CustomError(400, "File too large. Maximum size is 15MB", [
              {
                field: fieldName,
                message: "File too large. Maximum size is 15MB",
              },
            ]),
          );
        }

        if (err instanceof CustomError) return next(err);
        return next(new CustomError(400, err.message));
      }
      next();
    });
  };

// ─────────────────────────────────────────────
// Video Upload (for single video uploads)
// ─────────────────────────────────────────────

const videoFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  const allowedTypes = ["video/mp4", "video/webm", "video/quicktime"];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new CustomError(400, "Invalid file type", [
        { field: "video", message: "Only MP4, WEBM, MOV are allowed" },
      ]),
    );
  }
  cb(null, true);
};

const videoUpload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: videoFileFilter,
});

export const uploadVideoSingle =
  (fieldName: string) => (req: Request, res: Response, next: NextFunction) => {
    const singleUpload = videoUpload.single(fieldName);

    singleUpload(req, res, (err) => {
      if (err) {
        if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
          return next(
            new CustomError(400, "File too large. Maximum size is 500MB", [
              {
                field: fieldName,
                message: "File too large. Maximum size is 500MB",
              },
            ]),
          );
        }

        if (err instanceof CustomError) return next(err);
        return next(new CustomError(400, err.message));
      }
      next();
    });
  };

// ─────────────────────────────────────────────
// Media Upload (for chat/stories — mixed image+video+file, multiple)
// ─────────────────────────────────────────────

const mediaFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new CustomError(400, "Invalid file type", [
        {
          field: "media",
          message:
            "Only images, videos (mp4, webm, mov), PDF, and Word files are allowed",
        },
      ]),
    );
  }
  cb(null, true);
};

const mediaUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: mediaFileFilter,
});

export const uploadMediaArray =
  (fieldName: string, maxCount: number) =>
  (req: Request, res: Response, next: NextFunction) => {
    const arrayUpload = mediaUpload.array(fieldName, maxCount);

    arrayUpload(req, res, (err) => {
      if (err) {
        if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
          return next(
            new CustomError(400, "File too large. Maximum size is 100MB", [
              {
                field: fieldName,
                message: "File too large. Maximum 100MB per file",
              },
            ]),
          );
        }

        if (
          err instanceof MulterError &&
          err.code === "LIMIT_UNEXPECTED_FILE"
        ) {
          return next(
            new CustomError(400, `Maximum ${maxCount} files allowed`),
          );
        }

        if (err instanceof CustomError) return next(err);
        return next(new CustomError(400, err.message));
      }
      next();
    });
  };
