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

app.get("/share/report/:id", (req: Request, res: Response) => {
  const id = req.params.id;
  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redirecting to Hesteka...</title>
    <script type="text/javascript">
        window.onload = function() {
            window.location.href = "hesteka://reports/${id}";
            setTimeout(function() {
                window.location.href = "https://play.google.com/store/apps/details?id=com.emmafve.app"; 
            }, 2500);
        };
    </script>
</head>
<body>
    <div style="text-align: center; margin-top: 50px; font-family: Arial, sans-serif; padding: 20px;">
        <h2>Redirecting to Hesteka App...</h2>
        <p>If the app does not open automatically, <a href="https://play.google.com/store/apps/details?id=com.emmafve.app">click here to download</a>.</p>
    </div>
</body>
</html>
  `;
  res.send(html);
});

app.get("/", serverRunningTemplate);
app.use(notFound);

// Global error handler
app.use(globalErrorHandler);

// Socket.IO setup
const io = initSocket(server);
export { server };
