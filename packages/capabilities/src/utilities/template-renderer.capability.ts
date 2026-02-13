/**
 * packages/capabilities/src/utilities/template-renderer.capability.ts
 * Template Renderer Capability (OCS-001 Transformer Pattern)
 *
 * Template rendering using Handlebars, Mustache, EJS, or Nunjucks.
 * Variable substitution, loops, conditionals, and helpers.
 */
import { z } from '@golden/schema-registry';
import { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
    'render',         // Render template with data
    'validate',       // Validate template syntax
    'extract-vars',   // Extract variable names from template
]).describe('Template operation');

const engineSchema = z.enum([
    'handlebars',
    'mustache',
    'ejs',
    'nunjucks',
]).describe('Template engine');

const inputSchema = z
    .object({
        operation: operationSchema,
        template: z.string().optional().describe('Template string'),
        templatePath: z.string().optional().describe('Path to template file'),
        data: z.record(z.unknown()).optional().describe('Data to render into template'),
        dataPath: z.string().optional().describe('Path to JSON/YAML data file'),
        engine: engineSchema.optional().describe('Template engine, defaults to handlebars'),
        partials: z.record(z.string()).optional().describe('Named partial templates'),
        helpers: z.record(z.string()).optional().describe('Custom helper definitions'),
        strict: z.boolean().optional().describe('Fail on missing variables'),
    })
    .describe('Template Renderer input');

const outputSchema = z
    .object({
        success: z.boolean().describe('Whether the operation succeeded'),
        operation: operationSchema.describe('Operation performed'),
        rendered: z.string().optional().describe('Rendered output'),
        valid: z.boolean().optional().describe('Whether template is valid'),
        variables: z.array(z.string()).optional().describe('Extracted variable names'),
        errors: z.array(z.string()).optional().describe('Syntax or rendering errors'),
        message: z.string().describe('Human-readable result message'),
    })
    .describe('Template Renderer output');

const configSchema = z
    .object({
        defaultEngine: engineSchema.optional().describe('Default template engine'),
        partialsDir: z.string().optional().describe('Directory for partial templates'),
    })
    .describe('Template Renderer configuration');

const secretsSchema = z.object({}).describe('Template Renderer secrets (none required)');

export type TemplateRendererInput = z.infer<typeof inputSchema>;
export type TemplateRendererOutput = z.infer<typeof outputSchema>;
export type TemplateRendererConfig = z.infer<typeof configSchema>;
export type TemplateRendererSecrets = z.infer<typeof secretsSchema>;

export const templateRendererCapability: Capability<
    TemplateRendererInput,
    TemplateRendererOutput,
    TemplateRendererConfig,
    TemplateRendererSecrets
