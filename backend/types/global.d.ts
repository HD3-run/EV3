import { Server as SocketIOServer } from 'socket.io';

declare global {
  namespace NodeJS {
    interface Global {
      io: SocketIOServer;
    }
  }
  
  // This makes the `io` property available on the global object in TypeScript
  var io: SocketIOServer;
}
