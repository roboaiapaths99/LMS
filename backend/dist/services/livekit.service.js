"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLiveKitToken = generateLiveKitToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
/**
 * Generates an Access Token for a LiveKit room.
 * This is signed using the LiveKit API Key and Secret using standard HS256 JWT.
 */
function generateLiveKitToken({ roomName, participantIdentity, participantName, isInstructor }) {
    const apiKey = process.env.LIVEKIT_API_KEY || 'dev_livekit_key';
    const apiSecret = process.env.LIVEKIT_API_SECRET || 'dev_livekit_secret';
    const payload = {
        sub: participantIdentity,
        name: participantName,
        iss: apiKey,
        video: {
            roomJoin: true,
            room: roomName,
            canPublish: isInstructor, // Instructors can stream/publish
            canSubscribe: true, // All participants can subscribe
            canPublishData: true,
            hidden: false,
            recorder: false
        }
    };
    return jsonwebtoken_1.default.sign(payload, apiSecret, {
        expiresIn: '6h', // 6 hours token validity
    });
}
