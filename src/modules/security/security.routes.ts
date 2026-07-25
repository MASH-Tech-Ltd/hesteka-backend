import { Router } from "express";
import { authGuard, allowRole } from "../../middleware/auth.middleware";
import { role } from "../usersAuth/user.interface";
import {
  blockIpController,
  unblockIpController,
  getBlockedIpsController,
  getBlockedUsersController,
  toggleBlockUserController,
  getSecurityLogsController,
  syncCacheController,
} from "./security.controller";

const router = Router();

router.use(authGuard, allowRole(role.ADMIN));

router.get("/blocked-ips", getBlockedIpsController);
router.post("/block-ip", blockIpController);
router.delete("/unblock-ip/:id", unblockIpController);

router.get("/blocked-users", getBlockedUsersController);
router.post("/toggle-block-user", toggleBlockUserController);

router.get("/logs", getSecurityLogsController);
router.post("/sync-cache", syncCacheController);

export default router;
