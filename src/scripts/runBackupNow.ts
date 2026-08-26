// import { connectDatabase } from "../database/db";
// import "../app"; // This ensures all routes and models are loaded into Mongoose memory
// import { runBackup } from "../database/backup.cron";

// const run = async () => {
//   try {
//     console.log("Connecting to database and initializing models...");
//     await connectDatabase();
    
//     console.log("Triggering manual backup...");
//     const result = await runBackup("manual");
    
//     console.log("Backup complete:", result);
//     process.exit(0);
//   } catch (err) {
//     console.error("Error running backup script:", err);
//     process.exit(1);
//   }
// };

// run();
//!hey khoka
// // run >> npx ts-node --transpile-only src/scripts/runBackupNow.ts

