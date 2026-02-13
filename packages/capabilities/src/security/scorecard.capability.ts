/**
 * packages/capabilities/src/security/scorecard.capability.ts
 * OpenSSF Scorecard Capability (OCS-001 Commander Pattern)
 *
 * Automated security risk assessment for open source projects using OpenSSF Scorecard.
 * Evaluates repositories against security best practices.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const checkSchema = z.object({
    name: z.string().describe('Check name'),
    score: z.number().min(-1).max(10).describe('Score (0-10, -1 if check failed)'),
    reason: z.string().describe('Reason for the score'),
    details: z.array(z.string()).optional().describe('Detailed findings'),
    documentation: z.object({
        short: z.string().optional(),
        url: z.string().optional(),
    }).optional().describe('Documentation links'),
});

const inputSchema = z
    .object({
        repository: z.string().describe('Repository to analyze (owner/repo or full URL)'),
        commit: z.string().optional().describe('Specific commit SHA to analyze'),
        checks: z.array(z.string()).optional().describe('Specific checks to run'),
        format: z.enum(['json', 'sarif', 'default']).optional().describe('Output format'),
    })
    .describe('Scorecard input');

const outputSchema = z
    .object({
        repository: z.string().describe('Repository analyzed'),
        commit: z.string().optional().describe('Commit SHA analyzed'),
        score: z.number().describe('Overall aggregate score (0-10)'),
        checks: z.array(checkSchema).describe('Individual check results'),
        date: z.string().describe('Analysis date'),
        version: z.string().describe('Scorecard version used'),
    })
    .describe('Scorecard output');

const configSchema = z
    .object({
        minScore: z.number().min(0).max(10).optional().describe('Minimum acceptable score'),
        requiredChecks: z.array(z.string()).optional().describe('Checks that must pass'),
    })
    .describe('Scorecard configuration');

const secretsSchema = z
    .object({
        githubToken: z.string().optional().describe('GitHub token for API access'),
    })
    .describe('Scorecard secrets');

export type ScorecardInput = z.infer<typeof inputSchema>;
export type ScorecardOutput = z.infer<typeof outputSchema>;
export type ScorecardConfig = z.infer<typeof configSchema>;
export type ScorecardSecrets = z.infer<typeof secretsSchema>;

export const scorecardCapability: Capability<
    ScorecardInput,
    ScorecardOutput,
    ScorecardConfig,
    ScorecardSecrets
> = {
    metadata: {
        id: 'golden.security.scorecard',
        domain: 'security',
        version: '1.0.0',
        name: 'scorecard',
        description:
            'OpenSSF Scorecard for automated security risk assessment. Evaluates repositories against security best practices like branch protection, dependency updates, and code review.',
        tags: ['commander', 'security', 'openssf', 'scoring', 'best-practices'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['security:scan'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: [
                'api.github.com',
                '*.githubusercontent.com',
                'api.securityscorecards.dev', // Scorecard API
            ],
        },
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 2, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('not found')) return 'FATAL';
                if (error.message.includes('unauthorized')) return 'FATAL';
                if (error.message.includes('rate limit')) return 'RETRYABLE';
                if (error.message.includes('timeout')) return 'RETRYABLE';
            }
            return 'FATAL';
        },
        costFactor: 'MEDIUM',
    },
    aiHints: {
        exampleInput: {
            repository: 'ossf/scorecard',
            format: 'json',
        },
        exampleOutput: {
            repository: 'github.com/ossf/scorecard',
            commit: 'abc123def456',
            score: 8.5,
            checks: [
                {
                    name: 'Branch-Protection',
                    score: 9,
                    reason: 'branch protection is enabled',
                    documentation: {
                        short: 'Determines if the default branch is protected',
                        url: 'https://github.com/ossf/scorecard/blob/main/docs/checks.md#branch-protection',
                    },
                },
                {
                    name: 'Code-Review',
                    score: 10,
                    reason: 'all changesets reviewed',
                },
                {
                    name: 'Dependency-Update-Tool',
                    score: 10,
                    reason: 'update tool detected',
                },
            ],
            date: '2024-01-15T10:30:00Z',
            version: 'v4.13.1',
        },
        usageNotes:
            'Use for evaluating third-party dependencies or your own repositories. Higher scores indicate better security practices. Common checks: Branch-Protection, Code-Review, CII-Best-Practices, Dangerous-Workflow, Dependency-Update-Tool, Maintained, Pinned-Dependencies, SAST, Security-Policy, Signed-Releases, Token-Permissions, Vulnerabilities.',
    },
    factory: (
        dag,
        context: CapabilityContext<ScorecardConfig, ScorecardSecrets>,
        input: ScorecardInput
    ) => {
        type DaggerSecret = unknown;
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withMountedSecret(path: string, secret: DaggerSecret): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = { container(): ContainerBuilder };
        const d = dag as unknown as DaggerClient;

        const payload = {
            repository: input.repository,
            commit: input.commit,
            checks: input.checks,
            format: input.format ?? 'json',
        };

        let container = d
            .container()
            .from('gcr.io/openssf/scorecard:latest')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('REPOSITORY', input.repository);

        // Mount GitHub token if provided
        if (context.secretRefs.githubToken && typeof (container as Record<string, unknown>).withMountedSecret === 'function') {
            container = container.withMountedSecret('/run/secrets/github_token', context.secretRefs.githubToken as unknown as DaggerSecret);
        }

        return container.withExec([
            'sh',
            '-c',
            `
#!/bin/sh
set -e

REPOSITORY="${input.repository}"
FORMAT="${input.format ?? 'json'}"

# Normalize repository URL
if echo "$REPOSITORY" | grep -q "^http"; then
  REPO_URL="$REPOSITORY"
else
  REPO_URL="https://github.com/$REPOSITORY"
fi

# Set GitHub token if available
if [ -f /run/secrets/github_token ]; then
  export GITHUB_AUTH_TOKEN=$(cat /run/secrets/github_token)
fi

# Build scorecard command
CMD="scorecard --repo=$REPO_URL --format=json"

${input.commit ? `CMD="$CMD --commit=${input.commit}"` : ''}
${input.checks?.length ? `CMD="$CMD --checks=${input.checks.join(',')}"` : ''}

# Run scorecard
$CMD > /tmp/scorecard.json 2>/tmp/scorecard.log || true

# Parse and format output
if [ -f /tmp/scorecard.json ] && [ -s /tmp/scorecard.json ]; then
  SCORE=$(cat /tmp/scorecard.json | jq '.score // 0')
  CHECKS=$(cat /tmp/scorecard.json | jq '[.checks[]? | {
    name: .name,
    score: .score,
    reason: .reason,
    details: .details,
    documentation: .documentation
  }]')
  COMMIT=$(cat /tmp/scorecard.json | jq -r '.repo.commit // "unknown"')
  VERSION=$(cat /tmp/scorecard.json | jq -r '.scorecard.version // "unknown"')
  DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
else
  SCORE=0
  CHECKS="[]"
  COMMIT="unknown"
  VERSION="unknown"
  DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
fi

cat <<EOF
{
  "repository": "$REPO_URL",
  "commit": "$COMMIT",
  "score": $SCORE,
  "checks": $CHECKS,
  "date": "$DATE",
  "version": "$VERSION"
}
EOF
      `.trim(),
        ]);
    },
};
