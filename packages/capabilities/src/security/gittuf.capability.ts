/**
 * packages/capabilities/src/security/gittuf.capability.ts
 * Gittuf Capability - Security layer for Git repositories using TUF.
 * REAL Implementation: Installs and runs gittuf to verify policies.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const inputSchema = z.object({
    operation: z.enum(['verify-ref', 'policy-check']).describe('Gittuf operation'),
    repositoryUrl: z.string().describe('Git repository URL'),
    ref: z.string().optional().describe('Git reference (branch/tag) to verify'),
});

const outputSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    result: z.unknown().optional(),
});

export type GittufInput = z.infer<typeof inputSchema>;
export type GittufOutput = z.infer<typeof outputSchema>;

export const gittufCapability: Capability<GittufInput, GittufOutput, void, void> = {
    metadata: {
        id: 'golden.security.gittuf',
        version: '1.0.0',
        name: 'gittuf',
        description: 'Security layer for Git repositories using The Update Framework (TUF).',
        tags: ['security', 'git', 'supply-chain', 'provenance'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: z.void(),
        secrets: z.void(),
    },
    security: {
        requiredScopes: ['security:read'],
        dataClassification: 'PUBLIC',
        networkAccess: {
            allowOutbound: ['github.com', 'bitbucket.org', 'gitlab.com', '*'],
        },
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 1, backoffCoefficient: 2 },
        errorMap: () => 'FATAL',
        costFactor: 'MEDIUM', // fetching repo + installing tool
    },
    aiHints: {
        exampleInput: {
            operation: 'verify-ref',
            repositoryUrl: 'https://github.com/gittuf/gittuf',
            ref: 'main',
        },
        exampleOutput: {
            success: true,
            message: 'Verified',
        },
        usageNotes: 'Clone repo and verify RSL/policies. Requires internet access.',
    },
    factory: (dag, context, input) => {
        const d = dag as any;

        // 1. Setup container with git and install gittuf
        // Using alpine based standard git image to ensure git is present
        // and using curl/tar to install gittuf binary
        return d.container()
            .from('alpine/git:latest')
            .withExec(['apk', 'add', '--no-cache', 'curl', 'tar', 'jq'])
            .withExec(['sh', '-c', `
                curl -L -o gittuf.tar.gz https://github.com/gittuf/gittuf/releases/latest/download/gittuf_0.1.0_linux_amd64.tar.gz && \
                tar -xzf gittuf.tar.gz && \
                mv gittuf /usr/local/bin/ && \
                rm gittuf.tar.gz
            `])
            // 2. Clone Repository
            .withExec(['git', 'clone', input.repositoryUrl, '/repo'])
            .withWorkdir('/repo')
            // 3. Perform Operation
            .withExec(['sh', '-c', `
                #!/bin/sh
                set -e
                OP="${input.operation}"
                REF="${input.ref || 'HEAD'}"
                
                SUCCESS=true
                MESSAGE=""
                
                if [ "$OP" = "verify-ref" ]; then
                    if gittuf verify-ref "$REF" 2>/tmp/log; then
                        MESSAGE="Reference $REF verified successfully"
                    else
                        SUCCESS=false
                        MESSAGE="Verification failed for $REF: $(cat /tmp/log)"
                    fi
                elif [ "$OP" = "policy-check" ]; then
                     # Fallback if verify-ref isn't enough, just an example op
                     if gittuf verify-ref "$REF" 2>/tmp/log; then
                        MESSAGE="Policy check passed"
                     else
                        SUCCESS=false
                        MESSAGE="Policy violation: $(cat /tmp/log)"
                     fi
                else
                    SUCCESS=false
                    MESSAGE="Unknown op"
                fi
                
                # Output
                cat <<EOF
                {
                    "success": $SUCCESS,
                    "message": "$(echo "$MESSAGE" | tr -d '"')",
                    "result": {} 
                }
                EOF
            `]);
    },
};
