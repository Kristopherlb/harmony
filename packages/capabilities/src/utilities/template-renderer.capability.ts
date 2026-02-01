/**
 * packages/capabilities/src/utilities/template-renderer.capability.ts
<<<<<<< ours
 * Template Renderer Capability (OCS-001 Utility Pattern)
 *
 * Renders templates using Handlebars/Mustache syntax with data contexts.
=======
 * Template Renderer Capability (OCS-001 Transformer Pattern)
 *
 * Template rendering using Handlebars/Mustache syntax.
 * Variable substitution, loops, conditionals, and helpers.
>>>>>>> theirs
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

<<<<<<< ours
=======
const operationSchema = z.enum([
    'render',         // Render template with data
    'validate',       // Validate template syntax
    'extract-vars',   // Extract variable names from template
]).describe('Template operation');

>>>>>>> theirs
const engineSchema = z.enum([
    'handlebars',
    'mustache',
    'ejs',
<<<<<<< ours
]).describe('Template engine to use');

const inputSchema = z
    .object({
        template: z.string().optional().describe('Template string'),
        templatePath: z.string().optional().describe('Path to template file'),
        data: z.record(z.unknown()).describe('Data context for rendering'),
        outputPath: z.string().optional().describe('Output file path'),
        engine: engineSchema.optional().describe('Template engine (default: handlebars)'),
        partials: z.record(z.string()).optional().describe('Named partial templates'),
        helpers: z.record(z.string()).optional().describe('Custom helper function names'),
        strict: z.boolean().optional().describe('Strict mode - fail on missing variables'),
=======
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
>>>>>>> theirs
    })
    .describe('Template Renderer input');

const outputSchema = z
    .object({
<<<<<<< ours
        success: z.boolean().describe('Whether rendering succeeded'),
        rendered: z.string().describe('Rendered output'),
        outputPath: z.string().optional().describe('Output file path if written'),
        engine: engineSchema.describe('Engine used'),
        variablesUsed: z.array(z.string()).optional().describe('Variables found in template'),
        missingVariables: z.array(z.string()).optional().describe('Variables not provided'),
=======
        success: z.boolean().describe('Whether the operation succeeded'),
        operation: operationSchema.describe('Operation performed'),
        rendered: z.string().optional().describe('Rendered output'),
        valid: z.boolean().optional().describe('Whether template is valid'),
        variables: z.array(z.string()).optional().describe('Extracted variable names'),
        errors: z.array(z.string()).optional().describe('Syntax or rendering errors'),
>>>>>>> theirs
        message: z.string().describe('Human-readable result message'),
    })
    .describe('Template Renderer output');

const configSchema = z
    .object({
        defaultEngine: engineSchema.optional().describe('Default template engine'),
<<<<<<< ours
        templatesDir: z.string().optional().describe('Base directory for template files'),
    })
    .describe('Template Renderer configuration');

const secretsSchema = z
    .object({})
    .describe('Template Renderer secrets');
=======
        partialsDir: z.string().optional().describe('Directory for partial templates'),
    })
    .describe('Template Renderer configuration');

const secretsSchema = z.object({}).describe('Template Renderer secrets (none required)');
>>>>>>> theirs

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
        version: '1.0.0',
        name: 'templateRenderer',
        description:
<<<<<<< ours
            'Template rendering utility supporting Handlebars, Mustache, and EJS. Render configuration files, documents, and code from templates.',
        tags: ['utility', 'template', 'rendering'],
=======
            'Render templates using Handlebars, Mustache, EJS, or Nunjucks. Supports partials, helpers, and data from files or inline.',
        tags: ['transformer', 'utilities', 'template', 'handlebars'],
>>>>>>> theirs
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
<<<<<<< ours
        requiredScopes: ['utility:template'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: [],
=======
        requiredScopes: ['utilities:transform'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: [], // Pure transformation, no network needed
>>>>>>> theirs
        },
    },
    operations: {
        isIdempotent: true,
<<<<<<< ours
        retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 0, backoffCoefficient: 1 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('missing')) return 'FATAL';
=======
        retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 1, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('syntax')) return 'FATAL';
                if (error.message.includes('not found')) return 'FATAL';
>>>>>>> theirs
            }
            return 'FATAL';
        },
        costFactor: 'LOW',
    },
    aiHints: {
        exampleInput: {
<<<<<<< ours
            template: 'Hello, {{name}}! Welcome to {{project}}.',
            data: { name: 'Developer', project: 'Harmony' },
=======
            operation: 'render',
            template: 'Hello {{name}}! You have {{count}} notifications.',
            data: { name: 'Alice', count: 5 },
>>>>>>> theirs
            engine: 'handlebars',
        },
        exampleOutput: {
            success: true,
<<<<<<< ours
            rendered: 'Hello, Developer! Welcome to Harmony.',
            engine: 'handlebars',
            variablesUsed: ['name', 'project'],
            message: 'Template rendered successfully',
        },
        usageNotes:
            'Use for generating config files, Kubernetes manifests, documentation, etc. Handlebars supports helpers and partials. Use strict mode to catch missing variables.',
=======
            operation: 'render',
            rendered: 'Hello Alice! You have 5 notifications.',
            message: 'Template rendered successfully',
        },
        usageNotes:
            'Use for generating config files, email templates, and dynamic content. Handlebars supports helpers and partials for complex templates.',
>>>>>>> theirs
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
<<<<<<< ours
        type DaggerClient = { container(): ContainerBuilder };
=======
        type DaggerClient = {
            container(): ContainerBuilder;
        };
>>>>>>> theirs
        const d = dag as unknown as DaggerClient;

        const engine = input.engine ?? context.config.defaultEngine ?? 'handlebars';

<<<<<<< ours
        let container = d
            .container()
            .from('node:20-alpine')
            .withEnvVariable('ENGINE', engine)
            .withEnvVariable('DATA', JSON.stringify(input.data));

        if (input.template) {
            container = container.withEnvVariable('TEMPLATE', input.template);
        }
        if (input.templatePath) {
            container = container.withEnvVariable('TEMPLATE_PATH', input.templatePath);
        }
        if (input.outputPath) {
            container = container.withEnvVariable('OUTPUT_PATH', input.outputPath);
        }
        if (input.partials) {
            container = container.withEnvVariable('PARTIALS', JSON.stringify(input.partials));
        }
        if (input.strict) {
            container = container.withEnvVariable('STRICT', 'true');
        }
=======
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
>>>>>>> theirs

        return container.withExec([
            'sh',
            '-c',
            `
#!/bin/sh
set -e

<<<<<<< ours
npm install --silent handlebars mustache ejs 2>/dev/null >/dev/null

ENGINE="$ENGINE"
SUCCESS=true
MESSAGE=""
RENDERED=""
OUTPUT_PATH_OUT=""
VARIABLES_USED="[]"
MISSING_VARS="[]"

# Create renderer script
cat > /tmp/render.js << 'SCRIPT'
const fs = require('fs');

const engine = process.env.ENGINE || 'handlebars';
const data = JSON.parse(process.env.DATA || '{}');
const template = process.env.TEMPLATE || (process.env.TEMPLATE_PATH ? fs.readFileSync(process.env.TEMPLATE_PATH, 'utf8') : '');
const strict = process.env.STRICT === 'true';
const partials = process.env.PARTIALS ? JSON.parse(process.env.PARTIALS) : {};

let rendered = '';
let variablesUsed = [];
let missingVars = [];

// Extract variables from template
const varPattern = /\\{\\{\\s*([\\w.]+)\\s*\\}\\}/g;
let match;
while ((match = varPattern.exec(template)) !== null) {
  if (!variablesUsed.includes(match[1])) {
    variablesUsed.push(match[1]);
  }
}

// Check for missing variables
for (const v of variablesUsed) {
  const parts = v.split('.');
  let current = data;
  for (const part of parts) {
    if (current === undefined || current === null || !(part in current)) {
      if (!missingVars.includes(v)) missingVars.push(v);
      break;
    }
    current = current[part];
  }
}

if (strict && missingVars.length > 0) {
  console.log(JSON.stringify({
    success: false,
    rendered: '',
    engine,
    variablesUsed,
    missingVariables: missingVars,
    message: 'Missing required variables: ' + missingVars.join(', ')
  }));
  process.exit(0);
}

try {
  switch (engine) {
    case 'handlebars':
      const Handlebars = require('handlebars');
      for (const [name, content] of Object.entries(partials)) {
        Handlebars.registerPartial(name, content);
      }
      const hbsTemplate = Handlebars.compile(template, { strict });
      rendered = hbsTemplate(data);
      break;
      
    case 'mustache':
      const Mustache = require('mustache');
      rendered = Mustache.render(template, data, partials);
      break;
      
    case 'ejs':
      const ejs = require('ejs');
      rendered = ejs.render(template, data);
      break;
  }
  
  if (process.env.OUTPUT_PATH) {
    fs.writeFileSync(process.env.OUTPUT_PATH, rendered);
  }
  
  console.log(JSON.stringify({
    success: true,
    rendered,
    outputPath: process.env.OUTPUT_PATH || '',
    engine,
    variablesUsed,
    missingVariables: missingVars,
    message: 'Template rendered successfully'
  }));
} catch (err) {
  console.log(JSON.stringify({
    success: false,
    rendered: '',
    engine,
    variablesUsed,
    missingVariables: missingVars,
    message: err.message
  }));
}
=======
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
>>>>>>> theirs
SCRIPT

node /tmp/render.js
        `.trim(),
        ]);
    },
};
