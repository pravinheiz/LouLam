import nodemailer from "nodemailer";
import { ValidationError } from "./api-errors";

export async function sendEmailOtp(email: string, code: string): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || `"LouLam" <${user}>`;

  if (!host || !user || !pass) {
    console.error("❌ SMTP Credentials missing in env variables.");
    throw new ValidationError(
      "SMTP configuration is missing in the environment variables (.env). Please configure SMTP_HOST, SMTP_USER, and SMTP_PASSWORD to send email OTPs."
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
  });

  const mailOptions = {
    from,
    to: email,
    subject: "LouLam - Email Verification Code",
    text: `Your email verification code is: ${code}. This code is valid for 5 minutes.`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; background-color: #0f172a; color: #ffffff; border-radius: 10px; max-width: 500px; margin: auto;">
        <h2 style="color: #6366f1; text-align: center;">LouLam</h2>
        <p>Hello,</p>
        <p>Thank you for registering. Please use the following 6-digit verification code to verify your email address:</p>
        <div style="font-size: 28px; font-weight: bold; text-align: center; letter-spacing: 5px; margin: 30px 0; color: #38bdf8; background-color: #1e293b; padding: 15px; border-radius: 8px;">
          ${code}
        </div>
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">This code is valid for 5 minutes. If you did not request this, please ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`✉️ Real OTP email successfully sent to ${email}`);
}

export async function sendPropertyStatusReminder(
  email: string,
  ownerName: string,
  propertyId: string,
  title: string,
  token: string
): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || `"LouLam Marketplace" <${user}>`;
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  if (!host || !user || !pass) {
    console.error("❌ SMTP Credentials missing in env variables.");
    return; // Don't throw to prevent blocking logins, but log error
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  const mailOptions = {
    from,
    to: email,
    subject: `LouLam Property Listing Action Required: "${title}"`,
    text: `Hello ${ownerName},\n\nYour property "${title}" has been active for over 2 months. Please choose an option:\n- Mark as Sold: ${baseUrl}/api/listings/reminders/action?id=${propertyId}&action=sold&token=${token}\n- Keep Active: ${baseUrl}/api/listings/reminders/action?id=${propertyId}&action=keep&token=${token}\n- Remove Listing: ${baseUrl}/api/listings/reminders/action?id=${propertyId}&action=remove&token=${token}\n\nOr manage this on the website.`,
    html: `
      <div style="font-family: sans-serif; padding: 25px; background-color: #0f172a; color: #ffffff; border-radius: 16px; max-width: 600px; margin: auto; border: 1px solid #1e293b;">
        <h2 style="color: #6366f1; text-align: center; margin-bottom: 20px;">LouLam Marketplace</h2>
        <p style="font-size: 15px; color: #e2e8f0; line-height: 1.6;">Hello ${ownerName},</p>
        <p style="font-size: 15px; color: #e2e8f0; line-height: 1.6;">Your property listing <strong>"${title}"</strong> has been active on LouLam for over 2 months.</p>
        <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin-bottom: 25px;">Please update the status of your listing by choosing one of the options below:</p>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${baseUrl}/api/listings/reminders/action?id=${propertyId}&action=sold&token=${token}" style="display: inline-block; padding: 12px 24px; margin: 5px; background-color: #10b981; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 14px;">Mark as Sold</a>
          <a href="${baseUrl}/api/listings/reminders/action?id=${propertyId}&action=keep&token=${token}" style="display: inline-block; padding: 12px 24px; margin: 5px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 14px;">Keep Active</a>
          <a href="${baseUrl}/api/listings/reminders/action?id=${propertyId}&action=remove&token=${token}" style="display: inline-block; padding: 12px 24px; margin: 5px; background-color: #ef4444; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 14px;">Remove Listing</a>
        </div>
        
        <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; border-top: 1px solid #1e293b; padding-top: 15px;">
          Alternatively, you can manage your listings at any time by logging into your account on the <a href="${baseUrl}" style="color: #6366f1; text-decoration: none; font-weight: bold;">LouLam website</a>.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`✉️ Property status reminder email successfully sent to ${email} for "${title}"`);
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || `"LouLam" <${user}>`;
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  if (!host || !user || !pass) {
    console.error("❌ SMTP Credentials missing in env variables.");
    throw new ValidationError(
      "SMTP configuration is missing in the environment variables (.env)."
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  const mailOptions = {
    from,
    to: email,
    subject: "LouLam - Reset Your Password",
    text: `You requested to reset your password. Please click the following link to reset your password: ${resetUrl}`,
    html: `
      <div style="font-family: sans-serif; padding: 25px; background-color: #0f172a; color: #ffffff; border-radius: 16px; max-width: 600px; margin: auto; border: 1px solid #1e293b;">
        <h2 style="color: #6366f1; text-align: center; margin-bottom: 20px;">LouLam</h2>
        <p style="font-size: 15px; color: #e2e8f0; line-height: 1.6;">Hello,</p>
        <p style="font-size: 15px; color: #e2e8f0; line-height: 1.6;">We received a request to reset your password for your LouLam account.</p>
        <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin-bottom: 25px;">Please click the button below to choose a new password. This link is valid for 15 minutes.</p>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.4);">Reset Password</a>
        </div>
        
        <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; border-top: 1px solid #1e293b; padding-top: 15px;">
          If you did not request a password reset, please ignore this email. Your password will remain unchanged.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`✉️ Password reset email successfully sent to ${email}`);
}
