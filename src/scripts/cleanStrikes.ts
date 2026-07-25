import mongoose from "mongoose";
import dotenv from "dotenv";
import config from "../config";
import { blockedIpModel, securityLogModel } from "../modules/security/security.models";
import { ipCache } from "../modules/security/security.service";

dotenv.config();

const run = async () => {
  try {
    const mongoUrl = config.mongoUri || "mongodb://127.0.0.1:27017/hesteka";
    await mongoose.connect(mongoUrl);
    console.log("Connected to MongoDB...");

    // Reset strike flag on all existing security logs so strike count starts at 0
    const resLogs = await securityLogModel.updateMany({}, { $set: { resetStrike: true } });
    console.log(`Updated ${resLogs.modifiedCount} security logs to resetStrike = true.`);

    // Remove any blocked IPs created during testing
    const resBlocked = await blockedIpModel.deleteMany({ ip: "103.216.58.105" });
    console.log(`Deleted ${resBlocked.deletedCount} blocked IP entries for 103.216.58.105.`);
    ipCache.delete("103.216.58.105");

    console.log("Strike history cleaned and test IP unblocked successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error cleaning strikes:", error);
    process.exit(1);
  }
};

run();
