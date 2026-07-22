import nodemailer, { Transporter } from "nodemailer";
import dotenv from "dotenv";
import CustomError from "./CustomError";
import config from "../config";
// import { userModel } from "../modules/usersAuth/user.models";
// import { authProvider } from "../modules/usersAuth/user.interface";

// Create transporter with fast-fail timeouts so the server doesn't hang for 30+ seconds
const transporter: Transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: config.mailer.hostMail,
    pass: config.mailer.appPassword,
  },
});

interface MailerOptions {
  subject: string;
  template: string;
  email: string;
  attachments?: any[];
}

export const mailer = async ({
  subject,
  template,
  email,
  attachments,
}: MailerOptions): Promise<void> => {
  if (!email || typeof email !== "string") return;

  const normalizedEmail = email.toLowerCase().trim();

  // 1. Skip if email is an Apple Private Relay or Apple ID domain
  if (
    normalizedEmail.includes("privaterelay.appleid.com") ||
    normalizedEmail.includes("appleid.apple.com")
  ) {
    console.log(
      `[Mailer] Ignored email dispatch to Apple relay address: ${email}`
    );
    return;
  }

  // 2. Skip if target user in DB signed up with Apple Sign-In
  // try {
  //   const targetUser = await userModel
  //     .findOne({ email: normalizedEmail })
  //     .select("provider")
  //     .lean();

  //   if (targetUser && targetUser.provider === authProvider.APPLE) {
  //     console.log(
  //       `[Mailer] Ignored email dispatch to Apple Sign-In user (${email})`
  //     );
  //     return;
  //   }
  // } catch (err) {
  //   console.error("[Mailer] Error verifying target user provider:", err);
  // }

  if (!config.mailer.hostMail || !config.mailer.appPassword) {
    throw new CustomError(
      501,
      "Mail service not configured. HOST_MAIL or APP_PASSWORD is missing."
    );
  }

  try {
    await transporter.sendMail({
      from: `${config.email.appName} <${config.mailer.hostMail}>`,
      to: email,
      subject,
      html: template,
      attachments,
    });
  } catch (error: unknown) {
    const errMsg =
      error instanceof Error ? error.message : "Unknown mail error";
    throw new CustomError(501, `Mail send failed: ${errMsg}`);
  }
};
