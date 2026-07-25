import rateLimit from "express-rate-limit";
import config from "../config";
import { securityService } from "../modules/security/security.service";
import jwt from "jsonwebtoken";

const parseWindowMinutes = (win?: string): number => {
    if (!win) return 15;
    const match = win.match(/^(\d+)/);
    const numStr = match?.[1];
    return numStr ? parseInt(numStr, 10) : 15;
};

const defaultWindowMinutes = parseWindowMinutes(config?.rateLimit?.window);
const defaultMaxRequests = config?.rateLimit?.max || 500;

const logRateLimitIncident = (req: any, reason: string) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
    const clientIp = Array.isArray(ip) ? ip[0] : ip.toString().split(",")[0].trim();
    let userId = req.user?._id || null;
    if (!userId) {
        try {
            const authHeader = req.headers?.authorization;
            if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
                const token = authHeader.split(" ")[1] || "";
                const decoded = jwt.decode(token) as any;
                if (decoded?.userId) userId = decoded.userId;
            }
        } catch (e) {}
    }
    const userAgent = req.headers["user-agent"] || "";

    // Skip auto-blocking for Admin dashboard requests or Admin users
    const skipAutoBlock = isAdminDashboardRequest(req) || req.user?.role === "admin";

    securityService.logSecurityIncident(
        clientIp,
        req.originalUrl || req.url,
        req.method,
        reason,
        userAgent,
        userId,
        skipAutoBlock
    );
};

export const rateLimiter = (
    windowMinutes: number = defaultWindowMinutes,
    maxRequests: number = defaultMaxRequests,
    customMessage?: string
) => {
    return rateLimit({
        windowMs: windowMinutes * 60 * 1000,
        max: maxRequests,
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => {
            // Never skip rate limiters on sensitive auth endpoints to prevent brute-forcing
            const url = req.originalUrl || req.url || "";
            const isAuthEndpoint = 
                url.includes("/login") || 
                url.includes("/otp") || 
                url.includes("/register") || 
                url.includes("/reset-password") ||
                url.includes("/forgot-password");

            if (isAuthEndpoint) {
                return false;
            }

            // Admin dashboard requests and authenticated admin users skip other strict route-specific limits
            return isAdminDashboardRequest(req) || req.user?.role === "admin";
        },
        handler: (req, res) => {
            const msg = customMessage || `Too many requests. Please try again after ${windowMinutes} minutes.`;
            logRateLimitIncident(req, `Rate limit exceeded (${maxRequests} req / ${windowMinutes}m): ${msg}`);
            res.status(429).json({
                success: false,
                message: msg,
            });
        },
    });
};

export const isAdminDashboardRequest = (req: any): boolean => {
    const url = req.originalUrl || req.url || "";
    const origin = req.headers?.origin || "";
    const referer = req.headers?.referer || "";
    const adminHeader = req.headers?.["x-admin-dashboard"] || req.headers?.["x-app-client"] || "";

    if (adminHeader === "true" || adminHeader === "admin-dashboard" || adminHeader === "admin") {
        return true;
    }
    if (
        origin.includes("5173") ||
        origin.includes("admin.hesteka.com") ||
        referer.includes("5173") ||
        referer.includes("admin.hesteka.com")
    ) {
        return true;
    }
    if (
        url.startsWith("/api/v1/admin") ||
        url.startsWith("/api/v1/security") ||
        url.includes("/admin/")
    ) {
        return true;
    }
    return false;
};

export const adminApiLimiter = rateLimit({
    windowMs: defaultWindowMinutes * 60 * 1000,
    max: 10000, // Increased limit from 3000 to 10000 for admin
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        return !isAdminDashboardRequest(req);
    },
    handler: (req, res) => {
        const msg = `Too many requests from Admin client. Please try again after ${defaultWindowMinutes} minutes.`;
        logRateLimitIncident(req, `Admin API rate limit exceeded (10000 req / ${defaultWindowMinutes}m)`);
        res.status(429).json({
            success: false,
            message: msg,
        });
    },
});

export const globalApiLimiter = rateLimit({
    windowMs: defaultWindowMinutes * 60 * 1000,
    max: defaultMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        if (req.originalUrl.includes("/webhook/")) return true;
        if (isAdminDashboardRequest(req)) return true;
        return false;
    },
    handler: (req, res) => {
        const msg = `Too many requests from this IP. Please try again after ${defaultWindowMinutes} minutes.`;
        logRateLimitIncident(req, `Global API rate limit exceeded (${defaultMaxRequests} req / ${defaultWindowMinutes}m)`);
        res.status(429).json({
            success: false,
            message: msg,
        });
    },
});

export const authLimiter = rateLimiter(
    15,
    20,
    "Too many authentication attempts from this IP. Please try again after 15 minutes."
);

export const otpLimiter = rateLimiter(
    15,
    5,
    "Too many verification attempts from this IP. Please try again after 15 minutes."
);

export const passwordLimiter = rateLimiter(
    15,
    5,
    "Too many password modification attempts from this IP. Please try again after 15 minutes."
);

export const contentLimiter = rateLimiter(
    15,
    20,
    "Too many submission attempts from this IP. Please try again after 15 minutes."
);

export const paymentLimiter = rateLimiter(
    15,
    15,
    "Too many payment requests from this IP. Please try again after 15 minutes."
);
