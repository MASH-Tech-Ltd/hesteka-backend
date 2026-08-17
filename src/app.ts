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
import { globalApiLimiter, adminApiLimiter } from "./middleware/rateLimiter.middleware";
import { ipBlockerMiddleware } from "./middleware/ipBlocker.middleware";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import { securityService } from "./modules/security/security.service";
import { deviceReferralModel } from "./modules/usersAuth/deviceReferral.models";
import { intigrationRoute } from "./modules/intigration/intigration.route";
const xss = require("xss-clean");

const app = express();
app.set("trust proxy", 1);
// Required for express-rate-limit when running behind a reverse proxy
const server = http.createServer(app);

const allowedOrigins = [
  config.frontendUrl,
  "https://admin.hesteka.com",
  "https://partner.hesteka.com",
  "https://charity.hesteka.com/",
  ...(config.env === "development" ? [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:4173",
  ] : []),
].filter(Boolean);

if (config.env === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("short"));
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (origin && allowedOrigins.includes(origin)) {
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

// Security middlewares
app.use(helmet());
// Fix for express-mongo-sanitize with Express 5
app.use((req: Request, res: Response, next: NextFunction) => {
  ['body', 'params', 'headers', 'query'].forEach((key) => {
    if (req[key as keyof Request]) {
      const hasAttack = mongoSanitize.has(req[key as keyof Request]);
      if (hasAttack) {
        const reasonMsg = `🚨 ACTIVE PROTECTION: Malicious NoSQL Injection attempt blocked in req.${key}`;
        // console.warn(`[SECURITY ALERT] ${reasonMsg} from IP: ${req.ip}`);
        securityService.logSecurityIncident(
          req.ip || "unknown",
          req.originalUrl || req.url || "",
          req.method,
          reasonMsg,
          req.headers["user-agent"] || ""
        ).catch(err => console.error("Failed to log security incident:", err));
      }
      mongoSanitize.sanitize(req[key as keyof Request]);
    }
  });
  next();
});

// Fix for xss-clean with Express 5
app.use((req: Request, res: Response, next: NextFunction) => {
  const clean = require("xss-clean/lib/xss").clean;
  
  const handleXss = (original: any, cleaned: any, keyName: string) => {
    if (JSON.stringify(original) !== JSON.stringify(cleaned)) {
      const reasonMsg = `🚨 ACTIVE PROTECTION: Malicious XSS attempt blocked in req.${keyName}`;
      // console.warn(`[SECURITY ALERT] ${reasonMsg} from IP: ${req.ip}`);
      securityService.logSecurityIncident(
        req.ip || "unknown",
        req.originalUrl || req.url || "",
        req.method,
        reasonMsg,
        req.headers["user-agent"] || ""
      ).catch(err => console.error("Failed to log security incident:", err));
    }
  };

  if (req.body) {
    const cleanBody = clean(req.body);
    handleXss(req.body, cleanBody, "body");
    req.body = cleanBody;
  }
  if (req.params) {
    const cleanParams = clean(req.params);
    handleXss(req.params, cleanParams, "params");
    Object.keys(req.params).forEach(key => delete req.params[key]);
    Object.assign(req.params, cleanParams);
  }
  if (req.query) {
    const cleanQuery = clean(req.query);
    handleXss(req.query, cleanQuery, "query");
    Object.keys(req.query).forEach(key => delete (req.query as any)[key]);
    Object.assign(req.query, cleanQuery);
  }
  next();
});
app.use(hpp());

app.use("/api/intigration", intigrationRoute);

// Apply global IP blocker and rate limiters (global & admin) to all API endpoints
app.use("/api/v1", ipBlockerMiddleware, globalApiLimiter, adminApiLimiter, routes);

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
          "paths": [ "/report/*", "/invite/*" ] // Links to this path will open in the app
        }
      ]
    }
  });
});

// 3. Browser Fallback Routes (if the app is not installed on the phone)
app.get('/report/:id', (req: Request, res: Response) => {
  const userAgent = req.headers['user-agent'] || '';
  
  // If the user clicks from an iPhone and the app is not installed, redirect to Apple Store
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return res.redirect(`https://apps.apple.com/app/id${config.appLinks.appleAppStoreId}`);
  }
  
  // Redirect to Play Store for Android or other devices
  res.redirect(`https://play.google.com/store/apps/details?id=${config.appLinks.androidPackageName}`);
});

app.get('/invite/:code', async (req: Request, res: Response) => {
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 'unknown';
  const referralCode = (req.params.code as string)?.toUpperCase() || '';
  
  if (referralCode) {
    try {
      await deviceReferralModel.create({
        ip,
        userAgent,
        referralCode,
      });
    } catch (error) {
      console.error("[Invite] Failed to log device referral:", error);
    }
  }

  // iOS: Direct Redirect to App Store (attribution handled via IP/User-Agent fingerprint)
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return res.redirect(`https://apps.apple.com/app/id${config.appLinks.appleAppStoreId}`);
  }
  
  // Android: Play Store with Referrer Parameter
  if (/Android/i.test(userAgent)) {
    return res.redirect(`https://play.google.com/store/apps/details?id=${config.appLinks.androidPackageName}&referrer=ref%3D${referralCode}`);
  }

  // Web Fallback: Redirect to main web site (e.g., share domain)
  return res.redirect(`https://share.hesteka.com/?invite=${referralCode}`);
});

app.get("/", serverRunningTemplate);
app.use(notFound);

// Global error handler
app.use(globalErrorHandler);

// Socket.IO setup
const io = initSocket(server);

export { server };
