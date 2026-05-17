import { useEffect, useState } from "react";
import { signalRService } from "../services/signalRService";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  createdOn: string;
  isRead: boolean;
}

export interface SessionEndedData {
  transactionId: number;
  roomId: string;
  setId?: number;
  endedAtUtc: string;
}

export const useSignalR = (token: string | null) => {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!token) return;

    const connectSignalR = async () => {
      try {
        await signalRService.start(token);
        setIsConnected(true);

        const handleNotification = (notification: Notification) => {
          console.log("New notification received:", notification);
          setNotifications((prev) => [notification, ...prev]);
        };

        const handleNotificationRead = (notificationId: string) => {
          console.log("Notification marked as read:", notificationId);
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === notificationId ? { ...n, isRead: true } : n
            )
          );
        };

        const handleSessionEnded = (sessionData: SessionEndedData) => {
          console.log("Session ended:", sessionData);
          // Create a notification for session ended
          const sessionNotification: Notification = {
            id: `session-ended-${sessionData.transactionId}-${Date.now()}`,
            title: "Session Ended",
            message: `Transaction #${sessionData.transactionId} in Room ${
              sessionData.roomId
            }${
              sessionData.setId ? ` (Set ${sessionData.setId})` : ""
            } has ended`,
            type: "info",
            createdOn: sessionData.endedAtUtc,
            isRead: false,
          };
          setNotifications((prev) => [sessionNotification, ...prev]);
        };

        signalRService.on<[Notification]>(
          "ReceiveNotification",
          handleNotification
        );
        signalRService.on<[string]>("NotificationRead", handleNotificationRead);
        // Try all lowercase to match the warning message
        signalRService.on<[SessionEndedData]>(
          "sessionended",
          handleSessionEnded
        );
        console.log(
          "SignalR handlers registered: ReceiveNotification, NotificationRead, sessionended"
        );

        return () => {
          signalRService.off("ReceiveNotification", handleNotification);
          signalRService.off("NotificationRead", handleNotificationRead);
          signalRService.off("sessionended", handleSessionEnded);
        };
      } catch (error) {
        console.error("Failed to connect to SignalR:", error);
        setIsConnected(false);
      }
    };

    const cleanup = connectSignalR();

    return () => {
      cleanup.then((cleanupFn) => cleanupFn?.());
      signalRService.stop();
      setIsConnected(false);
    };
  }, [token]);

  const markAsRead = async (notificationId: string): Promise<void> => {
    try {
      await signalRService.invoke<void>(
        "MarkNotificationAsRead",
        notificationId
      );
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  return {
    isConnected,
    notifications,
    markAsRead,
  };
};