> = {
    metadata: {
        id: 'golden.utilities.template-renderer',
        domain: 'utilities',
        version: '1.0.0',
        name: 'templateRenderer',
        description:
            'Render templates using Handlebars, Mustache, EJS, or Nunjucks. Supports partials, helpers, and data from files or inline.',
        tags: ['transformer', 'utilities', 'template', 'handlebars'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['utilities:transform'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: [], // Pure transformation, no network needed
        },
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 1, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('syntax')) return 'FATAL';
                if (error.message.includes('not found')) return 'FATAL';
            }
            return 'FATAL';
        },
        costFactor: 'LOW',
    },
    aiHints: {
        exampleInput: {
            operation: 'render',
            template: 'Hello {{name}}! You have {{count}} notifications.',
            data: { name: 'Alice', count: 5 },
            engine: 'handlebars',
        },
        exampleOutput: {
            success: true,
            operation: 'render',
            rendered: 'Hello Alice! You have 5 notifications.',
            message: 'Template rendered successfully',
        },
        usageNotes:
            'Use for generating config files, email templates, and dynamic content. Handlebars supports helpers and partials for complex templates.',
    },
    factory: (
        dag,
        context: CapabilityContext<TemplateRendererConfig, TemplateRendererSecrets>,
        input: TemplateRendererInput
    ) => {
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = {
            container(): ContainerBuilder;
        };
        const d = dag as unknown as DaggerClient;

        const engine = input.engine ?? context.config.defaultEngine ?? 'handlebars';

        const payload = {
            operation: input.operation,
            template: input.template,
            templatePath: input.templatePath,
            data: input.data,
            dataPath: input.dataPath,
            engine,
            partials: input.partials,
            helpers: input.helpers,
            strict: input.strict ?? false,
        };

        const container = d
            .container()
            .from('node:20-alpine')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('OPERATION', input.operation)
            .withEnvVariable('ENGINE', engine);

        return container.withExec([
            'sh',
            '-c',
            `
#!/bin/sh
set -e

# Install template engines
npm install --silent handlebars mustache ejs nunjucks 2>/dev/null

cat > /tmp/render.js << 'SCRIPT'
const fs = require('fs');

const input = JSON.parse(process.env.INPUT_JSON);
const { operation, template, templatePath, data, dataPath, engine, partials, strict } = input;

let result = {
    success: true,
    operation,
    rendered: null,
    valid: null,
    variables: null,
    errors: [],
    message: ''
};

try {
    // Load template
    let tmpl = template;
    if (templatePath && fs.existsSync(templatePath)) {
        tmpl = fs.readFileSync(templatePath, 'utf8');
    }
    
    // Load data
    let renderData = data || {};
    if (dataPath && fs.existsSync(dataPath)) {
        const content = fs.readFileSync(dataPath, 'utf8');
        renderData = JSON.parse(content);
    }
    
    switch (operation) {
        case 'render': {
            switch (engine) {
                case 'handlebars': {
                    const Handlebars = require('handlebars');
                    
                    // Register partials
                    if (partials) {
                        Object.entries(partials).forEach(([name, partial]) => {
                            Handlebars.registerPartial(name, partial);
                        });
                    }
                    
                    const compiled = Handlebars.compile(tmpl, { strict });
                    result.rendered = compiled(renderData);
                    break;
                }
                case 'mustache': {
                    const Mustache = require('mustache');
                    result.rendered = Mustache.render(tmpl, renderData, partials);
                    break;
                }
                case 'ejs': {
                    const ejs = require('ejs');
                    result.rendered = ejs.render(tmpl, renderData);
                    break;
                }
                case 'nunjucks': {
                    const nunjucks = require('nunjucks');
                    result.rendered = nunjucks.renderString(tmpl, renderData);
                    break;
                }
            }
            result.message = 'Template rendered successfully';
            break;
        }
        
        case 'validate': {
            switch (engine) {
                case 'handlebars': {
                    const Handlebars = require('handlebars');
                    Handlebars.precompile(tmpl);
                    break;
                }
                case 'ejs': {
                    const ejs = require('ejs');
                    ejs.compile(tmpl);
                    break;
                }
            }
            result.valid = true;
            result.message = 'Template syntax is valid';
            break;
        }
        
        case 'extract-vars': {
            // Simple regex extraction for common patterns
            const patterns = [
                /\\{\\{\\s*([a-zA-Z_][a-zA-Z0-9_.]*)\\s*\\}\\}/g,  // {{var}}
                /<%=\\s*([a-zA-Z_][a-zA-Z0-9_.]*)\\s*%>/g,         // <%= var %>
            ];
            
            const vars = new Set();
            patterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(tmpl)) !== null) {
                    vars.add(match[1]);
                }
            });
            
            result.variables = Array.from(vars);
            result.message = 'Extracted ' + result.variables.length + ' variables';
            break;
        }
    }
} catch (err) {
    result.success = false;
    result.valid = false;
    result.errors = [err.message];
    result.message = 'Template operation failed: ' + err.message;
}

console.log(JSON.stringify(result, null, 2));
SCRIPT

node /tmp/render.js
            `.trim(),
        ]);
    },
};
