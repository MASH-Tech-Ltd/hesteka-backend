import "dotenv/config";
import mongoose from "mongoose";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import * as readline from "readline";
import chalk from "chalk";
import { connectDatabase } from "./db";

// Import index api router to ensure all modules/models are registered on mongoose
import "../routes/index.api";

const runRestore = async () => {
  console.log(chalk.blue.bold("\n--- Database Restore Tool (Streaming) ---"));

  const backupsDir = path.join(process.cwd(), "backups");
  
  if (!fs.existsSync(backupsDir)) {
    console.log(chalk.yellow("No backups directory found."));
    process.exit(0);
  }

  // Support standard .json.gz format
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
      console.log(chalk.gray(`- ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`));
    });
    process.exit(0);
  }

  const backupFilePath = path.join(backupsDir, targetFileArg);

  if (!fs.existsSync(backupFilePath)) {
    console.error(chalk.red(`Error: Backup file not found at ${backupFilePath}`));
    process.exit(1);
  }

  try {
    // Connect to target database
    await connectDatabase();
    const models = mongoose.connection.models;

    console.log(chalk.yellow(`\nReading and streaming backup: ${targetFileArg}...`));
    
    if (targetFileArg.endsWith(".json.gz")) {
      console.log(chalk.blue("Detected standard .json.gz format. Loading into memory..."));
      const compressed = fs.readFileSync(backupFilePath);
      const jsonString = zlib.gunzipSync(compressed).toString("utf-8");
      const backupData: Record<string, any[]> = JSON.parse(jsonString);

      // Safeguard
      let totalLegacyRecords = 0;
      for (const records of Object.values(backupData)) {
        totalLegacyRecords += records.length;
      }
      if (totalLegacyRecords === 0) {
        console.error(chalk.bgRed.white("\n[Restore] Safeguard Triggered: Backup file contains 0 total records."));
        process.exit(1);
      }

      for (const [modelName, records] of Object.entries(backupData)) {
        const model = models[modelName];
        if (!model) continue;
        console.log(chalk.blue(`[Restore] Restoring ${records.length} records for ${modelName}...`));
        try {
          await model.collection.deleteMany({});
          if (records.length > 0) {
            const chunkSize = 1000;
            for (let i = 0; i < records.length; i += chunkSize) {
              const chunk = records.slice(i, i + chunkSize);
              await model.collection.insertMany(chunk);
            }
          }
          console.log(chalk.green(`[Restore] Restored ${modelName} successfully!`));
        } catch (err: any) {
          console.error(chalk.red(`[Restore] ERROR restoring ${modelName}: ${err.message}`));
        }
      }
    } else {
      console.error(chalk.red(`Error: Unsupported file format. Please provide a .json.gz file.`));
      process.exit(1);
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
