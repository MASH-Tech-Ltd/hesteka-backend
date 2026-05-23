import * as dns from "dns";
import chalk from "chalk";
import dotenv from "dotenv";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

dotenv.config();

import { connectDatabase } from "./database/db";
import config from "./config/index";
import { server } from "./app";
import { initFirebase } from "./utils/firebase";
import 'dotenv/config';

const PORT = config.port ? Number(config.port) : 8000;

connectDatabase()
  .then(() => {
    initFirebase();
    server.listen(PORT, () => {
      console.log(chalk.green(`Server running at http://localhost:${PORT}`));
    });
  })
  .catch((error: unknown) => {
    console.error(chalk.red("Database connection failed!!"), error);
    process.exit(1);
  });
