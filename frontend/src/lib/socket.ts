import { io, Socket } from 'socket.io-client';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket && socket.connected) {
    return socket;
  }

  socket = io(BACKEND_URL, {
    transports: ['websocket', 'polling'],
    query: { token },
    autoConnect: true,
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export default { getSocket, connectSocket, disconnectSocket };
