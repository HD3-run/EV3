import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, setupRoutes } from '../../backend/index';

describe('Backend Health Check', () => {
    beforeAll(async () => {
        // Ensure routes are set up
        await setupRoutes();
    });

    it('should return 200 OK for the root endpoint or health check', async () => {
        // The app might not have a root route defined in index.ts, checking routes.ts
        // Usually APIs have a health endpoint.
        // Let's check a known endpoint like /api/websocket-status which is defined in index.ts
        const response = await request(app).get('/api/websocket-status');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'WebSocket server is running');
    });
});
