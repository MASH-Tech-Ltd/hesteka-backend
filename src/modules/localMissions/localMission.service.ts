import mongoose from "mongoose";
import { Request } from "express";
import CustomError from "../../helpers/CustomError";
import { deleteCloudinary, uploadCloudinary } from "../../helpers/cloudinary";
import { paginationHelper } from "../../utils/pagination";
import { role } from "../usersAuth/user.interface";
import { userModel } from "../usersAuth/user.models";
import {
  PointTransactionSource,
  PointTransactionType,
} from "../points/point.interface";
import { pointTransactionModel } from "../points/point.models";
import {
  CreateLocalMissionPayload,
  LocalMissionParticipationStatus,
  LocalMissionStatus,
  UpdateLocalMissionPayload,
} from "./localMission.interface";
import { localMissionModel } from "./localMission.models";
import { localMissionParticipationModel } from "./localMissionParticipation.models";
import { notificationService } from "../notifications/notification.service";
import { NotificationType } from "../notifications/notification.interface";
import { mailer } from "../../helpers/nodeMailer";

const partnerPopulate = "firstName lastName email profileImage company";

const deleteCloudinaryQuietly = async (publicId?: string): Promise<void> => {
  if (!publicId) return;

  try {
    await deleteCloudinary(publicId);
  } catch (error) {
    console.error(`[Cloudinary] Failed to delete ${publicId}:`, error);
  }
};

const getPartnerAccount = async (userId?: unknown) => {
  if (!userId) throw new CustomError(401, "Unauthorized access");

  const partner = await userModel
    .findById(userId)
    .select("_id role company status");
  if (!partner) throw new CustomError(404, "Partner account not found");
  if (partner.role !== role.PARTNERS && partner.role !== role.ADMIN) {
    throw new CustomError(403, "Only partners can manage local missions");
  }
  // Only partners must have a company; admins are exempt
  if (partner.role === role.PARTNERS && !partner.company) {
    throw new CustomError(400, "Partner account must have a company");
  }

  return partner;
};

const normalizeLocation = (location: unknown) => {
  if (!location) return undefined;

  const parsedLocation =
    typeof location === "string" ? JSON.parse(location) : location;
  const coordinates = (parsedLocation as any)?.coordinates;

  if (!Array.isArray(coordinates) || coordinates.length < 2) return undefined;

  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return undefined;

  return {
    type: "Point",
    coordinates: [lng, lat] as [number, number],
  };
};

