import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';

let ioInstance: Server | null = null;

export function initSocket(server: HttpServer): Server {
  const io = new Server(server, {
    cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', methods: ['GET', 'POST'] },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket: Socket) => {
    logger.info('WebSocket client connected', { socketId: socket.id });

    socket.on('join-admin', (data: { role?: string; sectionId?: string; flowId?: string }) => {
      if (data.role === 'SECTION_ADMIN' && data.sectionId) {
        socket.join(`section-${data.sectionId}`);
        socket.join('admin');
      } else if (data.role === 'FLOW_ADMIN' && data.flowId) {
        socket.join(`flow-${data.flowId}`);
        socket.join('admin');
      } else {
        socket.join('admin');
      }
      logger.info('Client joined admin room', { socketId: socket.id, rooms: data });
    });

    socket.on('join-employee', (data: { employeeId?: string }) => {
      if (data.employeeId) {
        socket.join(`employee-${data.employeeId}`);
      }
    });

    socket.on('join-section', (sectionId: string) => {
      socket.join(`section-${sectionId}`);
    });

    socket.on('join-flow', (flowId: string) => {
      socket.join(`flow-${flowId}`);
    });

    socket.on('location-update', (data: { employeeId: string; latitude: number; longitude: number; accuracy: number }) => {
      io.to('admin').emit('employee-location-update', data);
    });

    socket.on('disconnect', () => {
      logger.info('WebSocket client disconnected', { socketId: socket.id });
    });
  });

  ioInstance = io;
  return io;
}

export function getIo(): Server {
  if (!ioInstance) {
    throw new Error('Socket.IO not initialized. Call initSocket() first.');
  }
  return ioInstance;
}

/** Lazy accessor — safe to import at module level, defers actual access until runtime */
export const io = new Proxy({} as Server, {
  get(_target, prop) {
    return (getIo() as any)[prop];
  },
});
