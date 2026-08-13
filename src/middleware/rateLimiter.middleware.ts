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

    // Skip auto-blocking for trusted dashboard requests or staff users
    const skipAutoBlock = isTrustedDashboardRequest(req) || req.user?.role === "admin" || req.user?.role === "partner" || req.user?.role === "partners";
    const requestedFrom = securityService.detectRequestedFrom(req.originalUrl || req.url, userAgent, req.headers);

    securityService.logSecurityIncident(
        clientIp,
        req.originalUrl || req.url,
        req.method,
        reason,
        userAgent,
        userId,
        skipAutoBlock,
        requestedFrom
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

            // Trusted dashboard requests and authenticated staff users skip route-specific limits
            return isTrustedDashboardRequest(req) || req.user?.role === "admin" || req.user?.role === "partner" || req.user?.role === "partners";
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

export const isTrustedDashboardRequest = (req: any): boolean => {
    const url = req.originalUrl || req.url || "";
    const origin = (req.headers?.origin || "").toLowerCase();
    const referer = (req.headers?.referer || "").toLowerCase();
    const adminHeader = (req.headers?.["x-admin-dashboard"] || "").toLowerCase();
    const partnerHeader = (req.headers?.["x-partner-dashboard"] || "").toLowerCase();
    const paymentHeader = (req.headers?.["x-payment-dashboard"] || "").toLowerCase();
    const requestedFrom = (req.headers?.["x-requested-from"] || "").toLowerCase();

    if (adminHeader === "true" || adminHeader === "admin-dashboard" || adminHeader === "admin") return true;
    if (partnerHeader === "true" || partnerHeader === "partner-dashboard" || partnerHeader === "partner") return true;
    if (paymentHeader === "true" || paymentHeader === "payment-dashboard" || paymentHeader === "payment") return true;
    if (requestedFrom.startsWith("web/")) return true;

    const isDev = config.env === "development";

    const prodDomains = [
        "admin.hesteka.com",
        "partner.hesteka.com",
        "payment.hesteka.com",
        "charity.hesteka.com",
        ...(config?.frontendUrl ? [config.frontendUrl.toLowerCase()] : []),
    ];

    const devDomains = [
        "localhost:3000",
        "localhost:3001",
        "localhost:3002",
        "localhost:5173",
        "localhost:5174",
        "localhost:5175",
        "localhost:4173",
        "127.0.0.1",
    ];

    const allowedList = isDev ? [...prodDomains, ...devDomains] : prodDomains;

    if (allowedList.some((domain) => origin.includes(domain) || referer.includes(domain))) {
        return true;
    }

    if (
        url.startsWith("/api/v1/admin") ||
        url.startsWith("/api/v1/security") ||
        url.includes("/admin/") ||
        url.includes("/partner/")
    ) {
        return true;
    }
    return false;
};

export const isAdminDashboardRequest = isTrustedDashboardRequest;

export const adminApiLimiter = rateLimit({
    windowMs: defaultWindowMinutes * 60 * 1000,
    max: 15000, // Generous limit for trusted dashboards (Admin, Partner, Payment)
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        return !isTrustedDashboardRequest(req);
    },
    handler: (req, res) => {
        const msg = `Too many requests from dashboard client. Please try again after ${defaultWindowMinutes} minutes.`;
        logRateLimitIncident(req, `Dashboard API rate limit exceeded (15000 req / ${defaultWindowMinutes}m)`);
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
        if (isTrustedDashboardRequest(req) || req.user?.role === "admin" || req.user?.role === "partner" || req.user?.role === "partners") return true;
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

export const accessTokenLimiter = rateLimiter(
    15,
    15,
    "Too many access token generation attempts from this IP. Please try again after 15 minutes."
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

export const locationLimiter = rateLimiter(
    15,
    60,
    "Too many location search requests from this IP. Please try again after 15 minutes."
);

export const chatLimiter = rateLimiter(
    15,
    150,
    "Too many chat requests from this IP. Please try again after 15 minutes."
);

export const communityLimiter = rateLimiter(
    15,
    1500,
    "Too many community requests from this IP. Please try again after 15 minutes."
);
