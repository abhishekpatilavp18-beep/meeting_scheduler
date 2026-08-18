import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    // If already connected, skip
    if (this.socket?.connected) return;

    // If there's an existing disconnected socket, clean it up first
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    const token = localStorage.getItem('token');
    
    this.socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log('⚡ Socket connected');
      // Re-authenticate on every (re)connect to ensure the server
      // joins this socket into the correct user room.
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          this.socket.emit('auth:authenticate', user._id);
        } catch (e) {
          console.error("Failed to parse user for socket auth", e);
        }
      }
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
    });

    // Re-attach all listeners that were registered
    for (const [event, callbacks] of this.listeners.entries()) {
      for (const callback of callbacks) {
        this.socket.on(event, callback);
      }
    }
  }

  /**
   * Reconnect with a fresh token — used after login to ensure the
   * socket handshake carries the new JWT and the server joins the
   * correct user notification room.
   */
  reconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.connect();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
      if (this.socket) {
        this.socket.off(event, callback);
      }
    }
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }
}

export const socketService = new SocketService();
