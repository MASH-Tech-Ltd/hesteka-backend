import cron from "node-cron";
import { userModel } from "../usersAuth/user.models";
import { status, role } from "../usersAuth/user.interface";
import { rewardService } from "./reward.service";

export const startRewardEligibilityCron = () => {
  // Run every day at 12:00 PM (noon) server time.
  cron.schedule("0 12 * * *", () => {
    // Calculate a random delay between 0 and 6 hours (in milliseconds)
    // This satisfies the "random time everyday" requirement, preventing all notifications
    // from going out exactly at noon.
    const randomDelayMs = Math.floor(Math.random() * 6 * 60 * 60 * 1000);
    
    console.log(`[Reward Cron] Scheduled reward eligibility check to run in ${randomDelayMs / 1000 / 60} minutes.`);

    setTimeout(async () => {
      console.log("[Reward Cron] Starting daily reward eligibility check...");
      try {
        const users = await userModel.find({ status: status.ACTIVE, role: role.USER }).select("_id pointsBalance");
        for (const user of users) {
          await rewardService.checkAndNotifyRewardEligibility(user._id.toString(), user.pointsBalance || 0);
        }
        console.log(`[Reward Cron] Completed reward eligibility check for ${users.length} users.`);
      } catch (error) {
        console.error("[Reward Cron] Error during reward eligibility check:", error);
      }
    }, randomDelayMs);
  });
  
  console.log("[Cron] Reward eligibility cron job initialized.");
};
