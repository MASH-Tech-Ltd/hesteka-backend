import rateLimit from "express-rate-limit";
import config from "../config";

// Helper to parse window string (e.g. "15m", "1h") or fallback to number of minutes
const parseWindowMinutes = (win?: string): number => {
    if (!win) return 15;
    const match = win.match(/^(\d+)/);
    const numStr = match?.[1];
    return numStr ? parseInt(numStr, 10) : 15;
};

const defaultWindowMinutes = parseWindowMinutes(config?.rateLimit?.window);
const defaultMaxRequests = config?.rateLimit?.max || 500;

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
        handler: (req, res) => {
            res.status(429).json({
                success: false,
                message: customMessage || `Too many requests. Please try again after ${windowMinutes} minutes.`,
            });
        },
    });
};

// Global API Rate Limiter (Protects all /api/v1 endpoints against DDoS/brute force, skipping payment webhooks)
export const globalApiLimiter = rateLimit({
    windowMs: defaultWindowMinutes * 60 * 1000,
    max: defaultMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        return req.originalUrl.includes("/webhook/");
    },
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: `Too many requests from this IP. Please try again after ${defaultWindowMinutes} minutes.`,
        });
    },
});

// Strict Auth Limiter (For user/partner registration, OAuth login, access token regeneration)
export const authLimiter = rateLimiter(
    15,
    20,
    "Too many authentication attempts from this IP. Please try again after 15 minutes."
);

// Strict OTP & Verification Limiter (For OTP verification, forget password, resend verification OTP)
export const otpLimiter = rateLimiter(
    15,
    5,
    "Too many verification attempts from this IP. Please try again after 15 minutes."
);

// Strict Password Limiter (For password reset endpoint)
export const passwordLimiter = rateLimiter(
    15,
    5,
    "Too many password modification attempts from this IP. Please try again after 15 minutes."
);

// Content Creation Limiter (For creating reports, support messages, etc.)
export const contentLimiter = rateLimiter(
    15,
    20,
    "Too many submission attempts from this IP. Please try again after 15 minutes."
);

// Strict Payment & Donation Limiter (Prevents credit card testing spam and payment gateway flood)
export const paymentLimiter = rateLimiter(
    15,
    15,
    "Too many payment requests from this IP. Please try again after 15 minutes."
);

