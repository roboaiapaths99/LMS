import jwt from 'jsonwebtoken';

/**
 * Generates an Access Token for a LiveKit room.
 * This is signed using the LiveKit API Key and Secret using standard HS256 JWT.
 */
export function generateLiveKitToken({
  roomName,
  participantIdentity,
  participantName,
  isInstructor
}: {
  roomName: string;
  participantIdentity: string;
  participantName: string;
  isInstructor: boolean;
}) {
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
      canSubscribe: true,       // All participants can subscribe
      canPublishData: true,
      hidden: false,
      recorder: false
    }
  };

  return jwt.sign(payload, apiSecret, {
    expiresIn: '6h', // 6 hours token validity
  });
}
