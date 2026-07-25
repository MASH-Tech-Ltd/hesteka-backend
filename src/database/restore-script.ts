import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import chalk from "chalk";
import { connectDatabase } from "./db";

// Import index api router to ensure all modules/models are registered on mongoose
import "../routes/index.api";

const runRestore = async () => {
  console.log(chalk.blue.bold("\n--- Database Restore Tool ---"));

  const backupsDir = path.join(process.cwd(), "backups");
  
  if (!fs.existsSync(backupsDir)) {
    console.log(chalk.yellow("No backups directory found."));
    process.exit(0);
  }

  const files = fs.readdirSync(backupsDir).filter(f => f.endsWith(".json.gz"));

  if (files.length === 0) {
    console.log(chalk.yellow("No backup files found in 'backups/' directory."));
    process.exit(0);
  }

  // Get the backup filename from command line arguments
  const targetFileArg = process.argv[2];

  if (!targetFileArg) {
    console.log(chalk.yellow("\nTo restore, please specify one of the backup files listed below:"));
    console.log(chalk.white(`Command: npx ts-node src/database/restore-script.ts <filename>\n`));
    console.log(chalk.bold("Available backups:"));
    files.sort().reverse().forEach(file => {
      const stats = fs.statSync(path.join(backupsDir, file));
      console.log(chalk.gray(`- ${file} (${(stats.size / 1024).toFixed(2)} KB)`));
    });
    process.exit(0);
  }

  const backupFilePath = path.join(backupsDir, targetFileArg);

  if (!fs.existsSync(backupFilePath)) {
    console.error(chalk.red(`Error: Backup file not found at ${backupFilePath}`));
    process.exit(1);
  }

  try {
    console.log(chalk.yellow(`Reading and uncompressing backup: ${targetFileArg}...`));
    const compressed = fs.readFileSync(backupFilePath);
    const jsonString = zlib.gunzipSync(compressed).toString("utf-8");
    const backupData: Record<string, any[]> = JSON.parse(jsonString);

    // Connect to target database
    await connectDatabase();

    const models = mongoose.connection.models;

    console.log(chalk.yellow("\nStarting restoration... (wiping existing collections and restoring)"));

    for (const [modelName, records] of Object.entries(backupData)) {
      const model = models[modelName];
      if (!model) {
        console.warn(chalk.yellow(`[Restore] Skipping ${modelName}: model is not registered in this codebase.`));
        continue;
      }

      console.log(chalk.blue(`[Restore] Restoring ${records.length} records for ${modelName}...`));
      
      // Wipe the existing collection
      await model.deleteMany({});
      
      // Insert backup data
      if (records.length > 0) {
        await model.insertMany(records);
      }
      
      console.log(chalk.green(`[Restore] Restored ${modelName} successfully!`));
    }

    console.log(chalk.green.bold("\nDatabase restore completed successfully!"));
  } catch (error) {
    console.error(chalk.red.bold("\nDatabase restore failed!"), error);
  } finally {
    await mongoose.connection.close();
    console.log(chalk.blue("Disconnected from database. Exit."));
    process.exit(0);
  }
};

runRestore();
