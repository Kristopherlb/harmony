/**
 * packages/capabilities/src/connectors/aws-sdk.capability.test.ts
 * TCS-001 contract verification for AWS SDK capability.
 */
import { describe, it, expect } from 'vitest';
import { awsSdkCapability } from './aws-sdk.capability.js';

describe('awsSdkCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                awsSdkCapability.schemas.input.parse(awsSdkCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                awsSdkCapability.schemas.output.parse(awsSdkCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(awsSdkCapability.metadata.id).toBe('golden.connectors.aws-sdk');
            expect(awsSdkCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(awsSdkCapability.metadata.name).toBe('awsSdk');
            expect(awsSdkCapability.metadata.description).toBeTruthy();
            expect(awsSdkCapability.metadata.tags).toContain('connector');
        });

        it('declares network access for AWS', () => {
            expect(awsSdkCapability.security.networkAccess.allowOutbound.length).toBeGreaterThan(0);
        });
    });

    describe('factory - S3 operations', () => {
        it('builds a Dagger container for S3 getObject', () => {
            const calls: { env: Array<{ key: string; value: string }>; exec: string[][]; from: string[] } = {
                env: [],
                exec: [],
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
                        withExec(args: string[]) {
                            calls.exec.push(args);
                            return builder;
                        },
                    };
                    return builder;
                },
            };

            awsSdkCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: { region: 'us-east-1' },
                    secretRefs: { accessKeyId: '/secrets/aws-key', secretAccessKey: '/secrets/aws-secret' },
                },
                {
                    service: 's3',
                    operation: 'getObject',
                    params: { Bucket: 'my-bucket', Key: 'path/to/file.txt' },
                }
            );

            expect(calls.from[0]).toContain('node:');
            expect(calls.env.some((e) => e.key === 'AWS_SERVICE' && e.value === 's3')).toBe(true);
            expect(calls.env.some((e) => e.key === 'AWS_OPERATION' && e.value === 'getObject')).toBe(true);
        });
    });

    describe('factory - STS operations', () => {
        it('builds a Dagger container for STS assumeRole', () => {
            const calls: { env: Array<{ key: string; value: string }> } = { env: [] };
            const fakeDag = {
                container: () => ({
                    from: () => ({
                        withEnvVariable: (key: string, value: string) => {
                            calls.env.push({ key, value });
                            return fakeDag.container().from();
                        },
                        withExec: () => fakeDag.container().from(),
                    }),
                }),
            };

            awsSdkCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: { region: 'us-east-1' },
                    secretRefs: {},
                },
                {
                    service: 'sts',
                    operation: 'assumeRole',
                    params: { RoleArn: 'arn:aws:iam::123:role/MyRole', RoleSessionName: 'session' },
                }
            );

            const service = calls.env.find((e) => e.key === 'AWS_SERVICE');
            expect(service?.value).toBe('sts');
        });
    });

    describe('schema validation', () => {
        it('accepts common AWS services', () => {
            const services = ['s3', 'sts', 'lambda', 'dynamodb', 'sqs', 'sns', 'secretsmanager'];

            for (const service of services) {
                expect(() =>
                    awsSdkCapability.schemas.input.parse({
                        service,
                        operation: 'list',
                        params: {},
                    })
                ).not.toThrow();
            }
        });

        it('requires operation', () => {
            expect(() =>
                awsSdkCapability.schemas.input.parse({
                    service: 's3',
                    params: {},
                })
            ).toThrow();
        });
    });
});
