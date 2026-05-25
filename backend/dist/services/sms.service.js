"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOTP = generateOTP;
exports.sendOTP = sendOTP;
const env_1 = require("../config/env");
// Generate a 6-digit OTP
function generateOTP() {
    if (env_1.env.NODE_ENV === 'development')
        return '123456'; // Static OTP for easy dev testing
    return Math.floor(100000 + Math.random() * 900000).toString();
}
async function sendOTP(mobile, otp) {
    try {
        const apiKey = env_1.env.METAREACH_API_KEY;
        const senderId = env_1.env.METAREACH_SENDER_ID;
        const templateId = env_1.env.METAREACH_TEMPLATE_ID;
        const apiUrl = env_1.env.METAREACH_API_URL || 'https://api.metareach.com/v2/send';
        const isMock = !apiKey || apiKey === 'dev_key';
        if (isMock) {
            console.log(`[MOCK MODE] 📲 OTP for ${mobile} is ${otp}`);
            return true;
        }
        // Standard DLT matching message format for OTP verification
        const message = `${otp} is your OTP to login at RoboAIPaths LMS. Do not share this with anyone. AGPKAC`;
        console.log(`[SMS] Sending real OTP via MetaReach to ${mobile}...`);
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                apiKey,
                senderId,
                templateId,
                mobile,
                message,
                route: 'OTP'
            })
        });
        const responseText = await response.text();
        console.log(`[SMS] MetaReach Status: ${response.status}. Response:`, responseText);
        if (!response.ok) {
            console.error(`[SMS Error] MetaReach API returned HTTP ${response.status}:`, responseText);
            return false;
        }
        return true;
    }
    catch (error) {
        console.error('[SMS Error] Failed to send SMS via MetaReach:', error);
        return false;
    }
}
