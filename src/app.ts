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
import { globalApiLimiter, adminApiLimiter, rateLimiter } from "./middleware/rateLimiter.middleware";
import { ipBlockerMiddleware } from "./middleware/ipBlocker.middleware";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import { securityService } from "./modules/security/security.service";
import { deviceReferralModel } from "./modules/usersAuth/deviceReferral.models";
import { intigrationRoute } from "./modules/intigration/intigration.route";
import { getClientIp } from "./utils/ipUtils";
import mongoose from "mongoose";
import { reportModel } from "./modules/reports/report.models";
import { reportShareTemplate, inviteShareTemplate } from "./tempaletes/share.template";
const xss = require("xss-clean");

const app = express();
// Trust exactly 1 proxy hop (Nginx / Cloudflare → app) so req.ip resolves to the real client IP.
// Using `true` is intentionally blocked by express-rate-limit (ERR_ERL_PERMISSIVE_TRUST_PROXY)
// because it allows IP spoofing. Use a number equal to the number of reverse-proxy hops instead.
app.set("trust proxy", 1);
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
        const clientIp = getClientIp(req);
        // console.warn(`[SECURITY ALERT] ${reasonMsg} from IP: ${clientIp}`);
        securityService.logSecurityIncident(
          clientIp,
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
      const clientIp = getClientIp(req);
      // console.warn(`[SECURITY ALERT] ${reasonMsg} from IP: ${clientIp}`);
      securityService.logSecurityIncident(
        clientIp,
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

app.use("/api/intigration", ipBlockerMiddleware, globalApiLimiter, intigrationRoute);

// Apply global IP blocker and rate limiters (global & admin) to all API endpoints
app.use("/api/v1", ipBlockerMiddleware, globalApiLimiter, adminApiLimiter, routes);

// 1. Android App Links Verification (assetlinks.json)
app.get('/.well-known/assetlinks.json', (req: Request, res: Response) => {
  const rawFingerprints = config.appLinks.androidSha256CertFingerprint || "";
  const fingerprints = rawFingerprints
    .split(",")
    .map((f: string) => f.trim())
    .filter(Boolean);

  res.setHeader('Content-Type', 'application/json');
  res.status(200).json([
    {
      "relation": ["delegate_permission/common.handle_all_urls"],
      "target": {
        "namespace": "android_app",
        "package_name": config.appLinks.androidPackageName,
        "sha256_cert_fingerprints": fingerprints.length > 0 ? fingerprints : [rawFingerprints]
      }
    }
  ]);
});

// 2. iOS Universal Links Verification (apple-app-site-association)
const aasaHandler = (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    "applinks": {
      "apps": [],
      "details": [
        {
          "appID": `${config.appLinks.appleTeamId}.${config.appLinks.androidPackageName}`,
          "paths": [ "/report/*", "/reports/*", "/invite/*", "/referral/*" ]
        }
      ]
    }
  });
};
app.get('/.well-known/apple-app-site-association', aasaHandler);
app.get('/apple-app-site-association', aasaHandler);

// 3. Smart Report Landing & Deep Link Fallback Routes
const reportShareHandler = async (req: Request, res: Response) => {
  const reportId = (req.params.id as string) || "";
  let reportData: any = null;

  if (reportId && mongoose.Types.ObjectId.isValid(reportId)) {
    try {
      reportData = await reportModel.findById(reportId).lean();
    } catch (err) {
      console.error("[Report Share] Failed to fetch report details:", err);
    }
  }

  const appStoreUrl = `https://apps.apple.com/app/id${config.appLinks.appleAppStoreId}`;
  const playStoreUrl = `https://play.google.com/store/apps/details?id=${config.appLinks.androidPackageName}`;
  const customSchemeUrl = `hesteka://report/${reportId}`;

  const html = reportShareTemplate({
    id: reportId,
    title: reportData?.title || reportData?.animalName || "Signalement d'animal",
    animalName: reportData?.animalName || "Animal signalé",
    species: reportData?.species,
    description: reportData?.description || "Consultez ce signalement d'animal sur l'application Hesteka.",
    imageUrl: reportData?.images?.[0] || reportData?.image || "",
    appStoreUrl,
    playStoreUrl,
    customSchemeUrl,
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
app.get('/report/:id', reportShareHandler);
app.get('/reports/:id', reportShareHandler);

// 4. Smart Referral / Invite Landing & Deep Link Fallback Routes
const inviteShareHandler = async (req: Request, res: Response) => {
  const userAgent = req.headers['user-agent'] || '';
  const ip = getClientIp(req);
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

  const appStoreUrl = `https://apps.apple.com/app/id${config.appLinks.appleAppStoreId}`;
  const playStoreUrl = `https://play.google.com/store/apps/details?id=${config.appLinks.androidPackageName}&referrer=ref%3D${referralCode}`;
  const customSchemeUrl = `hesteka://invite/${referralCode}`;

  const html = inviteShareTemplate({
    referralCode,
    appStoreUrl,
    playStoreUrl,
    customSchemeUrl,
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
app.get('/invite/:code', rateLimiter(15, 15), inviteShareHandler);
app.get('/referral/:code', rateLimiter(15, 15), inviteShareHandler);

app.get("/", serverRunningTemplate);
app.use(notFound);

// Global error handler
app.use(globalErrorHandler);

// Socket.IO setup
const io = initSocket(server);

export { server };
