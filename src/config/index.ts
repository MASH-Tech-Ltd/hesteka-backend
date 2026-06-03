import path from "path";
import dotenv from "dotenv";

(dotenv as any).config({ path: path.join(process.cwd(), ".env") });

const config = {
  /* ================= Server ================= */
  env: process.env.NODE_ENV === "development" ? "development" : "production",
  port: Number(process.env.PORT) || 5000,

  /* ================= admin email ================= */
  adminEmails: process.env.ADMIN_EMAILS?.split(",") || [],
  /* ================= Database ================= */
  mongoUri: process.env.MONGO_URI as string,

  /* ================= Security ================= */
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,

  /* ================= JWT ================= */
  jwt: {
    jwtSecret: process.env.JWT_SECRET as string,
    jwtExpire: process.env.JWT_EXPIRE ?? "1h",

    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET as string,
    accessTokenExpires: process.env.ACCESS_TOKEN_EXPIRES ?? "15m",

    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET as string,
    refreshTokenExpires: process.env.REFRESH_TOKEN_EXPIRES ?? "7d",
  },

  mailer: {
    hostMail: process.env.HOST_MAIL as string,
    appPassword: process.env.APP_PASSWORD as string,
  },

  provider: {
    googleClientId: process.env.GOOGLE_CLIENT_ID, // Web Client ID (used by backend)
    googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID, // iOS Client ID (for Flutter iOS)
    googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID, // Android Client ID (for Flutter Android)
    appleClientId: process.env.APPLE_CLIENT_ID,
  },

  //password reset token
  passwordResetTokenSecret: process.env.PASSWORD_RESET_TOKEN_SECRET as string,
  passwordResetTokenExpire: process.env.PASSWORD_RESET_TOKEN_EXPIRE ?? "10m",

  /* ================= Cloudinary ================= */
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME as string,
    apiKey: process.env.CLOUDINARY_API_KEY as string,
    apiSecret: process.env.CLOUDINARY_API_SECRET as string,
  },

  /* ================= Email (Nodemailer) ================= */
  email: {
    hostMail: process.env.HOST_MAIL as string,
    appPassword: process.env.APP_PASSWORD as string,
    appName: process.env.APP_NAME as string,
  },

  /* ================= Stripe ================= */
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY as string,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET as string,
  },

  //redis
  redisUrl: process.env.REDIS_URL,

  /* ================= Frontend ================= */
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  publicUrl: process.env.PUBLIC_URL ?? process.env.BACKEND_URL ?? `http://localhost:${Number(process.env.PORT) || 5000}`,

  /* ================= Rate Limit ================= */
  rateLimit: {
    window: process.env.RATE_LIMIT_WINDOW ?? "15m",
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
    delay: Number(process.env.RATE_LIMIT_DELAY) || 50,
  },
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID as string,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET as string,
    mode: process.env.PAYPAL_MODE as string,
    webhookId: process.env.PAYPAL_WEBHOOK_ID as string,
  },

  /* ================= Firebase ================= */
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (() => {
      let key = process.env.FIREBASE_PRIVATE_KEY;
      if (key) {
        // Fix literal '\n' strings that sometimes don't get parsed on Linux
        key = key.replace(/\\n/g, "\n");
        // Remove any accidental surrounding quotes or trailing windows hidden returns (\r)
        key = key.replace(/^"|"$|'/g, "").trim();
      }
      return key;
    })(),
    databaseUrl: process.env.FIREBASE_DATABASE_URL,
  },

  //sopify
  shopify: {
    storeUrl: process.env.SHOPIFY_STORE_URL as string,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN as string,
  },
};

export default config;
