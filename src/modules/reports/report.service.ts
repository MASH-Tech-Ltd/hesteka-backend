import mongoose from "mongoose";
import { Request } from "express";
import { reportModel } from "./report.models";
import CustomError from "../../helpers/CustomError";
import { uploadCloudinary, deleteCloudinary } from "../../helpers/cloudinary";
import { CreateReportPayload, UpdateReportPayload } from "./report.interface";
import { commentService } from "../comments/comment.service";
import { notificationService } from "../notifications/notification.service";
import { NotificationType } from "../notifications/notification.interface";
import { getIo } from "../../socket/server";
import { userModel } from "../usersAuth/user.models";
import { pointTransactionModel } from "../points/point.models";
import { PointTransactionType, PointTransactionSource } from "../points/point.interface";
import { pointConfigModel } from "../points/pointConfig.models";
import { myanimalModel } from "../myanimal/myanimal.models";


const deleteCloudinaryQuietly = async (publicId?: string): Promise<void> => {
  if (!publicId) return;

  try {
    await deleteCloudinary(publicId);
  } catch (error) {
    console.error(`[Cloudinary] Failed to delete ${publicId}:`, error);
  }
};

export const reportService = {
  // Create a new report
  async createReport(req: Request) {
    const authorId = req.user?._id;
    if (!authorId) throw new CustomError(401, "Unauthorized");
    const body = req.body;
    const { myAnimalId, ...reportBody } = body;
    let locationData = undefined;
    let sourceAnimal = undefined;

    if (myAnimalId) {
      sourceAnimal = await myanimalModel.findById(myAnimalId).lean();
      if (!sourceAnimal) {
        throw new CustomError(404, "Animal not found");
      }
      if (sourceAnimal.user.toString() !== authorId.toString()) {
        throw new CustomError(403, "You can only report your own animal");
      }
    }

    // Parse location if it comes stringified
    if (body.location && typeof body.location === 'string') {
      try {
        locationData = JSON.parse(body.location);
      } catch (e) {
        throw new CustomError(400, "Invalid JSON format in location field.");
      }
    } else if (body.location) {
      locationData = body.location;
    }

    // Process images
    const multerFiles = req.files as { [fieldname: string]: Express.Multer.File[] };
    const files = multerFiles?.["images"] || [];
    let images: {
      public_id: string;
      secure_url: string;
      source: "reportUpload" | "myAnimalPhoto";
      ownedByReport: boolean;
    }[] = [];

    if (files && files.length > 0) {
      if (files.length > 3) {
        throw new CustomError(400, "Maximum of 3 images allowed");
      }
      for (const file of files) {
        const result = await uploadCloudinary(file.path);
        if (result) {
          images.push({
            public_id: result.public_id,
            secure_url: result.secure_url,
            source: "reportUpload",
            ownedByReport: true,
          });
        }
      }
    } else if (sourceAnimal?.photo?.public_id && sourceAnimal?.photo?.secure_url) {
      images.push({
        public_id: sourceAnimal.photo.public_id,
        secure_url: sourceAnimal.photo.secure_url,
        source: "myAnimalPhoto",
        ownedByReport: false,
      });
    }

    const payload: any = {
      ...reportBody,
      location: locationData,
      images,
      author: authorId,
      ...(sourceAnimal ? { sourceAnimal: sourceAnimal._id } : {}),
    };

    // Auto-generate title if missing
    if (!payload.title && payload.animalName) {
      const statusLabel = payload.status.charAt(0).toUpperCase() + payload.status.slice(1);
      payload.title = `${statusLabel} ${payload.species} - ${payload.animalName}`;
    }

    if (payload.isPhoneVisible === 'true') payload.isPhoneVisible = true;
    if (payload.isPhoneVisible === 'false') payload.isPhoneVisible = false;
    if (payload.isEmailVisible === 'true') payload.isEmailVisible = true;
    if (payload.isEmailVisible === 'false') payload.isEmailVisible = false;

    const newReport = await reportModel.create(payload);

    // Award Points
    try {
      const config = await pointConfigModel.findOne();
      const pointsToAward = config?.pointsPerReport || 10;

      await userModel.findByIdAndUpdate(authorId, {
        $inc: { pointsBalance: pointsToAward }
      });

      await pointTransactionModel.create({
        user: authorId,
        type: PointTransactionType.EARN,
        source: PointTransactionSource.ANIMAL_REPORT,
        points: pointsToAward,
        note: `Reward for report: ${newReport.title || newReport.animalName}`,
      });

      // Mark report as point-awarded
      newReport.isPointApproved = true;
      await newReport.save();
    } catch (pointError) {
      console.error("Failed to award points for report:", pointError);
    }

    // Fire & Forget Notification
    const friendTitle = "Nouveau signalement !";
    const friendDesc = `Votre ami a créé un nouveau signalement "${newReport.title}".`;
    
    notificationService.notifyFriends(authorId.toString(), friendTitle, friendDesc, NotificationType.NEW_REPORT, { reportId: newReport._id.toString() })
      .catch((err) => console.error("Friend Notification Error:", err));

    const nearbyTitle = "Nouveau signalement à proximité !";
    const nearbyDesc = `Un nouveau signalement "${newReport.title}" vient d'être créé près de chez vous.`;
    
    if (newReport.location && newReport.location.coordinates && newReport.location.coordinates.length >= 2) {
      const lng = newReport.location.coordinates[0] as number;
      const lat = newReport.location.coordinates[1] as number;
      notificationService.notifyUsersNearby(nearbyTitle, nearbyDesc, NotificationType.NEW_REPORT, lat, lng, 15)
        .catch((err) => console.error("Notification Error:", err));
    } else {
      notificationService.notifyUsersNearby(nearbyTitle, nearbyDesc, NotificationType.NEW_REPORT)
        .catch((err) => console.error("Notification Error:", err));
    }

    notificationService.notifyAdmins(
      "Nouveau signalement créé",
      `Un nouveau signalement "${newReport.title}" nécessite votre attention.`,
      NotificationType.NEW_REPORT
    ).catch((err) => console.error("Admin Notification Error:", err));

    try {
      const io = getIo();
      io.emit("report_new", newReport);
    } catch (err) {}

    return newReport;
  },

  // Get all reports (with optional advanced filtering)
  async getAllReports(req: Request) {
    const {
      page = 1,
      limit = 10,
      search,
      status = "all", // lost, found, rescued, sighted, all
      from, // date range start
      to, // date range end
      species,
      sortBy,
      sort = "ascending", // default ascending
      lat,
      lng,
      radius, // in km, defaults to 5 km when lat/lng are provided
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const perPage = Number(limit);

    // Build filter object
    const filter: any = {};

    // Radius / geospatial filter
    const hasGeo = lat !== undefined && lng !== undefined;
    if (hasGeo) {
      const latNum = parseFloat(lat as string);
      const lngNum = parseFloat(lng as string);
      const radiusKm = radius !== undefined ? parseFloat(radius as string) : 5;

      if (isNaN(latNum) || isNaN(lngNum)) {
        throw new CustomError(400, "Invalid lat/lng values. Must be valid numbers.");
      }
      if (isNaN(radiusKm) || radiusKm <= 0) {
        throw new CustomError(400, "Invalid radius value. Must be a positive number (km).");
      }

      // Convert km to radians for $centerSphere (Earth radius = 6378.1 km)
      filter.location = {
        $geoWithin: {
          $centerSphere: [[lngNum, latNum], radiusKm / 6378.1],
        },
      };
    }

    // Search (title/breed/description)
    if (search) {
      const searchRegex = new RegExp(search as string, "i");
      filter.$or = [
        { animalName: searchRegex },
        { title: searchRegex },
        { breed: searchRegex },
        { description: searchRegex },
      ];
    }

    // Status filter
    if (status && status !== "all") {
      const validStatuses = ["lost", "found", "rescued", "sighted"];
      if (!validStatuses.includes(status as string)) {
        throw new CustomError(
          400,
          `Invalid status. Must be one of: ${validStatuses.join(", ")}, or 'all'`
        );
      }
      filter.status = status;
    }

    // Category (Species) filter
    if (species) {
      if (species === "Other") {
        filter.species = { $nin: ["Dog", "Cat", "Bird"] };
      } else {
        filter.species = species;
      }
    }

    // Date range filter
    if (from || to) {
      const isValidDate = (date: any) => {
        const d = new Date(date);
        return !isNaN(d.getTime());
      };

      if (from && !isValidDate(from)) {
        throw new CustomError(400, "Invalid 'from' date. Format must be YYYY-MM-DD or ISO");
      }

      if (to && !isValidDate(to)) {
        throw new CustomError(400, "Invalid 'to' date. Format must be YYYY-MM-DD or ISO");
      }

      if (from && to && new Date(from as string) > new Date(to as string)) {
        throw new CustomError(400, "'from' date cannot be greater than 'to' date");
      }

      filter.createdAt = {};

      if (from) {
        const fromDate = new Date(from as string);
        fromDate.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = fromDate;
      }

      if (to) {
        const toDate = new Date(to as string);
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }

    // $geoWithin is compatible with regular sort — always apply it
    if (sort && sort !== "ascending" && sort !== "descending") {
      throw new CustomError(400, "Invalid sort value. Must be 'ascending' or 'descending'");
    }

    const sortFields: Record<string, string> = {
      date: "createdAt",
      name: "animalName",
      title: "title",
      status: "status",
      species: "species",
    };
    const sortByValue = typeof sortBy === "string" ? sortBy : "date";
    const sortField = sortFields[sortByValue.toLowerCase()] ?? null;
    if (!sortField) {
      throw new CustomError(400, `Invalid sortBy value. Must be one of: ${Object.keys(sortFields).join(", ")}`);
    }
    const sortOrder: 1 | -1 = sort === "descending" ? -1 : 1;

    // Query with pagination and performance optimization
    const [reports, total] = await Promise.all([
      reportModel
        .find(filter)
        .skip(skip)
        .limit(perPage)
        .sort({ [sortField]: sortOrder })
        .populate("author", "firstName lastName email profileImage")
        .populate({
          path: "comments",
          select: "-__v -report",
          populate: [
            { path: "author", select: "firstName lastName profileImage" },
            { path: "replies", select: "-__v", populate: { path: "author", select: "firstName lastName profileImage" } },
            { path: "likes", select: "firstName lastName profileImage" }
          ]
        })
        .lean(),
      reportModel.countDocuments(filter),
    ]);

    // Manually filter out child comments from the main comments array
      reports.forEach((report: any) => {
        if (report.comments && Array.isArray(report.comments)) {
          report.comments = report.comments.filter((c: any) => !c.parent);
        }
      });

    return {
      reports,
      meta: {
        total,
        page: Number(page),
        limit: perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  },

  // Get my reports
  async getMyReports(req: Request) {
    const authorId = req.user?._id;
    if (!authorId) throw new CustomError(401, "Unauthorized");

    const {
      page = 1,
      limit = 10,
      search,
      status = "all", // lost, found, rescued, sighted, all
      from, // date range start
      to, // date range end
      species,
      sortBy,
      sort = "ascending", // default ascending
      lat,
      lng,
      radius, // in km, defaults to 5 km when lat/lng are provided
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const perPage = Number(limit);

    // Build filter object
    const filter: any = { author: authorId };

    // Radius / geospatial filter
    const hasGeo = lat !== undefined && lng !== undefined;
    if (hasGeo) {
      const latNum = parseFloat(lat as string);
      const lngNum = parseFloat(lng as string);
      const radiusKm = radius !== undefined ? parseFloat(radius as string) : 5;

      if (isNaN(latNum) || isNaN(lngNum)) {
        throw new CustomError(400, "Invalid lat/lng values. Must be valid numbers.");
      }
      if (isNaN(radiusKm) || radiusKm <= 0) {
        throw new CustomError(400, "Invalid radius value. Must be a positive number (km).");
      }

      // Convert km to radians for $centerSphere (Earth radius = 6378.1 km)
      filter.location = {
        $geoWithin: {
          $centerSphere: [[lngNum, latNum], radiusKm / 6378.1],
        },
      };
    }

    // Search (title/breed/description)
    if (search) {
      const searchRegex = new RegExp(search as string, "i");
      filter.$or = [
        { animalName: searchRegex },
        { title: searchRegex },
        { breed: searchRegex },
        { description: searchRegex },
      ];
    }

    // Status filter
    if (status && status !== "all") {
      const validStatuses = ["lost", "found", "rescued", "sighted"];
      if (!validStatuses.includes(status as string)) {
        throw new CustomError(
          400,
          `Invalid status. Must be one of: ${validStatuses.join(", ")}, or 'all'`
        );
      }
      filter.status = status;
    }

    // Category (Species) filter
    if (species) {
      filter.species = species;
    }

    // Date range filter
    if (from || to) {
      const isValidDate = (date: any) => {
        const d = new Date(date);
        return !isNaN(d.getTime());
      };

      if (from && !isValidDate(from)) {
        throw new CustomError(400, "Invalid 'from' date. Format must be YYYY-MM-DD or ISO");
      }

      if (to && !isValidDate(to)) {
        throw new CustomError(400, "Invalid 'to' date. Format must be YYYY-MM-DD or ISO");
      }

      if (from && to && new Date(from as string) > new Date(to as string)) {
        throw new CustomError(400, "'from' date cannot be greater than 'to' date");
      }

      filter.createdAt = {};

      if (from) {
        const fromDate = new Date(from as string);
        fromDate.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = fromDate;
      }

      if (to) {
        const toDate = new Date(to as string);
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }

    if (sort && sort !== "ascending" && sort !== "descending") {
      throw new CustomError(400, "Invalid sort value. Must be 'ascending' or 'descending'");
    }

    const sortFields: Record<string, string> = {
      date: "createdAt",
      name: "animalName",
      title: "title",
      status: "status",
      species: "species",
    };
    const sortByValue = typeof sortBy === "string" ? sortBy : "date";
    const sortField = sortFields[sortByValue.toLowerCase()] ?? null;
    if (!sortField) {
      throw new CustomError(400, `Invalid sortBy value. Must be one of: ${Object.keys(sortFields).join(", ")}`);
    }
    const sortOrder: 1 | -1 = sort === "descending" ? -1 : 1;

    // Query with pagination and performance optimization
    const [reports, total] = await Promise.all([
      reportModel
        .find(filter)
        .skip(skip)
        .limit(perPage)
        .sort({ [sortField]: sortOrder })
        .populate("author", "firstName lastName email profileImage")
        .populate({
          path: "comments",
          select: "-__v -report",
          populate: [
            { path: "author", select: "firstName lastName profileImage" },
            { path: "replies", select: "-__v", populate: { path: "author", select: "firstName lastName profileImage" } },
            { path: "likes", select: "firstName lastName profileImage" }
          ]
        })
        .lean(),
      reportModel.countDocuments(filter),
    ]);

    // Manually filter out child comments from the main comments array
    reports.forEach((report: any) => {
      if (report.comments && Array.isArray(report.comments)) {
        report.comments = report.comments.filter((c: any) => !c.parent);
      }
    });

    return {
      reports,
      meta: {
        total,
        page: Number(page),
        limit: perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  },

  // Get a single report by ID
  async getReportById(reportId: string) {
    const report = await reportModel
      .findById(reportId)
      .populate("author", "firstName lastName email profileImage")
      .populate({
        path: "comments",
        select: "-__v -report",
        populate: [
          { path: "author", select: "firstName lastName profileImage" },
          { path: "replies", select: "-__v", populate: { path: "author", select: "firstName lastName profileImage" } },
          { path: "likes", select: "firstName lastName profileImage" }
        ]
      })
      .lean();

    if (!report) {
      throw new CustomError(404, "Report not found");
    }

    // Manually filter out child comments
    if (report.comments && Array.isArray(report.comments)) {
      report.comments = report.comments.filter((c: any) => !c.parent);
    }

    return report;
  },

  // Update a report
  async updateReport(req: Request) {
    const authorId = req.user?._id;
    const { reportId } = req.params;
    const body = req.body;

    const report = await reportModel.findById(reportId);

    if (!report) {
      throw new CustomError(404, "Report not found");
    }

    const userRole = req.user?.role;
    // Verify ownership
    if (userRole !== "admin" && report.author.toString() !== authorId?.toString()) {
      throw new CustomError(403, "You are not authorized to update this report");
    }

    let locationData = report.location;
    // Parse location if it comes stringified
    if (body.location && typeof body.location === 'string') {
      try {
        locationData = JSON.parse(body.location);
      } catch (e) {
        throw new CustomError(400, "Invalid JSON format in location field.");
      }
    } else if (body.location) {
      locationData = body.location;
    }

    const multerFiles = req.files as { [fieldname: string]: Express.Multer.File[] };
    const files = multerFiles?.["images"] || [];
    let images = report.images;
    const oldPublicIdsToDelete: string[] = [];
    const newPublicIdsToDeleteOnFailure: string[] = [];

    if (files && files.length > 0) {
      if (files.length > 3) {
        throw new CustomError(400, "Maximum of 3 images allowed");
      }

      if (images && images.length > 0) {
        for (const img of images) {
          if (img.public_id && img.ownedByReport !== false) {
            oldPublicIdsToDelete.push(img.public_id);
          }
        }
      }

      images = [];
      for (const file of files) {
      const result = await uploadCloudinary(file.path);
      if (result) {
        images.push({
          public_id: result.public_id,
          secure_url: result.secure_url,
          source: "reportUpload",
          ownedByReport: true,
        });
        newPublicIdsToDeleteOnFailure.push(result.public_id);
      }
      }
    }

    const payload: any = {
      ...body,
      location: locationData,
      images,
    };

    // Auto-generate title if missing or animalName changed and title is empty
    if (!payload.title && (payload.animalName || report.animalName)) {
      const animalName = payload.animalName || report.animalName;
      const species = payload.species || report.species;
      const status = payload.status || report.status;
      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
      payload.title = `${statusLabel} ${species} - ${animalName}`;
    }

    if (payload.isPhoneVisible === 'true') payload.isPhoneVisible = true;
    if (payload.isPhoneVisible === 'false') payload.isPhoneVisible = false;
    if (payload.isEmailVisible === 'true') payload.isEmailVisible = true;
    if (payload.isEmailVisible === 'false') payload.isEmailVisible = false;

    let updatedReport;
    try {
      updatedReport = await reportModel.findByIdAndUpdate(
        reportId,
        payload,
        { returnDocument: 'after', runValidators: true }
      );
    } catch (error) {
      await Promise.all(newPublicIdsToDeleteOnFailure.map(deleteCloudinaryQuietly));
      throw error;
    }

    await Promise.all(oldPublicIdsToDelete.map(deleteCloudinaryQuietly));

    try {
      const io = getIo();
      io.emit("report_updated", updatedReport);
    } catch (err) {}

    return updatedReport;
  },

  // Delete a report
  async deleteReport(authorId: string, reportId: string, userRole?: string) {
    const session = await mongoose.startSession();
    session.startTransaction();
    const publicIdsToDelete: string[] = [];
    try {
      const report = await reportModel.findById(reportId).session(session);

      if (!report) {
        throw new CustomError(404, "Report not found");
      }

      // Verify ownership
      if (report.author.toString() !== authorId && userRole !== "admin") {
        throw new CustomError(403, "You are not authorized to delete this report");
      }

      // 1. Delete associated comments (Cascade)
      publicIdsToDelete.push(
        ...(await commentService.deleteAllCommentsByReport(reportId, session)),
      );

      // 2. Delete the report document
      await reportModel.findByIdAndDelete(reportId).session(session);

      // 3. Delete associated images from Cloudinary
      if (report.images && report.images.length > 0) {
        for (const img of report.images) {
          if (img.public_id && img.ownedByReport !== false) {
            publicIdsToDelete.push(img.public_id);
          }
        }
      }

      await session.commitTransaction();
      await Promise.all(
        publicIdsToDelete.map(async (publicId) => {
          try {
            await deleteCloudinary(publicId);
          } catch (error) {
            console.error(`[Cloudinary] Failed to delete ${publicId}:`, error);
          }
        }),
      );

      try {
        const io = getIo();
        io.emit("report_deleted", { reportId });
      } catch (err) {}

      return true;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  },

  // Add an image to a report
  async addImage(req: Request) {
    const authorId = req.user?._id;
    const { reportId } = req.params;
    const image = req.file;

    if (!image) {
      throw new CustomError(400, "Please upload an image");
    }

    const report = await reportModel.findById(reportId);
    if (!report) {
      throw new CustomError(404, "Report not found");
    }

    // Verify ownership
    if (report.author.toString() !== authorId?.toString()) {
      throw new CustomError(403, "You are not authorized to modify this report");
    }

    // Check count limit
    if (report.images.length >= 3) {
      throw new CustomError(400, "Maximum of 3 images allowed");
    }

    const result = await uploadCloudinary(image.path);
    if (!result) {
      throw new CustomError(500, "Failed to upload image");
    }

    report.images.push({
      public_id: result.public_id,
      secure_url: result.secure_url,
      source: "reportUpload",
      ownedByReport: true,
    });
    await report.save();

    return report;
  },

  // Remove an image from a report
  async removeImage(req: Request) {
    const authorId = req.user?._id;
    const { reportId } = req.params;
    const { public_id } = req.body;

    if (!public_id) {
      throw new CustomError(400, "Please provide public_id of the image to remove");
    }

    const report = await reportModel.findById(reportId);
    if (!report) {
      throw new CustomError(404, "Report not found");
    }

    // Verify ownership
    if (report.author.toString() !== authorId?.toString()) {
      throw new CustomError(403, "You are not authorized to modify this report");
    }

    // Check if image exists in report
    const imageToRemove = report.images.find(img => img.public_id === public_id);
    if (!imageToRemove) {
      throw new CustomError(404, "Image not found in this report");
    }

    if (imageToRemove.ownedByReport !== false) {
      await deleteCloudinary(public_id);
    }

    // Remove from array
    report.images = report.images.filter(img => img.public_id !== public_id);
    await report.save();

    return report;
  },
};
