import cron from "node-cron";
import { reportModel } from "./report.models";
import { adminService } from "../admin/admin.service";

export const startReportPointsCron = () => {
  // Run every day at 2:00 AM server time
  cron.schedule("0 2 * * *", async () => {
    console.log("[Report Cron] Starting daily check for 7-day old reports to award points...");
    try {
      // Calculate date 7 days ago
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const eligibleReports = await reportModel.find({
        isPointApproved: false,
        isDeleted: { $ne: true },
        createdAt: { $lte: sevenDaysAgo },
      }).select("_id");

      if (eligibleReports.length === 0) {
        console.log("[Report Cron] No eligible reports found for point approval today.");
        return;
      }

      console.log(`[Report Cron] Found ${eligibleReports.length} eligible reports. Approving points...`);

      let successCount = 0;
      let failureCount = 0;

      for (const report of eligibleReports) {
        try {
          await adminService.approveReportPoints(report._id.toString());
          successCount++;
        } catch (err) {
          console.error(`[Report Cron] Failed to approve points for report ${report._id}:`, err);
          failureCount++;
        }
      }

      console.log(`[Report Cron] Finished point approval. Success: ${successCount}, Failures: ${failureCount}`);
    } catch (error) {
      console.error("[Report Cron] Error during 7-day point approval check:", error);
    }
  });
  
  console.log("[Cron] Report 7-day point approval cron job initialized.");
};
