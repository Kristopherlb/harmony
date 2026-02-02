/**
 * packages/core/src/binders/flag-provider.test.ts
 * Tests for Feature Flag Broker.
 */
import { describe, it, expect, vi } from 'vitest';
import { FeatureFlagBroker, FlagProvider } from './flag-provider.js';

describe('Feature Flag Broker', () => {
    it('resolves flags from registered provider', async () => {
        const broker = new FeatureFlagBroker();
        const provider: FlagProvider = {
            name: 'test-provider',
            getBooleanValue: vi.fn().mockResolvedValue({ value: true }),
            getStringValue: vi.fn(),
            getNumberValue: vi.fn(),
            getObjectValue: vi.fn(),
        };

        broker.registerProvider(provider, true);
        const value = await broker.getBoolean('my-flag', false);

        expect(value).toBe(true);
        expect(provider.getBooleanValue).toHaveBeenCalledWith('my-flag', false, {});
    });

    it('returns default value on failure', async () => {
        const broker = new FeatureFlagBroker();
        const provider: FlagProvider = {
            name: 'broken-provider',
            getBooleanValue: vi.fn().mockRejectedValue(new Error('error')),
            getStringValue: vi.fn(),
            getNumberValue: vi.fn(),
            getObjectValue: vi.fn(),
        };

        broker.registerProvider(provider, true);
        const value = await broker.getBoolean('my-flag', false);

        expect(value).toBe(false);
    });

    it('throws if no provider registered', async () => {
        const broker = new FeatureFlagBroker();
        const value = await broker.getBoolean('my-flag', false);
        expect(value).toBe(false);
    });
});
