import express, { NextFunction, Request, Response } from "express";
import http from "http";
import path from "path";
import { initSocket } from "./socket/server";
import routes from "./routes/index.api";
import { globalErrorHandler } from "./helpers/globalErrorHandler";
import { serverRunningTemplate } from "./tempaletes/serverlive.template";
import config from "./config";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import cors from "cors";
import { notFound } from "./middleware/notFound";

const app = express();
// Required for express-rate-limit when running behind a reverse proxy
app.set("trust proxy", 1);
const server = http.createServer(app);

const allowedOrigins = [
  config.frontendUrl,
  "http://localhost:3002",
  "http://localhost:5173",
  "http://localhost:4173",
  "https://admin.hesteka.com",
  "https://partner.hesteka.com",
  "https://charity.hesteka.com/",
].filter(Boolean);

if (config.env === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("short"));
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }),
);

app.get("/api/v1/ping", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Server is alive",
    time: new Date(),
  });
});

app.use(cookieParser());

app.use("/api/v1/webhook/stripe", express.raw({ type: "application/json" }));
app.use("/api/v1/webhook/paypal", express.raw({ type: "application/json" }));

// ✅ একটাই parser — দুটোই skip করে
app.use((req: Request, res: Response, next: NextFunction) => {
  if (
    req.originalUrl.includes("/webhook/stripe") ||
    req.originalUrl.includes("/webhook/paypal")
  ) {
    return next();
  }
  express.json({ limit: "30mb" })(req, res, next);
});

app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(
  "/stamps",
  express.static(path.join(process.cwd(), "public", "stamps")),
);

app.use("/api/v1", routes);

// 1. Android App Links Verification
app.get('/.well-known/assetlinks.json', (req: Request, res: Response) => {
  res.status(200).json([
    {
      "relation": ["delegate_permission/common.handle_all_urls"],
      "target": {
        "namespace": "android_app",
        "package_name": config.appLinks.androidPackageName,
        "sha256_cert_fingerprints": [config.appLinks.androidSha256CertFingerprint]
      }
    }
  ]);
});

// 2. iOS Universal Links Verification
app.get('/.well-known/apple-app-site-association', (req: Request, res: Response) => {
  // ⚠️ Note: The iOS file does not have a JSON extension, but the response type must be JSON.
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    "applinks": {
      "apps": [],
      "details": [
        {
          "appID": `${config.appLinks.appleTeamId}.${config.appLinks.androidPackageName}`, // Team ID + Bundle ID
          "paths": [ "/report/*" ] // Links to this path will open in the app
        }
      ]
    }
  });
});

// 3. Browser Fallback Route (if the app is not installed on the phone)
app.get('/report/:id', (req: Request, res: Response) => {
  const userAgent = req.headers['user-agent'] || '';
  
  // If the user clicks from an iPhone and the app is not installed, redirect to Apple Store
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return res.redirect(`https://apps.apple.com/app/id${config.appLinks.appleAppStoreId}`);
  }
  
  // Redirect to Play Store for Android or other devices
  res.redirect(`https://play.google.com/store/apps/details?id=${config.appLinks.androidPackageName}`);
});

app.get("/", serverRunningTemplate);
app.use(notFound);

// Global error handler
app.use(globalErrorHandler);

// Socket.IO setup
const io = initSocket(server);
export { server };
