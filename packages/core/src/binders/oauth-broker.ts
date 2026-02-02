/**
 * packages/core/src/binders/oauth-broker.ts
 * OAuth Broker - Manages OAuth token lifecycle, storage, and refreshing.
 */
import { z } from '@golden/schema-registry';

// Schema for OAuth Token
export const oauthTokenSchema = z.object({
    accessToken: z.string(),
    refreshToken: z.string().optional(),
    expiresAt: z.number().describe('Timestamp in milliseconds'),
    scope: z.string().optional(),
    tokenType: z.string().default('Bearer'),
});

export type OAuthToken = z.infer<typeof oauthTokenSchema>;

// Abstract Token Storage
export interface TokenStorage {
    getToken(providerId: string): Promise<OAuthToken | null>;
    saveToken(providerId: string, token: OAuthToken): Promise<void>;
    deleteToken(providerId: string): Promise<void>;
}

// OAuth Configuration
export interface OAuthConfig {
    clientId: string;
    clientSecret?: string;
    authUrl: string;
    tokenUrl: string;
    scope?: string;
}

export class OAuthBroker {
    constructor(
        private readonly storage: TokenStorage,
        private readonly fetcher: (url: string, init?: RequestInit) => Promise<Response> = fetch
    ) { }

    /**
     * Get a valid access token. Refreshes if expired.
     */
    async getAccessToken(providerId: string, config: OAuthConfig): Promise<string> {
        const token = await this.storage.getToken(providerId);

        if (!token) {
            throw new Error(`No token found for provider ${providerId}. Authenticate first.`);
        }

        if (this.isExpired(token)) {
            if (!token.refreshToken) {
                throw new Error(`Token expired and no refresh token available for ${providerId}`);
            }
            return this.refreshToken(providerId, token.refreshToken, config);
        }

        return token.accessToken;
    }

    private isExpired(token: OAuthToken): boolean {
        // Add 10-second buffer
        return Date.now() > token.expiresAt - 10000;
    }

    private async refreshToken(
        providerId: string,
        refreshToken: string,
        config: OAuthConfig
    ): Promise<string> {
        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: config.clientId,
        });

        if (config.clientSecret) {
            body.append('client_secret', config.clientSecret);
        }

        const response = await this.fetcher(config.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        });

        if (!response.ok) {
            throw new Error(`Failed to refresh token: ${response.statusText}`);
        }

        const data = await response.json();

        // Calculate new expiry
        const expiresIn = data.expires_in || 3600;
        const expiresAt = Date.now() + expiresIn * 1000;

        const newToken: OAuthToken = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token || refreshToken, // Reuse old if not rotated
            expiresAt,
            scope: data.scope || config.scope,
            tokenType: data.token_type || 'Bearer',
        };

        await this.storage.saveToken(providerId, newToken);
        return newToken.accessToken;
    }
}