export const localMissionService = {
  async createLocalMission(req: Request) {
    const partner = await getPartnerAccount(req.user?._id);
    const data = req.body as CreateLocalMissionPayload;
    const image = req.file;
    let photo;

    if (image) {
      photo = await uploadCloudinary(image.path);
    }

    try {
      const location = normalizeLocation(data.location);
      const mission = await localMissionModel.create({
        ...data,
        ...(location ? { location } : {}),
        partner: partner._id.toString(),
        ...(photo ? { photo } : {}),
      });

      // Fire & Forget Notification
      const baseTitle = "Nouvelle mission locale disponible !";
      const baseDesc = `Une nouvelle mission "${mission.title}" vient d'être créée près de chez vous. Participez et gagnez des points !`;

      if (
        mission.location &&
        mission.location.coordinates &&
        mission.location.coordinates.length >= 2
      ) {
        const lng = mission.location.coordinates[0] as number;
        const lat = mission.location.coordinates[1] as number;
        notificationService
          .notifyUsersNearby(
            baseTitle,
            baseDesc,
            NotificationType.NEW_MISSION,
            lat,
            lng,
            20,
            {
              missionId: mission._id.toString(),
              latitude: String(lat),
              longitude: String(lng),
            },
          )
          .catch((err) => console.error("Notification Error:", err));
      }

      notificationService
        .notifyAdmins(
          "Nouvelle mission locale",
          `Le partenaire "${partner.company}" a créé une nouvelle mission "${mission.title}".`,
          NotificationType.NEW_MISSION,
        )
        .catch((err) => console.error("Admin Notification Error:", err));

      return await mission.populate("partner", partnerPopulate);
    } catch (error) {
      await deleteCloudinaryQuietly(photo?.public_id);
      throw error;
    }
  },

  async getAllLocalMissions(req: Request) {
    const {
      page: pagebody,
      limit: limitbody,
      search,
      company,
      from,
      to,
      sort,
      sortBy,
      status = LocalMissionStatus.ACTIVE,
      lat,
      lng,
      radius, // in km, defaults to 5 km when lat/lng provided
    } = req.query;

    const { page, limit, skip } = paginationHelper(
      pagebody as string,
      limitbody as string,
    );
    const filter: any = {};
    const companyQuery =
      typeof company === "string" && company.trim()
        ? company.trim()
        : undefined;

    // Radius / geospatial filter
    const hasGeo = lat !== undefined && lng !== undefined;
    if (hasGeo) {
      const latNum = parseFloat(lat as string);
      const lngNum = parseFloat(lng as string);
      const radiusKm = radius !== undefined ? parseFloat(radius as string) : 5;

      if (isNaN(latNum) || isNaN(lngNum)) {
        throw new CustomError(
          400,
          "Invalid lat/lng values. Must be valid numbers.",
        );
      }
      if (isNaN(radiusKm) || radiusKm <= 0) {
        throw new CustomError(
          400,
          "Invalid radius value. Must be a positive number (km).",
        );
      }

      // Convert km to radians for $centerSphere (Earth radius = 6378.1 km)
      filter.location = {
        $geoWithin: {
          $centerSphere: [[lngNum, latNum], radiusKm / 6378.1],
        },
      };
    }

    if (companyQuery) {
      const partners = await userModel
        .find({
          role: role.PARTNERS,
          company: { $regex: companyQuery, $options: "i" },
        })
        .select("_id")
        .lean();
      filter.partner = { $in: partners.map((partner) => partner._id) };
    }
    if (status && status !== "all") filter.status = status;
    if (search) {
      const searchRegex = new RegExp(search as string, "i");
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { address: searchRegex },
        { duration: searchRegex },
      ];
    }

    if (from || to) {
      const isValidDate = (date: any) => {
        const parsedDate = new Date(date);
        return !Number.isNaN(parsedDate.getTime());
      };

      if (from && !isValidDate(from)) {
        throw new CustomError(
          400,
          "Invalid 'from' date. Format must be YYYY-MM-DD or ISO",
        );
      }

      if (to && !isValidDate(to)) {
        throw new CustomError(
          400,
          "Invalid 'to' date. Format must be YYYY-MM-DD or ISO",
        );
      }

      if (from && to && new Date(from as string) > new Date(to as string)) {
        throw new CustomError(
          400,
          "'from' date cannot be greater than 'to' date",
        );
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
      throw new CustomError(
        400,
        "Invalid sort value. Must be 'ascending' or 'descending'",
      );
    }

    const sortFields: Record<string, string> = {
      name: "title",
      title: "title",
      date: "createdAt",
      points: "points",
    };
    const sortByValue = typeof sortBy === "string" ? sortBy : "date";
    const sortField = sortFields[sortByValue.toLowerCase()] ?? null;
    if (!sortField) {
      throw new CustomError(
        400,
        `Invalid sortBy value. Must be one of: ${Object.keys(sortFields).join(", ")}`,
      );
    }
    const sortOrder: 1 | -1 = sort === "ascending" ? 1 : -1;

    const [missions, total] = await Promise.all([
      localMissionModel
        .find(filter)
        .populate("partner", partnerPopulate)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      localMissionModel.countDocuments(filter),
    ]);

    return {
      missions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getMyLocalMissions(req: Request) {
    const partner = await getPartnerAccount(req.user?._id);
    const missions = await localMissionModel
      .find({ partner: partner._id })
      .populate("partner", partnerPopulate)
      .sort({ createdAt: -1 })
      .lean();

    const missionsWithStats = await Promise.all(
      missions.map(async (mission) => {
        const participantsCount =
          await localMissionParticipationModel.countDocuments({
            mission: mission._id,
          });
        return { ...mission, participantsCount };
      }),
    );

    return missionsWithStats;
  },

  async getLocalMissionParticipants(req: Request) {
    const partner = await getPartnerAccount(req.user?._id);
    const missionId = req.params.missionId as string;

    const mission = await localMissionModel.findById(missionId);
    if (!mission) throw new CustomError(404, "Local mission not found");
    if (
      partner.role !== role.ADMIN &&
      mission.partner.toString() !== partner._id.toString()
    ) {
      throw new CustomError(
        403,
        "You can only view participants for your own local missions",
      );
    }

    return await localMissionParticipationModel
      .find({ mission: mission._id })
      .populate(
        "user",
        "firstName lastName email profileImage pointsBalance phone address postalCode country",
      )
      .sort({ createdAt: -1 });
  },

  async getLocalMissionById(req: Request) {
    const missionId = req.params.missionId as string;
    const userId = req.user?._id;

    const mission = await localMissionModel
      .findById(missionId)
      .populate("partner", partnerPopulate)
      .lean();
    if (!mission) throw new CustomError(404, "Local mission not found");

    let isJoined = false;
    let participationStatus: string | null = null;

    if (userId) {
      const participation = await localMissionParticipationModel.findOne({
        user: userId,
        mission: missionId,
      });
      if (participation) {
        isJoined =
          participation.status !== LocalMissionParticipationStatus.REJECTED;
        participationStatus = participation.status;
      }
    }

    return {
      ...mission,
      isJoined,
      participationStatus,
    };
  },

  async joinLocalMission(req: Request) {
    const userId = req.user?._id;
    const missionId = req.params.missionId as string;
    if (!userId) throw new CustomError(401, "Unauthorized access");

    const mission = await localMissionModel.findOne({
      _id: missionId,
      status: LocalMissionStatus.ACTIVE,
    });
    if (!mission) throw new CustomError(404, "Active local mission not found");

    const isEnglish = (req.headers["accept-language"] || "fr")
      .toLowerCase()
      .startsWith("en");

    if (mission.missionDate && new Date(mission.missionDate).getTime() < Date.now()) {
      throw new CustomError(
        400,
        isEnglish
          ? "This local mission has expired"
          : "Cette mission locale a expiré",
      );
    }

    try {
      const participation = await localMissionParticipationModel.create({
        user: userId,
        mission: mission._id,
      });

      const populatedMission = await mission.populate(
        "partner",
        partnerPopulate,
      );
      const user = await userModel.findById(userId);

      if (user && populatedMission) {
        const partner = populatedMission.partner as any;

        const partnerName =
          partner.company || partner.firstName + " " + partner.lastName;

        // Generate email template based on language
        const emailTemplate = isEnglish
          ? `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h2 style="color: #BA4A22;">Registration Confirmation</h2>
              <p>Hello <strong>${user.firstName}</strong>,</p>
              <p>Thank you for your commitment! Your enrollment in the local mission <strong>${populatedMission.title}</strong> has been successfully registered.</p>
              <p><strong>Mission Details:</strong></p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="8" border="0" style="background-color:#f9fafb; border-radius:6px; border:1px solid #eef2f7;">
                <tr><td><strong>Organizer:</strong></td><td>${partnerName}</td></tr>
                <tr><td><strong>Address:</strong></td><td>${populatedMission.address}</td></tr>
                <tr><td><strong>Duration:</strong></td><td>${populatedMission.duration}</td></tr>
                <tr><td><strong>Points to earn:</strong></td><td>${populatedMission.points || 0} pts</td></tr>
              </table>
              <p style="margin-top:20px;">The mission organizer has been notified of your registration. They will contact you if necessary to coordinate your participation.</p>
              <p>Thank you for advancing great causes with HESTEKA!</p>
              <p style="margin-top:25px; border-top:1px solid #eef2f7; padding-top:15px; font-size:12px; color:#9ca3af;">HESTEKA Team</p>
            </div>
          `
          : `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h2 style="color: #BA4A22;">Confirmation d'inscription</h2>
              <p>Bonjour <strong>${user.firstName}</strong>,</p>
              <p>Merci pour votre engagement ! Votre inscription à la mission locale <strong>${populatedMission.title}</strong> a bien été enregistrée.</p>
              <p><strong>Détails de la mission :</strong></p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="8" border="0" style="background-color:#f9fafb; border-radius:6px; border:1px solid #eef2f7;">
                <tr><td><strong>Organisateur :</strong></td><td>${partnerName}</td></tr>
                <tr><td><strong>Adresse :</strong></td><td>${populatedMission.address}</td></tr>
                <tr><td><strong>Durée :</strong></td><td>${populatedMission.duration}</td></tr>
                <tr><td><strong>Points à gagner :</strong></td><td>${populatedMission.points || 0} pts</td></tr>
              </table>
              <p style="margin-top:20px;">L'organisateur de la mission a été informé de votre inscription. Il vous contactera si nécessaire pour coordonner votre participation.</p>
              <p>Merci de faire avancer de belles causes avec HESTEKA !</p>
              <p style="margin-top:25px; border-top:1px solid #eef2f7; padding-top:15px; font-size:12px; color:#9ca3af;">L'équipe HESTEKA</p>
            </div>
          `;

        const subject = isEnglish
          ? `Mission Registration Confirmation: ${populatedMission.title}`
          : `Confirmation d'inscription à la mission : ${populatedMission.title}`;

        mailer({
          email: user.email,
          subject,
          template: emailTemplate,
        }).catch((err) =>
          console.error(
            "[Mailer] Failed to send mission confirmation email to user:",
            err,
          ),
        );

        // User in-app notification
        const userNotifTitle = isEnglish
          ? "Registration Registered"
          : "Inscription enregistrée";
        const userNotifBody = isEnglish
          ? `Your registration for the mission "${populatedMission.title}" has been successfully registered.`
          : `Votre inscription à la mission "${populatedMission.title}" a été enregistrée avec succès.`;

        notificationService
          .notifySingleUser(
            user._id.toString(),
            userNotifTitle,
            userNotifBody,
            NotificationType.SYSTEM,
          )
          .catch((err) =>
            console.error("[Notification] Failed to notify user:", err),
          );

        // Partner in-app notification
        const partnerNotifTitle = isEnglish
          ? "New Participant!"
          : "Nouveau participant !";
        const partnerNotifBody = isEnglish
          ? `The user "${user.firstName} ${user.lastName}" has registered for your mission "${populatedMission.title}".`
          : `L'utilisateur "${user.firstName} ${user.lastName}" s'est inscrit à votre mission "${populatedMission.title}".`;

        notificationService
          .notifySingleUser(
            partner._id.toString(),
            partnerNotifTitle,
            partnerNotifBody,
            NotificationType.SYSTEM,
          )
          .catch((err) =>
            console.error("[Notification] Failed to notify partner:", err),
          );
      }

      return {
        mission: populatedMission,
        participation,
      };
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new CustomError(
          409,
          isEnglish
            ? "You already joined this local mission"
            : "Vous avez déjà rejoint cette mission locale",
        );
      }
      throw error;
    }
  },

  async approveLocalMissionParticipant(req: Request) {
    const partner = await getPartnerAccount(req.user?._id);
    const participationId = req.params.participationId as string;

    const participation =
      await localMissionParticipationModel.findById(participationId);
    if (!participation)
      throw new CustomError(404, "Local mission participation not found");
    if (participation.status === LocalMissionParticipationStatus.COMPLETED) {
      throw new CustomError(
        409,
        "This local mission is already completed by this user",
      );
    }

    const mission = await localMissionModel.findById(participation.mission);
    if (!mission) throw new CustomError(404, "Local mission not found");
    if (
      partner.role !== role.ADMIN &&
      mission.partner.toString() !== partner._id.toString()
    ) {
      throw new CustomError(
        403,
        "You can only approve your own local mission participants",
      );
    }

    const points = mission.points ?? 0;
    const session = await mongoose.startSession();

    try {
      let result: any;

      await session.withTransaction(async () => {
        const transaction = await pointTransactionModel.create(
          [
            {
              user: participation.user,
              mission: mission._id,
              type: PointTransactionType.EARN,
              source: PointTransactionSource.LOCAL_MISSION,
              points,
              note: `Completed local mission: ${mission.title}`,
            },
          ],
          { session },
        );

        const updatedParticipation = await localMissionParticipationModel
          .findOneAndUpdate(
            {
              _id: participation._id,
              status: LocalMissionParticipationStatus.PENDING,
            },
            {
              status: LocalMissionParticipationStatus.COMPLETED,
              pointsAwarded: points,
              completedAt: new Date(),
            },
            { returnDocument: "after", session },
          )
          .populate(
            "user",
            "firstName lastName email profileImage pointsBalance",
          );

        if (!updatedParticipation) {
          throw new CustomError(
            409,
            "This local mission is already completed by this user",
          );
        }

        const updatedUser = await userModel
          .findByIdAndUpdate(
            participation.user,
            { $inc: { pointsBalance: points } },
            { returnDocument: "after", session },
          )
          .select("pointsBalance");

        if (!updatedUser) throw new CustomError(404, "User not found");

        result = {
          participation: updatedParticipation,
          earnedPoints: points,
          balance: updatedUser.pointsBalance ?? 0,
          transaction: transaction[0],
        };
      });

      // Fire & Forget Notification
      if (result && result.participation) {
        notificationService
          .notifySingleUser(
            participation.user.toString(),
            "Points gagnés !",
            `Félicitations ! Vous avez gagné ${points} points pour votre participation à la mission "${mission.title}".`,
            NotificationType.POINTS_EARNED,
          )
          .catch((err) => console.error("Notification Error:", err));
      }

      return result;
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new CustomError(
          409,
          "Points were already awarded for this local mission",
        );
      }
      throw error;
    } finally {
      await session.endSession();
    }
  },

  async leaveLocalMission(req: Request) {
    const userId = req.user?._id;
    const missionId = req.params.missionId as string;
    if (!userId) throw new CustomError(401, "Unauthorized access");

    const participation = await localMissionParticipationModel.findOneAndDelete(
      {
        user: userId,
        mission: missionId,
        status: LocalMissionParticipationStatus.PENDING,
      },
    );
    if (!participation) {
      throw new CustomError(
        404,
        "Active local mission participation not found for this user",
      );
    }

    return participation;
  },

  async rejectLocalMissionParticipant(req: Request) {
    const partner = await getPartnerAccount(req.user?._id);
    const participationId = req.params.participationId as string;

    const participation =
      await localMissionParticipationModel.findById(participationId);
    if (!participation)
      throw new CustomError(404, "Local mission participation not found");
    if (participation.status !== LocalMissionParticipationStatus.PENDING) {
      throw new CustomError(
        409,
        `This local mission participation is already ${participation.status}`,
      );
    }

    const mission = await localMissionModel.findById(participation.mission);
    if (!mission) throw new CustomError(404, "Local mission not found");
    if (
      partner.role !== role.ADMIN &&
      mission.partner.toString() !== partner._id.toString()
    ) {
      throw new CustomError(
        403,
        "You can only reject your own local mission participants",
      );
    }

    const updatedParticipation = await localMissionParticipationModel
      .findByIdAndUpdate(
        participation._id,
        {
          status: LocalMissionParticipationStatus.REJECTED,
        },
        { new: true },
      )
      .populate("user", "firstName lastName email profileImage pointsBalance");

    if (updatedParticipation) {
      const isEnglish = (req.headers["accept-language"] || "fr")
        .toLowerCase()
        .startsWith("en");

      // Send localized notification to user
      const userNotifTitle = isEnglish
        ? "Mission not approved"
        : "Mission non validée";
      const userNotifBody = isEnglish
        ? `Your participation in the mission "${mission.title}" was not approved.`
        : `Votre participation à la mission "${mission.title}" n'a pas été validée.`;

      notificationService
        .notifySingleUser(
          participation.user.toString(),
          userNotifTitle,
          userNotifBody,
          NotificationType.SYSTEM,
        )
        .catch((err) => console.error("Notification Error:", err));
    }

    return updatedParticipation;
  },

  async updateLocalMission(req: Request) {
    const partner = await getPartnerAccount(req.user?._id);
    const { missionId } = req.params;
    const data = req.body as UpdateLocalMissionPayload;
    const image = req.file;

    const mission = await localMissionModel.findById(missionId);
    if (!mission) throw new CustomError(404, "Local mission not found");
    if (
      partner.role !== role.ADMIN &&
      mission.partner.toString() !== partner._id.toString()
    ) {
      throw new CustomError(403, "You can only update your own local missions");
    }

    const oldPublicIdToDelete = image ? mission.photo?.public_id : undefined;
    let newPublicIdToDeleteOnFailure: string | undefined;

    const location = normalizeLocation(data.location);
    Object.assign(mission, data);
    if (location) {
      mission.location = location as any;
    }

    if (image) {
      const uploaded = await uploadCloudinary(image.path);
      mission.photo = uploaded;
      newPublicIdToDeleteOnFailure = uploaded.public_id;
    }

    try {
      await mission.save();
    } catch (error) {
      await deleteCloudinaryQuietly(newPublicIdToDeleteOnFailure);
      throw error;
    }

    await deleteCloudinaryQuietly(oldPublicIdToDelete);
    return await mission.populate("partner", partnerPopulate);
  },

  async deleteLocalMission(req: Request) {
    const partner = await getPartnerAccount(req.user?._id);
    const { missionId } = req.params;

    const mission = await localMissionModel.findById(missionId);
    if (!mission) throw new CustomError(404, "Local mission not found");
    if (
      partner.role !== role.ADMIN &&
      mission.partner.toString() !== partner._id.toString()
    ) {
      throw new CustomError(403, "You can only delete your own local missions");
    }

    // Fire & Forget Notifications to all participants
    try {
      const participants = await localMissionParticipationModel.find({
        mission: mission._id,
      });
      participants.forEach((p) => {
        notificationService
          .notifySingleUser(
            p.user.toString(),
            "Mission annulée",
            `La mission locale "${mission.title}" a été annulée par le partenaire.`,
            NotificationType.MISSION_CANCELLED,
          )
          .catch((err) => console.error("Notification Error:", err));
      });
    } catch (err) {
      console.error("Failed to notify participants on mission deletion:", err);
    }

    await mission.deleteOne();
    await deleteCloudinaryQuietly(mission.photo?.public_id);
    return true;
  },
};
