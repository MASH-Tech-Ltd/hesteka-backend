import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import cron from "node-cron";
import chalk from "chalk";
import config from "../config";
import { BackupLogModel } from "./backupLog.models";

export const runBackup = async (triggerType: "manual" | "scheduled" = "scheduled") => {
  console.log(chalk.blue(`[Backup] Starting ${triggerType} backup process at ${new Date().toISOString()}`));
  
  let timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  let backupFilePath = "";
  const recordsDetail: Record<string, number> = {};

  try {
    // 1. Gather all models and retrieve data
    const models = mongoose.connection.models;
    const backupData: Record<string, any[]> = {};
    
    for (const [modelName, model] of Object.entries(models)) {
      try {
        const data = await model.find({}).lean();
        backupData[modelName] = data;
        recordsDetail[modelName] = data.length;
        console.log(chalk.gray(`[Backup] Read ${data.length} records from ${modelName}`));
      } catch (err) {
        console.error(chalk.red(`[Backup] Failed to read model ${modelName}:`), err);
      }
    }
    
    // 2. Save locally as compressed JSON archive
    const backupsDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    
    timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupFilePath = path.join(backupsDir, `backup-${timestamp}.json.gz`);
    
    const jsonString = JSON.stringify(backupData, null, 2);
    const compressed = zlib.gzipSync(Buffer.from(jsonString));
    
    fs.writeFileSync(backupFilePath, compressed);
    console.log(chalk.green(`[Backup] Local backup saved: ${backupFilePath}`));
    
    // Clean up older backups (keep last 7 days)
    const files = fs.readdirSync(backupsDir);
    const backupFiles = files.filter(f => f.startsWith("backup-") && f.endsWith(".json.gz"));
    if (backupFiles.length > 7) {
      backupFiles.sort(); // Sorts chronologically by filename
      while (backupFiles.length > 7) {
        const fileToDelete = backupFiles.shift();
        if (fileToDelete) {
          fs.unlinkSync(path.join(backupsDir, fileToDelete));
          console.log(chalk.yellow(`[Backup] Deleted old local backup: ${fileToDelete}`));
        }
      }
    }
    
    // 3. Replicate to secondary MongoDB cluster if configured
    if (config.backupMongoUri) {
      const totalRecords = Object.values(backupData).reduce((sum, records) => sum + records.length, 0);
      if (totalRecords === 0) {
        console.warn(chalk.bgRed.white("[Backup] Safeguard Triggered: Primary database is completely empty (0 records). Skipping replication to keep secondary database intact."));
        
        await BackupLogModel.create({
          status: "bypassed",
          backupFile: backupFilePath,
          recordsDetail,
          triggerType,
          message: "Safeguard Triggered: Primary database has 0 records. Secondary replication skipped.",
          timestamp: new Date()
        });

        return { success: false, message: "Safeguard triggered: primary database is empty. Secondary database preserved.", timestamp, backupFile: backupFilePath };
      }

      console.log(chalk.blue(`[Backup] Replicating to secondary MongoDB cluster...`));
      
      const secondaryConn = await mongoose.createConnection(config.backupMongoUri).asPromise();
      
      // --- ADVANCED HACK / ERASURE SAFEGUARD ---
      // Check how much data the backup database currently has
      let secondaryTotalRecords = 0;
      try {
        if (!secondaryConn.db) {
          throw new Error("Secondary connection db is undefined");
        }
        const collections = await secondaryConn.db.collections();
        for (const collection of collections) {
          secondaryTotalRecords += await collection.countDocuments();
        }
      } catch (countErr) {
        console.warn("[Backup] Could not count secondary DB records for safeguard check.", countErr);
      }

      // If the primary database has suddenly lost more than 50% of its data compared to the backup,
      // we assume a catastrophic event (hacker/accidental mass deletion) and ABORT the sync to preserve the backup.
      if (secondaryTotalRecords > 100 && totalRecords < secondaryTotalRecords * 0.5) {
        const errorMsg = `[Backup] MASSIVE DATA LOSS DETECTED: Primary DB has ${totalRecords} records, but Backup DB has ${secondaryTotalRecords}. Sync aborted to protect backup database!`;
        console.error(chalk.bgRed.white(errorMsg));
        
        await secondaryConn.close();
        
        await BackupLogModel.create({
          status: "failed",
          backupFile: backupFilePath,
          recordsDetail,
          triggerType,
          message: errorMsg,
          timestamp: new Date()
        });

        return { success: false, message: errorMsg, timestamp, backupFile: backupFilePath };
      }
      // ------------------------------------------
      
      // --- RANSOMWARE / CORRUPTION CANARY SAFEGUARD ---
      // Attackers encrypting the database usually scramble string fields or replace the document structure.
      // We sample up to 50 users to ensure their 'email' field looks like a normal email.
      if (backupData['User'] && backupData['User'].length > 0) {
        const users = backupData['User'];
        const sampleSize = Math.min(users.length, 50);
        let validEmails = 0;
        
        for (let i = 0; i < sampleSize; i++) {
          const u = users[i];
          if (u && typeof u.email === 'string' && u.email.includes('@')) {
            validEmails++;
          }
        }
        
        // If we sampled users but couldn't find a single valid email, data is likely encrypted/corrupted.
        if (validEmails === 0 && sampleSize > 0) {
          const errorMsg = `[Backup] RANSOMWARE DETECTED: Sampled ${sampleSize} users but found 0 valid emails. Data appears encrypted/corrupted. Sync aborted!`;
          console.error(chalk.bgRed.white(errorMsg));
          
          await secondaryConn.close();
          
          await BackupLogModel.create({
            status: "failed",
            backupFile: backupFilePath,
            recordsDetail,
            triggerType,
            message: errorMsg,
            timestamp: new Date()
          });

          return { success: false, message: errorMsg, timestamp, backupFile: backupFilePath };
        }
      }
      // ------------------------------------------------

      for (const [modelName, data] of Object.entries(backupData)) {
        try {
          // Get schema of primary model
          const primaryModel = models[modelName];
          if (!primaryModel) {
            console.warn(chalk.yellow(`[Backup] Model ${modelName} not found in connection models, skipping replication.`));
            continue;
          }
          const schema = primaryModel.schema;
          
          // Define model on the secondary connection
          const secondaryModel = secondaryConn.model(modelName, schema);
          
          // Clear existing collection and bulk insert the fresh backup data
          await secondaryModel.collection.deleteMany({});
          if (data.length > 0) {
            await secondaryModel.collection.insertMany(data);
          }
          
          console.log(chalk.green(`[Backup] Replicated ${data.length} records to secondary DB for ${modelName}`));
        } catch (err: any) {
          console.error(chalk.red(`[Backup] Replication failed for model ${modelName}:`), err.message);
        }
      }
      
      await secondaryConn.close();
      console.log(chalk.green(`[Backup] Secondary DB replication completed successfully!`));
    }
    
    // Save success log
    await BackupLogModel.create({
      status: "success",
      backupFile: backupFilePath,
      recordsDetail,
      triggerType,
      message: "Database backup and replication completed successfully.",
      timestamp: new Date()
    });

    return { success: true, timestamp, backupFile: backupFilePath };
  } catch (error: any) {
    console.error(chalk.bgRed.white("[Backup] Backup process failed!"), error);
    
    try {
      await BackupLogModel.create({
        status: "failed",
        triggerType,
        message: error.message || String(error),
        timestamp: new Date()
      });
    } catch (logErr) {
      console.error("[Backup] Failed to write backup log to database:", logErr);
    }

    throw error;
  }
};

export const startBackupCron = () => {
  // Schedule backup to run every day at 3:00 AM
  const schedule = "0 3 * * *";
  
  cron.schedule(schedule, async () => {
    try {
      await runBackup("scheduled");
    } catch (e) {
      console.error("[Backup] Scheduled backup failed:", e);
    }
  }, {
    timezone: "UTC"
  });
  
  console.log(chalk.magenta("[Backup] Daily database backup cron scheduled (03:00 UTC)"));
};
