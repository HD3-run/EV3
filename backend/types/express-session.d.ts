import { Session, SessionData } from 'express-session';

declare module 'express-session' {
  interface SessionData {
    csrfSecret: string;
    // Add other custom session properties here if needed
    // For example:
    // userId?: string;
    // isLoggedIn?: boolean;
  }

  interface Session {
    // You can add methods to the session object if needed
    regenerate(callback: (err: any) => void): void;
    destroy(callback: (err: any) => void): void;
    reload(callback: (err: any) => void): void;
    save(callback?: (err: any) => void): void;
    touch(): void;
  }
}

// Extend the Express Request type to include our custom session
declare global {
  namespace Express {
    interface Request {
      session: Session & Partial<SessionData>;
      // Add other custom request properties here if needed
    }
  }
}
