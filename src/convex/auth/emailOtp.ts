import { Email } from "@convex-dev/auth/providers/Email";
import axios from "axios";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15,
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    return generateRandomString(random, "0123456789", 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const apiKey = process.env.VLY_EMAIL_API_KEY;
    if (!apiKey) throw new Error("VLY_EMAIL_API_KEY is not configured");
    try {
      await axios.post(
        "https://email.vly.ai/send_otp",
        { to: email, otp: token, appName: process.env.VLY_APP_NAME || "MechanicAI" },
        { headers: { "x-api-key": apiKey } },
      );
    } catch {
      throw new Error("Unable to send verification email");
    }
  },
});
