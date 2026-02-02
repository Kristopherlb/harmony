/**
 * packages/core/src/binders/oauth-broker.test.ts
 * Tests for OAuth Broker.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuthBroker, TokenStorage, OAuthToken } from './oauth-broker.js';

describe('OAuth Broker', () => {
    let storage: TokenStorage;
    let broker: OAuthBroker;
    let fetchMock: any;

    beforeEach(() => {
        storage = {
            getToken: vi.fn(),
            saveToken: vi.fn(),
            deleteToken: vi.fn(),
        };
        fetchMock = vi.fn();
        broker = new OAuthBroker(storage, fetchMock);
    });

    it('returns valid token from storage', async () => {
        const validToken: OAuthToken = {
            accessToken: 'valid-token',
            expiresAt: Date.now() + 100000,
            tokenType: 'Bearer'
        };
        (storage.getToken as any).mockResolvedValue(validToken);

        const token = await broker.getAccessToken('provider', {
            clientId: 'id',
            authUrl: 'auth',
            tokenUrl: 'token'
        });

        expect(token).toBe('valid-token');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refreshes expired token', async () => {
        const expiredToken: OAuthToken = {
            accessToken: 'expired',
            refreshToken: 'refresh-me',
            expiresAt: Date.now() - 1000,
            tokenType: 'Bearer'
        };
        (storage.getToken as any).mockResolvedValue(expiredToken);

        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                access_token: 'new-token',
                expires_in: 3600,
            })
        });

        const token = await broker.getAccessToken('provider', {
            clientId: 'id',
            authUrl: 'auth',
            tokenUrl: 'token'
        });

        expect(token).toBe('new-token');
        expect(fetchMock).toHaveBeenCalledWith('token', expect.objectContaining({
            method: 'POST',
            body: expect.any(URLSearchParams)
        }));
        expect(storage.saveToken).toHaveBeenCalled();
    });

    it('throws if no token found', async () => {
        (storage.getToken as any).mockResolvedValue(null);
        await expect(broker.getAccessToken('provider', {
            clientId: 'id',
            authUrl: 'auth',
            tokenUrl: 'token'
        })).rejects.toThrow('No token found');
    });
});
