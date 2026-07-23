import { io } from "socket.io-client";

let socketInstance = null;

function getToken() {
  return (
    sessionStorage.getItem(
      "kidcare_token",
    ) ||
    localStorage.getItem(
      "kidcare_token",
    ) ||
    ""
  );
}

function createSocket() {
  const socketUrl =
    import.meta.env.VITE_SOCKET_URL ||
    undefined;

  return io(socketUrl, {
    path: "/socket.io",
    autoConnect: false,
    transports: [
      "websocket",
      "polling",
    ],
    withCredentials: true,

    auth: (callback) => {
      callback({
        token: getToken(),
      });
    },

    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
  });
}

export function getChatSocket() {
  if (!socketInstance) {
    socketInstance = createSocket();
  }

  const token = getToken();

  socketInstance.auth = {
    token,
  };

  if (!socketInstance.connected) {
    socketInstance.connect();
  }

  return socketInstance;
}

export function disconnectChatSocket() {
  if (!socketInstance) return;

  socketInstance.removeAllListeners();
  socketInstance.disconnect();
  socketInstance = null;
}

export function emitSocketWithAck(
  eventName,
  payload,
  timeoutMs = 10000,
) {
  const socket = getChatSocket();

  return new Promise(
    (resolve, reject) => {
      socket
        .timeout(timeoutMs)
        .emit(
          eventName,
          payload,
          (
            timeoutError,
            response,
          ) => {
            if (timeoutError) {
              reject(
                new Error(
                  "Máy chủ phản hồi quá lâu. Vui lòng thử lại.",
                ),
              );

              return;
            }

            if (!response?.success) {
              reject(
                new Error(
                  response?.message ||
                    "Không thể thực hiện yêu cầu realtime.",
                ),
              );

              return;
            }

            resolve(response.data);
          },
        );
    },
  );
}