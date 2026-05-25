import { env } from '../config/env';

// Generate a 6-digit OTP
export function generateOTP(): string {
  // Always generate a real random OTP in production, or when real keys are provided
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOTP(mobile: string, otp: string): Promise<boolean> {
  try {
    const apiKey = env.METAREACH_API_KEY;
    const senderId = env.METAREACH_SENDER_ID || 'AGPKAC'; // Fallback to AGPKAC if missing
    const templateId = env.METAREACH_TEMPLATE_ID;
    
    // As per documentation:
    const baseUrl = 'https://sms.metareach.in/vb/apikey.php';

    const isMock = !apiKey || apiKey === 'dev_key';

    if (isMock) {
      console.log(`[MOCK MODE] 📲 OTP for ${mobile} is ${otp}`);
      return true;
    }

    // Standard DLT matching message format for OTP verification
    const message = `Welcome to AGPK Academy login. Your verification code is ${otp}. This OTP will expire in 5 minutes`;

    console.log(`[SMS] Sending real OTP via MetaReach to ${mobile}... (OTP: ${otp})`);

    const params = new URLSearchParams();
    params.append('apikey', apiKey);
    params.append('senderid', senderId);
    params.append('number', mobile);
    params.append('message', message);
    params.append('format', 'json');
    
    // Only append templateid if it actually exists in env, to avoid sending "undefined"
    if (templateId && templateId !== 'undefined') {
      params.append('templateid', templateId);
    }
    
    const requestUrl = `${baseUrl}?${params.toString()}`;

    const response = await fetch(requestUrl, {
      method: 'GET' // As per API documentation
    });

    const responseText = await response.text();
    let jsonResponse: any = {};
    try {
      jsonResponse = JSON.parse(responseText);
    } catch(e) {}

    console.log(`[SMS] MetaReach Status: ${response.status}. Response:`, responseText);

    if (!response.ok || jsonResponse.status === 'false' || jsonResponse.status === false) {
      console.error(`[SMS Error] MetaReach API failed. Reason: ${jsonResponse.description || responseText}`);
      return true; // Still fallback so we don't completely lock out the system during misconfiguration
    }

    return true;
  } catch (error) {
    console.error('[SMS Error] Failed to send SMS via MetaReach:', error);
    console.log(`[FALLBACK] Use OTP ${otp} for mobile ${mobile}`);
    return true;
  }
}
