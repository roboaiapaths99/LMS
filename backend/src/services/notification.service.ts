import { Notification } from '../models';

// Map of userId to a Set of active WebSocket connections
export const activeUserSockets = new Map<string, Set<any>>();

/**
 * Sends a system notification to a specific user and broadcasts it in real-time via WebSockets.
 * @param userId - The MongoDB ObjectId of the user
 * @param title - Notification title
 * @param message - Notification body/message
 * @param type - Type of notification (INFO, SUCCESS, WARNING, DANGER)
 */
export async function sendSystemNotification(userId: string, title: string, message: string, type: string = 'INFO') {
  try {
    // 1. Save to Database
    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
      isRead: false,
    });

    // 2. Broadcast to active sockets
    const sockets = activeUserSockets.get(userId.toString());
    if (sockets && sockets.size > 0) {
      const payload = JSON.stringify({
        type: 'NOTIFICATION_RECEIVED',
        notification
      });

      for (const socket of sockets) {
        try {
          socket.send(payload);
        } catch (err) {
          // Socket might be closed/stale, ignore
        }
      }
    }

    return notification;
  } catch (error) {
    console.error(`Failed to send notification to user ${userId}:`, error);
  }
}
