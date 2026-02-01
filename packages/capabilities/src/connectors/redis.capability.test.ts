/**
 * packages/capabilities/src/connectors/redis.capability.test.ts
 * TCS-001 contract verification for Redis capability.
 */
import { describe, it, expect } from 'vitest';
import { redisCapability } from './redis.capability.js';

describe('redisCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                redisCapability.schemas.input.parse(redisCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                redisCapability.schemas.output.parse(redisCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(redisCapability.metadata.id).toBe('golden.connectors.redis');
            expect(redisCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(redisCapability.metadata.name).toBe('redis');
            expect(redisCapability.metadata.tags).toContain('redis');
            expect(redisCapability.metadata.tags).toContain('cache');
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = [
                'get', 'set', 'delete', 'exists', 'expire', 'ttl',
                'incr', 'decr', 'hget', 'hset', 'hgetall',
                'lpush', 'rpush', 'lpop', 'lrange',
                'sadd', 'smembers', 'publish', 'keys',
            ];
            for (const operation of operations) {
                expect(() =>
                    redisCapability.schemas.input.parse({ operation })
                ).not.toThrow();
            }
        });

        it('accepts set with TTL', () => {
            const result = redisCapability.schemas.input.safeParse({
                operation: 'set',
                key: 'test:key',
                value: 'test-value',
                ttlSeconds: 3600,
            });
            expect(result.success).toBe(true);
        });

        it('accepts hash operations', () => {
            const result = redisCapability.schemas.input.safeParse({
                operation: 'hset',
                key: 'user:123',
                fields: { name: 'John', email: 'john@example.com' },
            });
            expect(result.success).toBe(true);
        });

        it('accepts list operations', () => {
            const result = redisCapability.schemas.input.safeParse({
                operation: 'lrange',
                key: 'queue:tasks',
                start: 0,
                stop: 10,
            });
            expect(result.success).toBe(true);
        });
    });

    describe('factory function', () => {
        it('builds a Dagger container with Redis', () => {
            const calls: { env: Array<{ key: string; value: string }>; from: string[] } = {
                env: [],
                from: [],
            };
            const fakeDag = {
                container() {
                    const builder = {
                        from(image: string) {
                            calls.from.push(image);
                            return builder;
                        },
                        withEnvVariable(key: string, value: string) {
                            calls.env.push({ key, value });
                            return builder;
                        },
                        withMountedSecret() {
                            return builder;
                        },
                        withExec() {
                            return builder;
                        },
                    };
                    return builder;
                },
            };

            redisCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: { host: 'redis.example.com', port: 6380 },
                    secretRefs: {},
                },
                {
                    operation: 'get',
                    key: 'test:key',
                }
            );

            expect(calls.from[0]).toContain('redis');
            expect(calls.env.some((e) => e.key === 'REDIS_HOST' && e.value === 'redis.example.com')).toBe(true);
            expect(calls.env.some((e) => e.key === 'REDIS_PORT' && e.value === '6380')).toBe(true);
        });
    });
});
