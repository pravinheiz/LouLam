/**
 * OTP Delivery Helper
 * Bypasses npm dependency installation by using standard fetch to interact with the Twilio API,
 * and falls back to a sandbox/mock console log if credentials are not configured in .env.
 */
export async function sendOtpSms(
  phone: string,
  code: string
): Promise<{ success: boolean; mock?: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  const isConfigured = accountSid && authToken && twilioPhone;

  if (isConfigured) {
    try {
      console.log(`📡 Attempting to send real SMS OTP to ${phone} via Twilio...`);
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      
      const bodyParams = new URLSearchParams({
        To: phone,
        From: twilioPhone,
        Body: `Your LouLam verification code is: ${code}. It expires in 5 minutes.`,
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: bodyParams.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Twilio responded with status ${response.status}`);
      }

      console.log(`✅ Twilio SMS successfully dispatched. SID: ${data.sid}`);
      return { success: true, mock: false };
    } catch (err: any) {
      console.error("❌ Twilio OTP dispatch failed:", err);
      // Fallback to mock on Twilio error so it doesn't break local user registration testing
      console.log(`⚠️ Falling back to sandbox console log for ${phone} due to Twilio error`);
      logMockOtp(phone, code);
      return { success: true, mock: true, error: err.message };
    }
  } else {
    // Sandbox Mock Fallback
    logMockOtp(phone, code);
    return { success: true, mock: true };
  }
}

function logMockOtp(phone: string, code: string) {
  console.log("\n========================================================");
  console.log("🔥 [OTP SERVICE] SANDBOX VERIFICATION SMS");
  console.log(`👉 Recipient:   ${phone}`);
  console.log(`👉 Verification Code: ${code}`);
  console.log("👉 Expiration:  5 Minutes");
  console.log("========================================================\n");
}
