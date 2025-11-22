import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import { app, setupRoutes } from '../../backend/index';

// Mock the database pool
// Mock the database pool
const mockPool = {
    connect: vi.fn().mockResolvedValue({
        query: vi.fn(),
        release: vi.fn(),
    }),
    query: vi.fn(),
    on: vi.fn(), // Add event listener mock
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
};

vi.mock('../../backend/db', () => ({
    pool: mockPool,
    default: mockPool,
}));

describe('Authentication API', () => {
    beforeAll(async () => {
        await setupRoutes();
    });

    it('should return 400 if login fields are missing', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({});

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('message');
    });

    it('should return 401 for invalid credentials', async () => {
        // We are mocking the DB, so it won't find the user unless we mock the return value.
        // By default the mock returns undefined/empty, so findUserByEmailOrPhone will return null.

        const response = await request(app)
            .post('/api/auth/login')
            .send({
                emailOrPhone: 'nonexistent@example.com',
                password: 'wrongpassword'
            });

        expect(response.status).toBe(401);
    });
});
