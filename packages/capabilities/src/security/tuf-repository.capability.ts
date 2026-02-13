/**
 * packages/capabilities/src/security/tuf-repository.capability.ts
 * OpenSSF TUF Repository Capability.
 * REAL Implementation: Manage TUF repositories using python-tuf.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const inputSchema = z.object({
    operation: z.enum(['init-repo', 'add-target', 'snapshot']).describe('TUF operation'),
    repoPath: z.string().describe('Path to TUF repository root'),
    targetPath: z.string().optional().describe('Path to target file to add'),
    targetName: z.string().optional().describe('Name of target in repository (defaults to basename of targetPath)'),
});

const outputSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    metadataUpdated: z.array(z.string()).optional(),
});

export type TufRepositoryInput = z.infer<typeof inputSchema>;
export type TufRepositoryOutput = z.infer<typeof outputSchema>;

export const tufRepositoryCapability: Capability<TufRepositoryInput, TufRepositoryOutput, void, void> = {
    metadata: {
        id: 'golden.security.tuf-repository',
        domain: 'security',
        version: '1.0.0',
        name: 'tufRepository',
        description: 'Manage TUF repositories for secure artifact distribution using python-tuf.',
        tags: ['security', 'tuf', 'supply-chain', 'provenance'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: z.void(),
        secrets: z.void(),
    },
    security: {
        requiredScopes: ['repo:write'],
        dataClassification: 'PUBLIC',
        networkAccess: {
            allowOutbound: [], // Local operations mostly, or pushing to remote if extended
        },
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 1, backoffCoefficient: 2 },
        errorMap: () => 'FATAL',
        costFactor: 'LOW',
    },
    aiHints: {
        exampleInput: {
            operation: 'init-repo',
            repoPath: '/tmp/repo',
        },
        exampleOutput: {
            success: true,
            message: 'Initialized TUF repository',
            metadataUpdated: ['root.json', 'targets.json', 'snapshot.json', 'timestamp.json'],
        },
        usageNotes: 'Manages TUF metadata. Requires python-tuf environment.',
    },
    factory: (dag, context, input) => {
        const d = dag as any;

        // Use python image and install tuf
        return d.container()
            .from('python:3.11-alpine')
            .withExec(['pip', 'install', 'tuf'])
            .withExec(['sh', '-c', `
                #!/bin/sh
                set -e
                
                OP="${input.operation}"
                REPO="${input.repoPath}"
                TARGET="${input.targetPath || ''}"
                TARGET_NAME="${input.targetName || ''}"
                
                # Ensure repo dir exists
                mkdir -p "$REPO"
                
                # Python script to handle TUF logic
                cat <<PY > /tmp/tuf_manager.py
import sys
import os
import json
from tuf.repository_tool import create_new_repository, load_repository

op = sys.argv[1]
repo_path = sys.argv[2]
target_path = sys.argv[3] if len(sys.argv) > 3 else None
target_name = sys.argv[4] if len(sys.argv) > 4 else None

updated = []

if op == 'init-repo':
    repository = create_new_repository(repo_path)
    repository.root.add_verification_key(public=repository.root.create_verification_key())
    repository.timestamp.add_verification_key(public=repository.timestamp.create_verification_key())
    repository.snapshot.add_verification_key(public=repository.snapshot.create_verification_key())
    repository.targets.add_verification_key(public=repository.targets.create_verification_key())
    repository.status()
    # Write metadata
    repository.writeall()
    updated = ['root.json', 'targets.json', 'snapshot.json', 'timestamp.json']
    print(json.dumps({'success': True, 'message': 'Initialized', 'metadataUpdated': updated}))

elif op == 'add-target':
    if not target_path or not os.path.exists(target_path):
        print(json.dumps({'success': False, 'message': 'Target path missing'}))
        sys.exit(0)
        
    repository = load_repository(repo_path)
    t_name = target_name or os.path.basename(target_path)
    repository.targets.add_target(target_path, t_name)
    repository.writeall()
    updated = ['targets.json', 'snapshot.json', 'timestamp.json']
    print(json.dumps({'success': True, 'message': f'Added {t_name}', 'metadataUpdated': updated}))

elif op == 'snapshot':
    repository = load_repository(repo_path)
    repository.snapshot.load_signing_key(repository.snapshot.keys[0]) # simplified
    repository.writeall()
    updated = ['snapshot.json', 'timestamp.json']
    print(json.dumps({'success': True, 'message': 'Snapshot taken', 'metadataUpdated': updated}))

else:
    print(json.dumps({'success': False, 'message': 'Unknown op'}))

PY

                python3 /tmp/tuf_manager.py "$OP" "$REPO" "$TARGET" "$TARGET_NAME"
            `]);
    },
};
