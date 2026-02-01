/**
 * packages/capabilities/src/utilities/template-renderer.capability.test.ts
 * TCS-001 contract verification for Template Renderer capability.
 */
import { describe, it, expect } from 'vitest';
import { templateRendererCapability } from './template-renderer.capability.js';

describe('templateRendererCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                templateRendererCapability.schemas.input.parse(templateRendererCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                templateRendererCapability.schemas.output.parse(templateRendererCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(templateRendererCapability.metadata.id).toBe('golden.utilities.template-renderer');
            expect(templateRendererCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(templateRendererCapability.metadata.name).toBe('templateRenderer');
<<<<<<< ours
            expect(templateRendererCapability.metadata.description).toBeTruthy();
            expect(templateRendererCapability.metadata.tags).toContain('utility');
=======
>>>>>>> theirs
            expect(templateRendererCapability.metadata.tags).toContain('template');
        });
    });

<<<<<<< ours
    describe('factory - handlebars rendering', () => {
        it('builds a Dagger container for Handlebars rendering', () => {
            const calls: { env: Array<{ key: string; value: string }>; exec: string[][]; from: string[] } = {
                env: [],
                exec: [],
=======
    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = ['render', 'validate', 'extract-vars'];
            for (const operation of operations) {
                expect(() =>
                    templateRendererCapability.schemas.input.parse({ operation })
                ).not.toThrow();
            }
        });

        it('accepts all engines', () => {
            const engines = ['handlebars', 'mustache', 'ejs', 'nunjucks'];
            for (const engine of engines) {
                expect(() =>
                    templateRendererCapability.schemas.input.parse({
                        operation: 'render',
                        template: '{{name}}',
                        engine,
                    })
                ).not.toThrow();
            }
        });

        it('accepts template with partials', () => {
            const result = templateRendererCapability.schemas.input.safeParse({
                operation: 'render',
                template: '{{> header}} Content {{> footer}}',
                partials: {
                    header: '<header>Welcome</header>',
                    footer: '<footer>Copyright</footer>',
                },
                data: {},
            });
            expect(result.success).toBe(true);
        });

        it('accepts extract-vars output', () => {
            const result = templateRendererCapability.schemas.output.safeParse({
                success: true,
                operation: 'extract-vars',
                variables: ['name', 'email', 'count'],
                message: 'Extracted 3 variables',
            });
            expect(result.success).toBe(true);
        });
    });

    describe('factory function', () => {
        it('builds a Dagger container for rendering', () => {
            const calls: { env: Array<{ key: string; value: string }>; from: string[] } = {
                env: [],
>>>>>>> theirs
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
<<<<<<< ours
                        withExec(args: string[]) {
                            calls.exec.push(args);
=======
                        withExec() {
>>>>>>> theirs
                            return builder;
                        },
                    };
                    return builder;
                },
            };

            templateRendererCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
<<<<<<< ours
                    template: 'Hello, {{name}}!',
                    data: { name: 'World' },
                    engine: 'handlebars',
=======
                    operation: 'render',
                    template: 'Hello {{name}}',
                    data: { name: 'World' },
>>>>>>> theirs
                }
            );

            expect(calls.from[0]).toContain('node');
<<<<<<< ours
            expect(calls.env.some((e) => e.key === 'ENGINE' && e.value === 'handlebars')).toBe(true);
            expect(calls.env.some((e) => e.key === 'TEMPLATE')).toBe(true);
            expect(calls.env.some((e) => e.key === 'DATA')).toBe(true);
            expect(calls.exec.length).toBe(1);
        });
    });

    describe('factory - with partials', () => {
        it('builds a Dagger container with partials', () => {
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

            templateRendererCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    template: '{{> header}}Content{{> footer}}',
                    data: {},
                    partials: {
                        header: '<header>Header</header>',
                        footer: '<footer>Footer</footer>',
                    },
                }
            );

            expect(calls.env.some((e) => e.key === 'PARTIALS')).toBe(true);
        });
    });

    describe('schema validation', () => {
        it('accepts all engines', () => {
            const engines = ['handlebars', 'mustache', 'ejs'];

            for (const engine of engines) {
                expect(() =>
                    templateRendererCapability.schemas.input.parse({
                        template: 'test',
                        data: {},
                        engine,
                    })
                ).not.toThrow();
            }
        });

        it('requires data context', () => {
            expect(() =>
                templateRendererCapability.schemas.input.parse({
                    template: 'test',
                })
            ).toThrow();
        });

        it('rejects invalid engine', () => {
            expect(() =>
                templateRendererCapability.schemas.input.parse({
                    template: 'test',
                    data: {},
                    engine: 'invalid',
                })
            ).toThrow();
        });

        it('validates output with missing variables', () => {
            expect(() =>
                templateRendererCapability.schemas.output.parse({
                    success: false,
                    rendered: '',
                    engine: 'handlebars',
                    variablesUsed: ['name', 'email'],
                    missingVariables: ['email'],
                    message: 'Missing required variables',
                })
            ).not.toThrow();
=======
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'render')).toBe(true);
            expect(calls.env.some((e) => e.key === 'ENGINE' && e.value === 'handlebars')).toBe(true);
>>>>>>> theirs
        });
    });
});
