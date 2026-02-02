/**
 * packages/capabilities/src/commanders/kubectl.capability.ts
 * Kubectl Capability - Kubernetes operations via CLI.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum(['apply', 'get', 'delete', 'logs', 'exec']).describe('Kubectl operation');

const inputSchema = z.object({
    operation: operationSchema,
    manifest: z.string().optional().describe('Manifest content (for apply) or resource type (for get/delete)'),
    resourceName: z.string().optional().describe('Name of resource (for get/delete/logs/exec)'),
    namespace: z.string().optional().describe('Kubernetes namespace'),
    context: z.string().optional().describe('Kubeconfig context'),
    command: z.array(z.string()).optional().describe('Command to execute (for exec)'),
    container: z.string().optional().describe('Container name (for logs/exec)'),
    flags: z.array(z.string()).optional().describe('Additional flags'),
});

const outputSchema = z.object({
    success: z.boolean(),
    stdout: z.string(),
    stderr: z.string(),
    data: z.unknown().optional().describe('Parsed JSON output if available'),
});

export type KubectlInput = z.infer<typeof inputSchema>;
export type KubectlOutput = z.infer<typeof outputSchema>;

export const kubectlCapability: Capability<KubectlInput, KubectlOutput, void, void> = {
    metadata: {
        id: 'golden.commanders.kubectl',
        version: '1.0.0',
        name: 'kubectl',
        description: 'Execute Kubernetes operations using kubectl CLI.',
        tags: ['kubernetes', 'k8s', 'infrastructure', 'cli'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: z.void(),
        secrets: z.void(),
    },
    security: {
        requiredScopes: ['k8s:operator', 'k8s:admin'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: ['*'], // Needs access to K8s API servers
        },
    },
    operations: {
        isIdempotent: false,
        retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 2, backoffCoefficient: 2 },
        errorMap: (err) => {
            if (err instanceof Error && err.message.includes('connection refused')) return 'RETRYABLE';
            return 'FATAL';
        },
        costFactor: 'MEDIUM',
    },
    aiHints: {
        exampleInput: {
            operation: 'get',
            manifest: 'pods',
            namespace: 'default',
        },
        exampleOutput: {
            success: true,
            stdout: '...',
            stderr: '',
            data: { items: [] },
        },
        usageNotes: 'Uses bitnami/kubectl. Kubeconfig must be mounted or configured in the environment.',
    },
    factory: (dag, context, input) => {
        const d = dag as any; // Dagger client

        // Base container
        let ctr = d.container()
            .from('bitnami/kubectl:latest');

        // Mount kubeconfig if available in secrets/env - assuming standardized mount path for now
        // In a real scenario, we might mount a secret from context.secretRefs.kubeconfig
        // For this implementation, we assume the runner environment provides access or we mock it.

        const args = ['kubectl', input.operation]; // e.g. kubectl get

        // Construct arguments based on operation
        if (input.operation === 'apply') {
            // Write manifest to file
            if (input.manifest) {
                ctr = ctr.withNewFile('/tmp/manifest.yaml', input.manifest);
                args.push('-f', '/tmp/manifest.yaml');
            } else {
                throw new Error('Manifest content required for apply operation');
            }
        } else if (input.operation === 'exec') {
            if (input.resourceName) {
                args.push(input.resourceName);
            }
            if (input.command && input.command.length > 0) {
                args.push('--', ...input.command);
            }
        } else {
            // Get, Delete, Logs
            if (input.manifest && input.operation !== 'logs') {
                args.push(input.manifest); // e.g. kubectl get pods
            }
            if (input.resourceName) {
                args.push(input.resourceName);
            }
        }

        // Common flags
        if (input.namespace) args.push('-n', input.namespace);
        if (input.context) args.push('--context', input.context);
        if (input.container) args.push('-c', input.container);
        if (input.flags) args.push(...input.flags);

        // Force JSON output for 'get' to enable parsing, if not overridden
        if (input.operation === 'get' && !input.flags?.some(f => f.includes('-o') || f.includes('--output'))) {
            args.push('-o', 'json');
        }

        // Execute
        return ctr.withExec(args);
    },
};
