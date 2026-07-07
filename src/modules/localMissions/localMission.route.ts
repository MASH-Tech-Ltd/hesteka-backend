import { Router } from "express";
import { authGuard, allowRole } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/multer.midleware";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import {
  approveLocalMissionParticipant,
  createLocalMission,
  deleteLocalMission,
  getAllLocalMissions,
  getLocalMissionById,
  getLocalMissionParticipants,
  getMyLocalMissions,
  joinLocalMission,
  leaveLocalMission,
  rejectLocalMissionParticipant,
  updateLocalMission,
} from "./localMission.controller";
import { localMissionValidation } from "./localMission.validation";

const router = Router();

router.get("/get-all-local-missions", getAllLocalMissions);
router.get(
  "/get-single-local-mission/:missionId",
  authGuard,
  getLocalMissionById,
);
router.post(
  "/join-local-mission/:missionId",
  authGuard,
  allowRole("user"),
  joinLocalMission,
);
router.post(
  "/leave-local-mission/:missionId",
  authGuard,
  allowRole("user"),
  leaveLocalMission,
);

router.use(authGuard, allowRole("partners", "admin"));

router.get("/get-my-local-missions", getMyLocalMissions);
router.get(
  "/get-local-mission-participants/:missionId",
  getLocalMissionParticipants,
);
router.patch(
  "/approve-local-mission/:participationId",
  approveLocalMissionParticipant,
);
router.patch(
  "/reject-local-mission/:participationId",
  rejectLocalMissionParticipant,
);

router.post(
  "/create-local-mission",
  upload.single("image"),
  validateRequest(localMissionValidation.createLocalMissionSchema),
  createLocalMission,
);

router.patch(
  "/update-local-mission/:missionId",
  upload.single("image"),
  validateRequest(localMissionValidation.updateLocalMissionSchema),
  updateLocalMission,
);

router.delete("/delete-local-mission/:missionId", deleteLocalMission);

export const localMissionRoute = router;
