import * as signalR from "@microsoft/signalr";

let connection: signalR.HubConnection | null = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

const setupConnectionHandlers = () => {
  if (!connection) return;

  connection.onclose((error) => {
    console.log("SignalR Connection Closed", error);
  });

  connection.onreconnecting((error) => {
    console.log("SignalR Reconnecting...", error);
  });

  connection.onreconnected((connectionId) => {
    console.log("SignalR Reconnected", connectionId);
    reconnectAttempts = 0;
  });
};

const handleReconnect = () => {
  if (reconnectAttempts < maxReconnectAttempts) {
    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    console.log(`Attempting to reconnect in ${delay}ms...`);

    setTimeout(() => {
      const token = localStorage.getItem("token");
      if (token) {
        start(token);
      }
    }, delay);
  } else {
    console.error("Max reconnection attempts reached");
  }
};

const start = async (token: string): Promise<void> => {
  if (connection?.state === signalR.HubConnectionState.Connected) {
    console.log("SignalR already connected");
    return;
  }

  connection = new signalR.HubConnectionBuilder()
    .withUrl(
      "https://axisapiwebapp-fvh5e7bda3aag0g7.francecentral-01.azurewebsites.net/hubs/reception",
      {
        accessTokenFactory: () => token,
        skipNegotiation: false,
        transport:
          signalR.HttpTransportType.WebSockets |
          signalR.HttpTransportType.ServerSentEvents |
          signalR.HttpTransportType.LongPolling,
      }
    )
    .withAutomaticReconnect({
      nextRetryDelayInMilliseconds: (retryContext) => {
        if (retryContext.previousRetryCount < 5) {
          return Math.min(
            1000 * Math.pow(2, retryContext.previousRetryCount),
            30000
          );
        }
        return null;
      },
    })
    .configureLogging(signalR.LogLevel.Information)
    .build();

  setupConnectionHandlers();

  try {
    await connection.start();
    console.log("SignalR Connected");
    reconnectAttempts = 0;
  } catch (err) {
    console.error("SignalR Connection Error: ", err);
    handleReconnect();
  }
};

// Generic callback type for SignalR events
type SignalRCallback<T extends unknown[] = unknown[]> = (...args: T) => void;

const on = <T extends unknown[] = unknown[]>(
  eventName: string,
  callback: SignalRCallback<T>
): void => {
  if (connection) {
    connection.on(eventName, callback);
  }
};

const off = <T extends unknown[] = unknown[]>(
  eventName: string,
  callback: SignalRCallback<T>
): void => {
  if (connection) {
    connection.off(eventName, callback);
  }
};

const invoke = async <T = unknown>(
  methodName: string,
  ...args: unknown[]
): Promise<T | undefined> => {
  if (connection?.state === signalR.HubConnectionState.Connected) {
    try {
      return await connection.invoke<T>(methodName, ...args);
    } catch (err) {
      console.error(`Error invoking ${methodName}:`, err);
      throw err;
    }
  } else {
    console.warn("SignalR not connected. Cannot invoke method.");
    return undefined;
  }
};

const stop = async (): Promise<void> => {
  if (connection) {
    await connection.stop();
    console.log("SignalR Disconnected");
  }
};

const getConnectionState = (): signalR.HubConnectionState => {
  return connection?.state ?? signalR.HubConnectionState.Disconnected;
};

export const signalRService = {
  start,
  on,
  off,
  invoke,
  stop,
  getConnectionState,
};
