/**
 * packages/capabilities/src/security/scorecard.capability.test.ts
 * TCS-001 contract verification for OpenSSF Scorecard capability.
 */
import { describe, it, expect } from 'vitest';
import { scorecardCapability } from './scorecard.capability.js';

describe('scorecardCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                scorecardCapability.schemas.input.parse(scorecardCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                scorecardCapability.schemas.output.parse(scorecardCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(scorecardCapability.metadata.id).toBe('golden.security.scorecard');
            expect(scorecardCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(scorecardCapability.metadata.name).toBe('scorecard');
            expect(scorecardCapability.metadata.description).toBeTruthy();
            expect(scorecardCapability.metadata.tags).toContain('openssf');
        });

        it('declares network access for GitHub and Scorecard API', () => {
            expect(scorecardCapability.security.networkAccess.allowOutbound).toContain('api.github.com');
            expect(scorecardCapability.security.networkAccess.allowOutbound).toContain('api.securityscorecards.dev');
        });
    });

    describe('factory - repository scan', () => {
        it('builds a Dagger container for repository analysis', () => {
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

            scorecardCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    repository: 'ossf/scorecard',
                }
            );

            expect(calls.from[0]).toContain('scorecard');
            expect(calls.env.some((e) => e.key === 'REPOSITORY' && e.value === 'ossf/scorecard')).toBe(true);
        });
    });

    describe('factory - with specific commit', () => {
        it('passes commit SHA to container', () => {
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

            scorecardCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    repository: 'ossf/scorecard',
                    commit: 'abc123',
                }
            );

            const inputJson = calls.env.find((e) => e.key === 'INPUT_JSON');
            expect(inputJson).toBeDefined();
            const parsed = JSON.parse(inputJson!.value);
            expect(parsed.commit).toBe('abc123');
        });
    });

    describe('schema validation', () => {
        it('accepts repository in different formats', () => {
            const repos = [
                'owner/repo',
                'https://github.com/owner/repo',
                'github.com/owner/repo',
            ];

            for (const repository of repos) {
                expect(() =>
                    scorecardCapability.schemas.input.parse({ repository })
                ).not.toThrow();
            }
        });

        it('validates check score range', () => {
            const validOutput = {
                repository: 'github.com/test/repo',
                score: 7.5,
                checks: [
                    { name: 'Branch-Protection', score: 10, reason: 'enabled' },
                    { name: 'Failing-Check', score: -1, reason: 'check failed' },
                ],
                date: '2024-01-15T10:30:00Z',
                version: 'v4.13.1',
            };

            expect(() =>
                scorecardCapability.schemas.output.parse(validOutput)
            ).not.toThrow();
        });
    });
});
