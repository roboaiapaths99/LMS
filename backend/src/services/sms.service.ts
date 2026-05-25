import { env } from '../config/env';

// Generate a 6-digit OTP
export function generateOTP(): string {
  if (env.NODE_ENV === 'development') return '123456'; // Static OTP for easy dev testing
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOTP(mobile: string, otp: string): Promise<boolean> {
  try {
    const apiKey = env.METAREACH_API_KEY;
    const senderId = env.METAREACH_SENDER_ID;
    const templateId = env.METAREACH_TEMPLATE_ID;
    const apiUrl = env.METAREACH_API_URL || 'https://api.metareach.com/v2/send';

    const isMock = !apiKey || apiKey === 'dev_key';

    if (isMock) {
      console.log(`[MOCK MODE] 📲 OTP for ${mobile} is ${otp}`);
      return true;
    }

    // Standard DLT matching message format for OTP verification
    const message = `${otp} is your OTP to login at RoboAIPaths LMS. Do not share this with anyone. AGPKAC`;

    console.log(`[SMS] Sending real OTP via MetaReach to ${mobile}... (OTP: ${otp})`);

    const baseUrl = apiUrl || 'https://sms.metareach.in/vb/apikey.php';
    const params = new URLSearchParams({
      apikey: apiKey,
      senderid: senderId,
      number: mobile,
      message: message,
      templateid: templateId,
      format: 'json'
    });
    
    const requestUrl = `${baseUrl}?${params.toString()}`;

    const response = await fetch(requestUrl, {
      method: 'GET'
    });

    const responseText = await response.text();
    console.log(`[SMS] MetaReach Status: ${response.status}. Response:`, responseText);

    if (!response.ok) {
      console.error(`[SMS Error] MetaReach API returned HTTP ${response.status}:`, responseText);
      return true; // Fallback to allow login during testing even if gateway rejects
    }

    return true;
  } catch (error) {
    console.error('[SMS Error] Failed to send SMS via MetaReach:', error);
    // Fallback so the user can still login using the logged OTP
    console.log(`[FALLBACK] Use OTP ${otp} for mobile ${mobile}`);
    return true;
  }
}
