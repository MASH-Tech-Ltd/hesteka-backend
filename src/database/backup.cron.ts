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
    // 1. Gather all models and count data efficiently (No RAM loading)
    const models = mongoose.connection.models;
    let totalRecords = 0;
    
    for (const [modelName, model] of Object.entries(models)) {
      try {
        const count = await model.countDocuments();
        recordsDetail[modelName] = count;
        totalRecords += count;
        console.log(chalk.gray(`[Backup] Counted ${count} records for ${modelName}`));
      } catch (err) {
        console.error(chalk.red(`[Backup] Failed to count model ${modelName}:`), err);
      }
    }
    
    // --- PRE-SAVE SAFEGUARDS ---
    
    // 1. Empty Database Check
    if (totalRecords === 0) {
      const errorMsg = "[Backup] Safeguard Triggered: Primary database is completely empty (0 records). Aborting to protect backups.";
      console.error(chalk.bgRed.white(errorMsg));
      await BackupLogModel.create({
        status: "bypassed",
        triggerType,
        message: errorMsg,
        timestamp: new Date()
      });
      return { success: false, message: errorMsg, timestamp, backupFile: "" };
    }

    // 2. Ransomware / Corruption Canary Safeguard
    const UserModel = models['User'];
    if (UserModel) {
      const users = await UserModel.find({}).limit(50).lean();
      const sampleSize = users.length;
      let validEmails = 0;
      
      for (const u of users) {
        if (u && typeof u.email === 'string' && u.email.includes('@')) {
          validEmails++;
        }
      }
      
      if (validEmails === 0 && sampleSize > 0) {
        const errorMsg = `[Backup] RANSOMWARE DETECTED: Sampled ${sampleSize} users but found 0 valid emails. Data appears encrypted/corrupted. Sync aborted!`;
        console.error(chalk.bgRed.white(errorMsg));
        await BackupLogModel.create({
          status: "failed",
          recordsDetail,
          triggerType,
          message: errorMsg,
          timestamp: new Date()
        });
        return { success: false, message: errorMsg, timestamp, backupFile: "" };
      }
    }

    // 3. Historical Data Loss Detection
    try {
      const lastBackup = await BackupLogModel.findOne({ status: "success" }).sort({ timestamp: -1 }).lean();
      if (lastBackup && lastBackup.recordsDetail) {
        const lastTotalRecords = Object.values(lastBackup.recordsDetail).reduce((sum: number, count: any) => sum + (Number(count) || 0), 0);
        
        if (lastTotalRecords > 100 && totalRecords < lastTotalRecords * 0.5) {
          const errorMsg = `[Backup] MASSIVE DATA LOSS DETECTED: Primary DB has ${totalRecords} records, but last successful backup had ${lastTotalRecords}. Aborting to protect previous backups!`;
          console.error(chalk.bgRed.white(errorMsg));
          await BackupLogModel.create({
            status: "failed",
            recordsDetail,
            triggerType,
            message: errorMsg,
            timestamp: new Date()
          });
          return { success: false, message: errorMsg, timestamp, backupFile: "" };
        }
      }
    } catch (historyErr) {
      console.warn("[Backup] Could not retrieve backup history for data loss check.", historyErr);
    }
    // ---------------------------

    // 2. Save locally as compressed JSONL stream & Replicate in chunks
    const backupsDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    
    timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupFilePath = path.join(backupsDir, `backup-${timestamp}.jsonl.gz`);
    
    const writeStream = fs.createWriteStream(backupFilePath);
    const gzip = zlib.createGzip();
    gzip.pipe(writeStream);

    let secondaryConn: mongoose.Connection | null = null;
    if (config.backupMongoUri) {
      console.log(chalk.blue(`[Backup] Connecting to secondary MongoDB cluster for replication...`));
      secondaryConn = await mongoose.createConnection(config.backupMongoUri).asPromise();
    }

    for (const [modelName, model] of Object.entries(models)) {
      try {
        let secondaryModel: mongoose.Model<any> | null = null;
        if (secondaryConn) {
          const schema = model.schema;
          secondaryModel = secondaryConn.model(modelName, schema);
          await secondaryModel.collection.deleteMany({});
        }

        const cursor = model.find({}).cursor();
        let chunk: any[] = [];
        
        for await (const doc of cursor) {
          // Write to file (jsonl format)
          const line = JSON.stringify({ collection: modelName, data: doc });
          gzip.write(line + "\n");
          
          // Add to chunk for secondary replication
          if (secondaryModel) {
            chunk.push(doc);
            if (chunk.length >= 1000) {
              await secondaryModel.collection.insertMany(chunk);
              chunk = [];
            }
          }
        }
        
        // Insert remaining records in chunk
        if (secondaryModel && chunk.length > 0) {
          await secondaryModel.collection.insertMany(chunk);
        }
        
        if (secondaryModel) {
           console.log(chalk.green(`[Backup] Replicated ${recordsDetail[modelName] || 0} records to secondary DB for ${modelName}`));
        }
      } catch (err: any) {
        console.error(chalk.red(`[Backup] Stream/Replication failed for model ${modelName}:`), err.message);
      }
    }
    
    // Promisify stream end to ensure file is written completely
    await new Promise((resolve, reject) => {
      gzip.end();
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    console.log(chalk.green(`[Backup] Local streaming backup saved: ${backupFilePath}`));

    if (secondaryConn) {
      await secondaryConn.close();
      console.log(chalk.green(`[Backup] Secondary DB replication completed successfully!`));
    }
    
    // Clean up older backups (keep dailies for a week, weeklies for a month)
    const files = fs.readdirSync(backupsDir);
    const backupFiles = files.filter(f => f.startsWith("backup-") && (f.endsWith(".json.gz") || f.endsWith(".jsonl.gz")));
    
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    for (const file of backupFiles) {
      const filePath = path.join(backupsDir, file);
      const stats = fs.statSync(filePath);
      const fileDate = stats.mtime;

      if (fileDate < oneWeekAgo) {
        // Older than a week, delete
        fs.unlinkSync(filePath);
        console.log(chalk.yellow(`[Backup] Deleted old local backup (>1 week): ${file}`));
      }
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
  // Schedule backup to run daily at 3:00 AM UTC
  const schedule = "0 3 * * *";
  
  cron.schedule(schedule, async () => {
    try {
      await runBackup("scheduled");
      try {
        const { securityService } = await import("../modules/security/security.service");
        await securityService.cleanupOldSecurityLogs();
      } catch (secErr) {
        console.error("[Backup] Security log cleanup failed:", secErr);
      }
    } catch (e) {
      console.error("[Backup] Scheduled backup failed:", e);
    }
  }, {
    timezone: "UTC"
  });
  
  console.log(chalk.magenta("[Backup] Database backup cron scheduled (Daily at 3:00 AM UTC)"));
};
