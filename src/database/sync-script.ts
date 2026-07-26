import "dotenv/config";
import mongoose from "mongoose";
import chalk from "chalk";
import { connectDatabase } from "./db";
import { runBackup } from "./backup.cron";

// Import index api router to ensure all modules/models are registered on mongoose
import "../routes/index.api";

const runManualSync = async () => {
  console.log(chalk.blue.bold("\n--- Starting Manual Data Sync Script ---"));
  
  try {
    // 1. Connect to the primary database
    await connectDatabase();
    
    // 2. Trigger the sync/backup process
    const result = await runBackup();
    
    if (result && result.success) {
      console.log(chalk.green.bold("\n[Sync Script] Manual sync completed successfully!"));
      console.log(chalk.green(`Backup file created: ${result.backupFile}`));
    } else {
      console.log(chalk.yellow.bold("\n[Sync Script] Sync did not complete or was skipped."));
      if (result && result.message) {
        console.log(chalk.yellow(`Reason: ${result.message}`));
      }
    }
  } catch (error) {
    console.error(chalk.red.bold("\n[Sync Script] Manual sync script failed!"), error);
  } finally {
    // Close mongoose connections
    await mongoose.connection.close();
    console.log(chalk.blue("Disconnected from primary database. Exit."));
    process.exit(0);
  }
};

runManualSync();

// npx ts-node --transpile-only src/database/sync-script.ts

