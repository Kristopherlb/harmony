/**
 * packages/core/src/binders/flag-provider.ts
 * Feature Flag Provider - Abstraction for feature flag evaluation.
 * Compatible with OpenFeature concepts.
 */
import { z } from '@golden/schema-registry';

export type FlagValue = boolean | string | number | Record<string, unknown>;

export const evaluationContextSchema = z.record(z.unknown());
export type EvaluationContext = z.infer<typeof evaluationContextSchema>;

export interface FlagResolution<T extends FlagValue> {
    value: T;
    variant?: string;
    reason?: string;
    errorCode?: string;
}

export interface FlagProvider {
    name: string;
    getBooleanValue(flagKey: string, defaultValue: boolean, context: EvaluationContext): Promise<FlagResolution<boolean>>;
    getStringValue(flagKey: string, defaultValue: string, context: EvaluationContext): Promise<FlagResolution<string>>;
    getNumberValue(flagKey: string, defaultValue: number, context: EvaluationContext): Promise<FlagResolution<number>>;
    getObjectValue<T extends Record<string, unknown>>(flagKey: string, defaultValue: T, context: EvaluationContext): Promise<FlagResolution<T>>;
}

export class FeatureFlagBroker {
    private providers: Map<string, FlagProvider> = new Map();
    private defaultProviderName: string | null = null;

    registerProvider(provider: FlagProvider, isDefault = false) {
        this.providers.set(provider.name, provider);
        if (isDefault || !this.defaultProviderName) {
            this.defaultProviderName = provider.name;
        }
    }

    getProvider(name?: string): FlagProvider {
        const providerName = name || this.defaultProviderName;
        if (!providerName) {
            throw new Error('No flag provider registered');
        }
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`Flag provider '${providerName}' not found`);
        }
        return provider;
    }

    async getBoolean(key: string, defaultValue: boolean, context: EvaluationContext = {}): Promise<boolean> {
        try {
            const result = await this.getProvider().getBooleanValue(key, defaultValue, context);
            return result.value;
        } catch (error) {
            console.warn(`Flag evaluation failed for ${key}:`, error);
            return defaultValue;
        }
    }

    // Helper for other types could be added here
}
