/**
 * packages/capabilities/src/connectors/confluence.capability.ts
 * Confluence Cloud Connector Capability (OCS-001 Connector Pattern)
 *
 * Manages Confluence pages, spaces, and content for documentation automation,
 * post-mortem generation, and knowledge base management.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
    'create-page',          // Create new page
    'update-page',          // Update existing page
    'get-page',             // Get page by ID
    'search-pages',         // Search via CQL
    'get-page-by-title',    // Get page by space + title
    'add-attachment',       // Attach file to page
    'get-space',            // Get space info
    'list-spaces',          // List available spaces
]).describe('Confluence operation');

const bodyFormatSchema = z.enum([
    'storage',              // Confluence storage format (XHTML)
    'wiki',                 // Wiki markup
    'atlas_doc_format',     // Atlassian Document Format (JSON)
    'markdown',             // Markdown (will be converted)
]).describe('Content body format');

const inputSchema = z
    .object({
        operation: operationSchema,
        spaceKey: z.string().optional().describe('Space key (e.g., "ENG", "OPS")'),
        pageId: z.string().optional().describe('Page ID for get/update operations'),
        title: z.string().optional().describe('Page title'),
        parentId: z.string().optional().describe('Parent page ID for hierarchy'),
        body: z.string().optional().describe('Page content'),
        bodyFormat: bodyFormatSchema.optional().describe('Format of the body content'),
        cql: z.string().optional().describe('Confluence Query Language for search'),
        limit: z.number().int().positive().optional().describe('Max results for search/list'),
        attachmentPath: z.string().optional().describe('File path for attachment'),
        attachmentName: z.string().optional().describe('Attachment filename'),
        attachmentComment: z.string().optional().describe('Comment for attachment'),
        version: z.number().int().positive().optional().describe('Page version for updates (required for update-page)'),
        labels: z.array(z.string()).optional().describe('Labels to apply to page'),
    })
    .describe('Confluence Connector input');

const pageSchema = z.object({
    id: z.string().describe('Page ID'),
    title: z.string().describe('Page title'),
    spaceKey: z.string().describe('Space key'),
    version: z.number().describe('Current version number'),
    webUrl: z.string().describe('Web URL to view page'),
    createdAt: z.string().describe('Creation timestamp'),
    updatedAt: z.string().describe('Last update timestamp'),
    createdBy: z.string().optional().describe('Creator username'),
    status: z.string().describe('Page status (current, draft, etc.)'),
});

const spaceSchema = z.object({
    id: z.string().describe('Space ID'),
    key: z.string().describe('Space key'),
    name: z.string().describe('Space name'),
    type: z.string().describe('Space type'),
    homepageId: z.string().optional().describe('Homepage ID'),
});

const attachmentSchema = z.object({
    id: z.string().describe('Attachment ID'),
    title: z.string().describe('Attachment filename'),
    mediaType: z.string().describe('MIME type'),
    fileSize: z.number().describe('File size in bytes'),
    downloadUrl: z.string().describe('Download URL'),
});

const outputSchema = z
    .object({
        success: z.boolean().describe('Whether the operation succeeded'),
        operation: operationSchema.describe('Operation performed'),
        page: pageSchema.optional().describe('Page details'),
        pages: z.array(pageSchema).optional().describe('List of pages'),
        space: spaceSchema.optional().describe('Space details'),
        spaces: z.array(spaceSchema).optional().describe('List of spaces'),
        attachment: attachmentSchema.optional().describe('Attachment details'),
        message: z.string().describe('Human-readable result message'),
    })
    .describe('Confluence Connector output');

const configSchema = z
    .object({
        cloudId: z.string().describe('Atlassian Cloud ID'),
        siteUrl: z.string().describe('Site URL (e.g., https://yoursite.atlassian.net)'),
        defaultSpaceKey: z.string().optional().describe('Default space key'),
    })
    .describe('Confluence Connector configuration');

const secretsSchema = z
    .object({
        email: z.string().describe('Atlassian account email'),
        apiToken: z.string().describe('Atlassian API token'),
    })
    .describe('Confluence Connector secrets');

export type ConfluenceInput = z.infer<typeof inputSchema>;
export type ConfluenceOutput = z.infer<typeof outputSchema>;
export type ConfluenceConfig = z.infer<typeof configSchema>;
export type ConfluenceSecrets = z.infer<typeof secretsSchema>;

export const confluenceCapability: Capability<
    ConfluenceInput,
    ConfluenceOutput,
    ConfluenceConfig,
    ConfluenceSecrets
> = {
    metadata: {
        id: 'golden.connectors.confluence',
        domain: 'connectors',
        version: '1.0.0',
        name: 'confluenceConnector',
        description:
            'Confluence Cloud connector for managing pages, spaces, and content. Use for post-mortem documentation, runbook management, knowledge base automation, and collaborative documentation workflows.',
        tags: ['connector', 'connectors', 'confluence', 'atlassian', 'documentation', 'wiki', 'knowledge-base'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['confluence:read', 'confluence:write'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: ['api.atlassian.com', '*.atlassian.net'],
        },
    },
    operations: {
        isIdempotent: false, // create/update operations have side effects
        retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 2, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                const msg = error.message.toLowerCase();
                if (msg.includes('401') || msg.includes('unauthorized')) return 'AUTH_FAILURE';
                if (msg.includes('403') || msg.includes('forbidden')) return 'AUTH_FAILURE';
                if (msg.includes('404') || msg.includes('not found')) return 'FATAL';
                if (msg.includes('409') || msg.includes('conflict')) return 'RETRYABLE'; // Version conflict
                if (msg.includes('429') || msg.includes('rate limit')) return 'RATE_LIMIT';
                if (msg.includes('5')) return 'RETRYABLE'; // 5xx errors
                if (msg.includes('timeout') || msg.includes('network')) return 'RETRYABLE';
            }
            return 'FATAL';
        },
        costFactor: 'LOW',
    },
    aiHints: {
        exampleInput: {
            operation: 'create-page',
            spaceKey: 'OPS',
            title: 'Post-Mortem: API Outage 2024-01-15',
            body: '<h1>Incident Summary</h1><p>On January 15th, 2024, our API experienced a 45-minute outage...</p>',
            bodyFormat: 'storage',
            parentId: '12345678',
            labels: ['post-mortem', 'incident', 'api'],
        },
        exampleOutput: {
            success: true,
            operation: 'create-page',
            page: {
                id: '98765432',
                title: 'Post-Mortem: API Outage 2024-01-15',
                spaceKey: 'OPS',
                version: 1,
                webUrl: 'https://mysite.atlassian.net/wiki/spaces/OPS/pages/98765432',
                createdAt: '2024-01-16T10:00:00Z',
                updatedAt: '2024-01-16T10:00:00Z',
                createdBy: 'automation@example.com',
                status: 'current',
            },
            message: 'Page created successfully: Post-Mortem: API Outage 2024-01-15',
        },
        usageNotes:
            'Use storage format for rich content with templates. Provide version number when updating pages to handle concurrent edits. Use CQL for powerful searches across spaces.',
    },
    factory: (
        dag,
        context: CapabilityContext<ConfluenceConfig, ConfluenceSecrets>,
        input: ConfluenceInput
    ) => {
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withMountedSecret(path: string, secret: unknown): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = { container(): ContainerBuilder };
        const d = dag as unknown as DaggerClient;

        const payload = {
            operation: input.operation,
            cloudId: context.config.cloudId,
            siteUrl: context.config.siteUrl,
            spaceKey: input.spaceKey ?? context.config.defaultSpaceKey,
            pageId: input.pageId,
            title: input.title,
            parentId: input.parentId,
            body: input.body,
            bodyFormat: input.bodyFormat ?? 'storage',
            cql: input.cql,
            limit: input.limit ?? 25,
            version: input.version,
            labels: input.labels,
            attachmentPath: input.attachmentPath,
            attachmentName: input.attachmentName,
            attachmentComment: input.attachmentComment,
        };

        let container = d
            .container()
            .from('curlimages/curl:latest')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload));

        if (context.secretRefs.email) {
            container = container.withMountedSecret(
                '/run/secrets/email',
                context.secretRefs.email
            );
        }
        if (context.secretRefs.apiToken) {
            container = container.withMountedSecret(
                '/run/secrets/api_token',
                context.secretRefs.apiToken
            );
        }

        return container.withExec([
            'sh',
            '-c',
            `
#!/bin/sh
set -e

INPUT_JSON="\${INPUT_JSON}"
OPERATION=$(echo "$INPUT_JSON" | jq -r '.operation')
CLOUD_ID=$(echo "$INPUT_JSON" | jq -r '.cloudId')
SITE_URL=$(echo "$INPUT_JSON" | jq -r '.siteUrl')
SPACE_KEY=$(echo "$INPUT_JSON" | jq -r '.spaceKey // empty')
PAGE_ID=$(echo "$INPUT_JSON" | jq -r '.pageId // empty')

# Read credentials
EMAIL=""
API_TOKEN=""
if [ -f /run/secrets/email ]; then
    EMAIL=$(cat /run/secrets/email | tr -d '\\n')
fi
if [ -f /run/secrets/api_token ]; then
    API_TOKEN=$(cat /run/secrets/api_token | tr -d '\\n')
fi

# Base URL for Confluence Cloud REST API v2
BASE_URL="https://api.atlassian.com/ex/confluence/$CLOUD_ID/wiki/api/v2"
LEGACY_BASE_URL="https://api.atlassian.com/ex/confluence/$CLOUD_ID/wiki/rest/api"

# Common curl options with Basic auth
AUTH=$(echo -n "$EMAIL:$API_TOKEN" | base64)
CURL_OPTS="-s -w '\\n%{http_code}' -H 'Authorization: Basic $AUTH' -H 'Content-Type: application/json'"

make_request() {
    METHOD="$1"
    URL="$2"
    DATA="$3"
    
    if [ -n "$DATA" ]; then
        RESPONSE=$(eval curl $CURL_OPTS -X "$METHOD" -d "'$DATA'" "'$URL'")
    else
        RESPONSE=$(eval curl $CURL_OPTS -X "$METHOD" "'$URL'")
    fi
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    echo "$HTTP_CODE"
    echo "$BODY"
}

case "$OPERATION" in
    create-page)
        TITLE=$(echo "$INPUT_JSON" | jq -r '.title')
        BODY_CONTENT=$(echo "$INPUT_JSON" | jq -r '.body // ""')
        BODY_FORMAT=$(echo "$INPUT_JSON" | jq -r '.bodyFormat // "storage"')
        PARENT_ID=$(echo "$INPUT_JSON" | jq -r '.parentId // empty')
        
        # Build page creation payload (v2 API)
        CREATE_DATA=$(jq -n \\
            --arg spaceId "$SPACE_KEY" \\
            --arg title "$TITLE" \\
            --arg body "$BODY_CONTENT" \\
            --arg format "$BODY_FORMAT" \\
            --arg parentId "$PARENT_ID" \\
            '{
                spaceId: $spaceId,
                title: $title,
                body: {
                    representation: $format,
                    value: $body
                }
            } + (if $parentId != "" then {parentId: $parentId} else {} end)')
        
        RESULT=$(make_request POST "$BASE_URL/pages" "$CREATE_DATA")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
            PAGE=$(echo "$BODY" | jq --arg siteUrl "$SITE_URL" '{
                id: .id,
                title: .title,
                spaceKey: .spaceId,
                version: .version.number,
                webUrl: ($siteUrl + "/_links/webui"),
                createdAt: .createdAt,
                updatedAt: .version.createdAt,
                status: .status
            }')
            cat << EOF
{
    "success": true,
    "operation": "create-page",
    "page": $PAGE,
    "message": "Page created successfully: $TITLE"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "create-page",
    "message": "Failed to create page: HTTP $HTTP_CODE - $BODY"
}
EOF
        fi
        ;;
        
    update-page)
        TITLE=$(echo "$INPUT_JSON" | jq -r '.title // empty')
        BODY_CONTENT=$(echo "$INPUT_JSON" | jq -r '.body // empty')
        BODY_FORMAT=$(echo "$INPUT_JSON" | jq -r '.bodyFormat // "storage"')
        VERSION=$(echo "$INPUT_JSON" | jq -r '.version')
        
        # Build update payload
        UPDATE_DATA=$(jq -n \\
            --arg id "$PAGE_ID" \\
            --arg title "$TITLE" \\
            --arg body "$BODY_CONTENT" \\
            --arg format "$BODY_FORMAT" \\
            --argjson version "$VERSION" \\
            '{
                id: $id,
                status: "current",
                title: $title,
                body: {
                    representation: $format,
                    value: $body
                },
                version: {
                    number: ($version + 1),
                    message: "Updated via automation"
                }
            }')
        
        RESULT=$(make_request PUT "$BASE_URL/pages/$PAGE_ID" "$UPDATE_DATA")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            PAGE=$(echo "$BODY" | jq --arg siteUrl "$SITE_URL" '{
                id: .id,
                title: .title,
                spaceKey: .spaceId,
                version: .version.number,
                webUrl: ($siteUrl + "/_links/webui"),
                createdAt: .createdAt,
                updatedAt: .version.createdAt,
                status: .status
            }')
            cat << EOF
{
    "success": true,
    "operation": "update-page",
    "page": $PAGE,
    "message": "Page updated successfully"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "update-page",
    "message": "Failed to update page: HTTP $HTTP_CODE"
}
EOF
        fi
        ;;
        
    get-page)
        RESULT=$(make_request GET "$BASE_URL/pages/$PAGE_ID?body-format=storage" "")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            PAGE=$(echo "$BODY" | jq --arg siteUrl "$SITE_URL" '{
                id: .id,
                title: .title,
                spaceKey: .spaceId,
                version: .version.number,
                webUrl: ($siteUrl + "/_links/webui"),
                createdAt: .createdAt,
                updatedAt: .version.createdAt,
                status: .status
            }')
            cat << EOF
{
    "success": true,
    "operation": "get-page",
    "page": $PAGE,
    "message": "Page retrieved successfully"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "get-page",
    "message": "Failed to get page: HTTP $HTTP_CODE"
}
EOF
        fi
        ;;
        
    search-pages)
        CQL=$(echo "$INPUT_JSON" | jq -r '.cql')
        LIMIT=$(echo "$INPUT_JSON" | jq -r '.limit // 25')
        
        # URL encode CQL
        ENCODED_CQL=$(echo "$CQL" | jq -sRr @uri)
        
        RESULT=$(make_request GET "$LEGACY_BASE_URL/content/search?cql=$ENCODED_CQL&limit=$LIMIT" "")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            PAGES=$(echo "$BODY" | jq --arg siteUrl "$SITE_URL" '[.results[] | {
                id: .id,
                title: .title,
                spaceKey: .space.key,
                version: .version.number,
                webUrl: ($siteUrl + ._links.webui),
                createdAt: .history.createdDate,
                updatedAt: .version.when,
                status: .status
            }]')
            COUNT=$(echo "$PAGES" | jq 'length')
            cat << EOF
{
    "success": true,
    "operation": "search-pages",
    "pages": $PAGES,
    "message": "Found $COUNT pages"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "search-pages",
    "message": "Failed to search pages: HTTP $HTTP_CODE"
}
EOF
        fi
        ;;
        
    get-page-by-title)
        TITLE=$(echo "$INPUT_JSON" | jq -r '.title')
        ENCODED_TITLE=$(echo "$TITLE" | jq -sRr @uri)
        
        RESULT=$(make_request GET "$LEGACY_BASE_URL/content?spaceKey=$SPACE_KEY&title=$ENCODED_TITLE&expand=version,space" "")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            PAGE=$(echo "$BODY" | jq --arg siteUrl "$SITE_URL" '.results[0] | {
                id: .id,
                title: .title,
                spaceKey: .space.key,
                version: .version.number,
                webUrl: ($siteUrl + ._links.webui),
                createdAt: .history.createdDate,
                updatedAt: .version.when,
                status: .status
            }')
            if [ "$PAGE" = "null" ]; then
                cat << EOF
{
    "success": false,
    "operation": "get-page-by-title",
    "message": "Page not found: $TITLE in space $SPACE_KEY"
}
EOF
            else
                cat << EOF
{
    "success": true,
    "operation": "get-page-by-title",
    "page": $PAGE,
    "message": "Page found: $TITLE"
}
EOF
            fi
        else
            cat << EOF
{
    "success": false,
    "operation": "get-page-by-title",
    "message": "Failed to get page: HTTP $HTTP_CODE"
}
EOF
        fi
        ;;
        
    get-space)
        RESULT=$(make_request GET "$BASE_URL/spaces/$SPACE_KEY" "")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            SPACE=$(echo "$BODY" | jq '{
                id: .id,
                key: .key,
                name: .name,
                type: .type,
                homepageId: .homepageId
            }')
            cat << EOF
{
    "success": true,
    "operation": "get-space",
    "space": $SPACE,
    "message": "Space retrieved: $SPACE_KEY"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "get-space",
    "message": "Failed to get space: HTTP $HTTP_CODE"
}
EOF
        fi
        ;;
        
    list-spaces)
        LIMIT=$(echo "$INPUT_JSON" | jq -r '.limit // 25')
        
        RESULT=$(make_request GET "$BASE_URL/spaces?limit=$LIMIT" "")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            SPACES=$(echo "$BODY" | jq '[.results[] | {
                id: .id,
                key: .key,
                name: .name,
                type: .type,
                homepageId: .homepageId
            }]')
            COUNT=$(echo "$SPACES" | jq 'length')
            cat << EOF
{
    "success": true,
    "operation": "list-spaces",
    "spaces": $SPACES,
    "message": "Retrieved $COUNT spaces"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "list-spaces",
    "message": "Failed to list spaces: HTTP $HTTP_CODE"
}
EOF
        fi
        ;;
        
    add-attachment)
        # Note: File attachments require special handling - this is a placeholder
        cat << EOF
{
    "success": false,
    "operation": "add-attachment",
    "message": "Attachment upload requires file system access - use with mounted volumes"
}
EOF
        ;;
        
    *)
        cat << EOF
{
    "success": false,
    "operation": "$OPERATION",
    "message": "Unknown operation: $OPERATION"
}
EOF
        ;;
esac
            `.trim(),
        ]);
    },
};
