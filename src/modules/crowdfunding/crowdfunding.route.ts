import { Router } from "express";
import { authGuard, allowRole } from "../../middleware/auth.middleware";
import {
  getProjects,
  addProject,
  removeProject,
  getCrowdfundingStats,
  getCrowdfundingDonors,
  setActiveProject
} from "./crowdfunding.controller";

const router = Router();

// Public routes
router.get("/stats", getCrowdfundingStats);

// Admin routes
router.get("/donors", authGuard, allowRole("admin"), getCrowdfundingDonors);
router.get("/projects", authGuard, allowRole("admin"), getProjects);
router.post("/projects", authGuard, allowRole("admin"), addProject);
router.delete("/projects/:slug", authGuard, allowRole("admin"), removeProject);
router.put("/projects/:slug/active", authGuard, allowRole("admin"), setActiveProject);

export const crowdfundingRoute = router;
