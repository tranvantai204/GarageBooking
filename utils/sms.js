// Simple SMS sender with optional Twilio integration
// Configure via env:
// SMS_PROVIDER=twilio
// TWILIO_ACCOUNT_SID=...
// TWILIO_AUTH_TOKEN=...
// TWILIO_FROM=+1...

async function sendOtpSms(phone, otp) {
  try {
    const provider = process.env.SMS_PROVIDER || '';
    if (provider.toLowerCase() === 'twilio') {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_FROM;
      if (!sid || !token || !from) throw new Error('Missing Twilio env vars');
      const twilio = require('twilio')(sid, token);
      await twilio.messages.create({ to: phone, from, body: `Ma OTP dat lai mat khau: ${otp}` });
      return { success: true, provider: 'twilio' };
    }
    // Default: no real SMS, just log for debugging
    console.log(`DEV SMS → ${phone}: OTP=${otp}`);
    return { success: true, provider: 'dev' };
  } catch (e) {
    console.error('SMS send error:', e);
    return { success: false, error: e.message };
  }
}

module.exports = { sendOtpSms };



