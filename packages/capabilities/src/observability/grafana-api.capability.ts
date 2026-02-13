/**
 * packages/capabilities/src/observability/grafana-api.capability.ts
 * Grafana API Capability (OCS-001 Commander Pattern)
 *
 * Manages Grafana dashboards, snapshots, and folders for observability automation.
 * Use for incident dashboards, automated dashboard provisioning, and snapshot archival.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
    'create-dashboard',     // Create dashboard from JSON model
    'update-dashboard',     // Update existing dashboard
    'get-dashboard',        // Get dashboard by UID
    'delete-dashboard',     // Delete dashboard by UID
    'snapshot-dashboard',   // Create snapshot (point-in-time capture)
    'search-dashboards',    // Search dashboards
    'create-folder',        // Create folder for organizing
    'list-folders',         // List folders
    'get-datasources',      // List configured datasources
]).describe('Grafana API operation');

const inputSchema = z
    .object({
        operation: operationSchema,
        dashboardUid: z.string().optional().describe('Dashboard UID for get/update/delete/snapshot'),
        dashboardJson: z.record(z.unknown()).optional().describe('Dashboard JSON model for create/update'),
        title: z.string().optional().describe('Dashboard or folder title'),
        folderUid: z.string().optional().describe('Target folder UID'),
        folderId: z.number().int().optional().describe('Target folder ID'),
        tags: z.array(z.string()).optional().describe('Dashboard tags for filtering'),
        query: z.string().optional().describe('Search query for dashboards'),
        overwrite: z.boolean().optional().describe('Overwrite existing dashboard on create'),
        message: z.string().optional().describe('Commit message for dashboard save'),
        snapshotName: z.string().optional().describe('Name for snapshot'),
        snapshotExpires: z.number().int().positive().optional().describe('Snapshot expiry in seconds'),
        snapshotExternal: z.boolean().optional().describe('Enable external sharing for snapshot'),
    })
    .describe('Grafana API input');

const dashboardSchema = z.object({
    uid: z.string().describe('Dashboard UID'),
    id: z.number().describe('Dashboard ID'),
    title: z.string().describe('Dashboard title'),
    url: z.string().describe('Dashboard URL path'),
    version: z.number().describe('Dashboard version'),
    folderUid: z.string().optional().describe('Folder UID'),
    folderTitle: z.string().optional().describe('Folder title'),
    tags: z.array(z.string()).optional().describe('Dashboard tags'),
});

const snapshotSchema = z.object({
    key: z.string().describe('Snapshot key'),
    url: z.string().describe('Snapshot URL'),
    deleteKey: z.string().describe('Key to delete snapshot'),
    deleteUrl: z.string().optional().describe('URL to delete snapshot'),
    expiresAt: z.string().optional().describe('Expiration timestamp'),
});

const folderSchema = z.object({
    uid: z.string().describe('Folder UID'),
    id: z.number().describe('Folder ID'),
    title: z.string().describe('Folder title'),
    url: z.string().optional().describe('Folder URL'),
});

const datasourceSchema = z.object({
    id: z.number().describe('Datasource ID'),
    uid: z.string().describe('Datasource UID'),
    name: z.string().describe('Datasource name'),
    type: z.string().describe('Datasource type (prometheus, loki, etc.)'),
    url: z.string().optional().describe('Datasource URL'),
    isDefault: z.boolean().optional().describe('Is default datasource'),
});

const outputSchema = z
    .object({
        success: z.boolean().describe('Whether the operation succeeded'),
        operation: operationSchema.describe('Operation performed'),
        dashboard: dashboardSchema.optional().describe('Dashboard details'),
        dashboards: z.array(dashboardSchema).optional().describe('List of dashboards'),
        snapshot: snapshotSchema.optional().describe('Snapshot details'),
        folder: folderSchema.optional().describe('Folder details'),
        folders: z.array(folderSchema).optional().describe('List of folders'),
        datasources: z.array(datasourceSchema).optional().describe('List of datasources'),
        message: z.string().describe('Human-readable result message'),
    })
    .describe('Grafana API output');

const configSchema = z
    .object({
        grafanaUrl: z.string().url().describe('Grafana instance URL'),
        orgId: z.number().int().positive().optional().describe('Organization ID (default: 1)'),
        defaultFolderUid: z.string().optional().describe('Default folder UID for new dashboards'),
    })
    .describe('Grafana API configuration');

const secretsSchema = z
    .object({
        apiKey: z.string().optional().describe('Grafana API key (legacy)'),
        serviceAccountToken: z.string().optional().describe('Service account token (preferred)'),
    })
    .describe('Grafana API secrets');

export type GrafanaApiInput = z.infer<typeof inputSchema>;
export type GrafanaApiOutput = z.infer<typeof outputSchema>;
export type GrafanaApiConfig = z.infer<typeof configSchema>;
export type GrafanaApiSecrets = z.infer<typeof secretsSchema>;

export const grafanaApiCapability: Capability<
    GrafanaApiInput,
    GrafanaApiOutput,
    GrafanaApiConfig,
    GrafanaApiSecrets
> = {
    metadata: {
        id: 'golden.observability.grafana-api',
        domain: 'observability',
        version: '1.0.0',
        name: 'grafanaApi',
        description:
            'Grafana HTTP API connector for managing dashboards, snapshots, and folders. Use for incident dashboard creation, automated provisioning, dashboard archival, and observability automation.',
        tags: ['commander', 'grafana', 'observability', 'dashboards', 'monitoring'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['grafana:read', 'grafana:write'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            // Grafana URL is configurable - deployment should restrict
            allowOutbound: ['*'],
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
                if (msg.includes('412') || msg.includes('precondition')) return 'RETRYABLE'; // Version conflict
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
            operation: 'create-dashboard',
            title: 'Incident Dashboard - INC-2024-001',
            dashboardJson: {
                title: 'Incident Dashboard - INC-2024-001',
                tags: ['incident', 'auto-generated'],
                panels: [
                    {
                        id: 1,
                        title: 'Request Rate',
                        type: 'timeseries',
                        gridPos: { x: 0, y: 0, w: 12, h: 8 },
                    },
                    {
                        id: 2,
                        title: 'Error Rate',
                        type: 'timeseries',
                        gridPos: { x: 12, y: 0, w: 12, h: 8 },
                    },
                ],
            },
            folderUid: 'incidents',
            tags: ['incident', 'INC-2024-001'],
        },
        exampleOutput: {
            success: true,
            operation: 'create-dashboard',
            dashboard: {
                uid: 'inc-2024-001',
                id: 42,
                title: 'Incident Dashboard - INC-2024-001',
                url: '/d/inc-2024-001/incident-dashboard-inc-2024-001',
                version: 1,
                folderUid: 'incidents',
                folderTitle: 'Incidents',
                tags: ['incident', 'INC-2024-001'],
            },
            message: 'Dashboard created successfully: Incident Dashboard - INC-2024-001',
        },
        usageNotes:
            'Use service account tokens over API keys for better security. Create snapshots before deleting dashboards for archival. Use folders to organize incident dashboards separately from operational ones.',
    },
    factory: (
        dag,
        context: CapabilityContext<GrafanaApiConfig, GrafanaApiSecrets>,
        input: GrafanaApiInput
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
            grafanaUrl: context.config.grafanaUrl,
            orgId: context.config.orgId ?? 1,
            dashboardUid: input.dashboardUid,
            dashboardJson: input.dashboardJson,
            title: input.title,
            folderUid: input.folderUid ?? context.config.defaultFolderUid,
            folderId: input.folderId,
            tags: input.tags,
            query: input.query,
            overwrite: input.overwrite ?? false,
            message: input.message ?? 'Updated via automation',
            snapshotName: input.snapshotName,
            snapshotExpires: input.snapshotExpires ?? 3600, // 1 hour default
            snapshotExternal: input.snapshotExternal ?? false,
        };

        let container = d
            .container()
            .from('curlimages/curl:latest')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload));

        // Mount auth token (prefer service account token over API key)
        if (context.secretRefs.serviceAccountToken) {
            container = container.withMountedSecret(
                '/run/secrets/token',
                context.secretRefs.serviceAccountToken
            );
        } else if (context.secretRefs.apiKey) {
            container = container.withMountedSecret(
                '/run/secrets/token',
                context.secretRefs.apiKey
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
GRAFANA_URL=$(echo "$INPUT_JSON" | jq -r '.grafanaUrl')
ORG_ID=$(echo "$INPUT_JSON" | jq -r '.orgId')

# Read auth token
TOKEN=""
if [ -f /run/secrets/token ]; then
    TOKEN=$(cat /run/secrets/token | tr -d '\\n')
fi

# Common curl options
CURL_OPTS="-s -w '\\n%{http_code}' -H 'Authorization: Bearer $TOKEN' -H 'Content-Type: application/json' -H 'X-Grafana-Org-Id: $ORG_ID'"

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
    create-dashboard)
        DASHBOARD_JSON=$(echo "$INPUT_JSON" | jq '.dashboardJson')
        FOLDER_UID=$(echo "$INPUT_JSON" | jq -r '.folderUid // empty')
        FOLDER_ID=$(echo "$INPUT_JSON" | jq -r '.folderId // empty')
        OVERWRITE=$(echo "$INPUT_JSON" | jq -r '.overwrite')
        MESSAGE=$(echo "$INPUT_JSON" | jq -r '.message')
        
        # Build request payload
        CREATE_DATA=$(jq -n \\
            --argjson dashboard "$DASHBOARD_JSON" \\
            --arg folderUid "$FOLDER_UID" \\
            --argjson overwrite "$OVERWRITE" \\
            --arg message "$MESSAGE" \\
            '{
                dashboard: $dashboard,
                overwrite: $overwrite,
                message: $message
            } + (if $folderUid != "" then {folderUid: $folderUid} else {} end)')
        
        RESULT=$(make_request POST "$GRAFANA_URL/api/dashboards/db" "$CREATE_DATA")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            DASHBOARD=$(echo "$BODY" | jq '{
                uid: .uid,
                id: .id,
                title: .slug,
                url: .url,
                version: .version
            }')
            TITLE=$(echo "$DASHBOARD_JSON" | jq -r '.title // "Dashboard"')
            cat << EOF
{
    "success": true,
    "operation": "create-dashboard",
    "dashboard": $DASHBOARD,
    "message": "Dashboard created successfully: $TITLE"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "create-dashboard",
    "message": "Failed to create dashboard: HTTP $HTTP_CODE - $BODY"
}
EOF
        fi
        ;;
        
    update-dashboard)
        DASHBOARD_UID=$(echo "$INPUT_JSON" | jq -r '.dashboardUid')
        DASHBOARD_JSON=$(echo "$INPUT_JSON" | jq '.dashboardJson')
        OVERWRITE=$(echo "$INPUT_JSON" | jq -r '.overwrite // true')
        MESSAGE=$(echo "$INPUT_JSON" | jq -r '.message')
        
        # Add UID to dashboard JSON
        DASHBOARD_JSON=$(echo "$DASHBOARD_JSON" | jq --arg uid "$DASHBOARD_UID" '. + {uid: $uid}')
        
        UPDATE_DATA=$(jq -n \\
            --argjson dashboard "$DASHBOARD_JSON" \\
            --argjson overwrite "$OVERWRITE" \\
            --arg message "$MESSAGE" \\
            '{
                dashboard: $dashboard,
                overwrite: $overwrite,
                message: $message
            }')
        
        RESULT=$(make_request POST "$GRAFANA_URL/api/dashboards/db" "$UPDATE_DATA")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            DASHBOARD=$(echo "$BODY" | jq '{
                uid: .uid,
                id: .id,
                title: .slug,
                url: .url,
                version: .version
            }')
            cat << EOF
{
    "success": true,
    "operation": "update-dashboard",
    "dashboard": $DASHBOARD,
    "message": "Dashboard updated successfully"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "update-dashboard",
    "message": "Failed to update dashboard: HTTP $HTTP_CODE"
}
EOF
        fi
        ;;
        
    get-dashboard)
        DASHBOARD_UID=$(echo "$INPUT_JSON" | jq -r '.dashboardUid')
        
        RESULT=$(make_request GET "$GRAFANA_URL/api/dashboards/uid/$DASHBOARD_UID" "")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            DASHBOARD=$(echo "$BODY" | jq '{
                uid: .dashboard.uid,
                id: .dashboard.id,
                title: .dashboard.title,
                url: .meta.url,
                version: .dashboard.version,
                folderUid: .meta.folderUid,
                folderTitle: .meta.folderTitle,
                tags: .dashboard.tags
            }')
            cat << EOF
{
    "success": true,
    "operation": "get-dashboard",
    "dashboard": $DASHBOARD,
    "message": "Dashboard retrieved successfully"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "get-dashboard",
    "message": "Failed to get dashboard: HTTP $HTTP_CODE"
}
EOF
        fi
        ;;
        
    delete-dashboard)
        DASHBOARD_UID=$(echo "$INPUT_JSON" | jq -r '.dashboardUid')
        
        RESULT=$(make_request DELETE "$GRAFANA_URL/api/dashboards/uid/$DASHBOARD_UID" "")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            cat << EOF
{
    "success": true,
    "operation": "delete-dashboard",
    "message": "Dashboard deleted successfully: $DASHBOARD_UID"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "delete-dashboard",
    "message": "Failed to delete dashboard: HTTP $HTTP_CODE"
}
EOF
        fi
        ;;
        
    snapshot-dashboard)
        DASHBOARD_UID=$(echo "$INPUT_JSON" | jq -r '.dashboardUid')
        SNAPSHOT_NAME=$(echo "$INPUT_JSON" | jq -r '.snapshotName // empty')
        SNAPSHOT_EXPIRES=$(echo "$INPUT_JSON" | jq -r '.snapshotExpires')
        SNAPSHOT_EXTERNAL=$(echo "$INPUT_JSON" | jq -r '.snapshotExternal')
        
        # First get the dashboard
        DASH_RESULT=$(make_request GET "$GRAFANA_URL/api/dashboards/uid/$DASHBOARD_UID" "")
        DASH_HTTP=$(echo "$DASH_RESULT" | head -1)
        DASH_BODY=$(echo "$DASH_RESULT" | tail -n +2)
        
        if [ "$DASH_HTTP" != "200" ]; then
            cat << EOF
{
    "success": false,
    "operation": "snapshot-dashboard",
    "message": "Failed to get dashboard for snapshot: HTTP $DASH_HTTP"
}
EOF
            exit 0
        fi
        
        DASHBOARD_DATA=$(echo "$DASH_BODY" | jq '.dashboard')
        
        # Create snapshot
        SNAPSHOT_DATA=$(jq -n \\
            --argjson dashboard "$DASHBOARD_DATA" \\
            --arg name "$SNAPSHOT_NAME" \\
            --argjson expires "$SNAPSHOT_EXPIRES" \\
            --argjson external "$SNAPSHOT_EXTERNAL" \\
            '{
                dashboard: $dashboard,
                expires: $expires,
                external: $external
            } + (if $name != "" then {name: $name} else {} end)')
        
        RESULT=$(make_request POST "$GRAFANA_URL/api/snapshots" "$SNAPSHOT_DATA")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            SNAPSHOT=$(echo "$BODY" | jq '{
                key: .key,
                url: .url,
                deleteKey: .deleteKey,
                deleteUrl: .deleteUrl
            }')
            cat << EOF
{
    "success": true,
    "operation": "snapshot-dashboard",
    "snapshot": $SNAPSHOT,
    "message": "Snapshot created successfully"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "snapshot-dashboard",
    "message": "Failed to create snapshot: HTTP $HTTP_CODE"
}
EOF
        fi
        ;;
        
    search-dashboards)
        QUERY=$(echo "$INPUT_JSON" | jq -r '.query // empty')
        TAGS=$(echo "$INPUT_JSON" | jq -r '.tags // [] | map("tag=" + .) | join("&")')
        FOLDER_UID=$(echo "$INPUT_JSON" | jq -r '.folderUid // empty')
        
        URL="$GRAFANA_URL/api/search?type=dash-db"
        [ -n "$QUERY" ] && URL="$URL&query=$QUERY"
        [ -n "$TAGS" ] && URL="$URL&$TAGS"
        [ -n "$FOLDER_UID" ] && URL="$URL&folderUIDs=$FOLDER_UID"
        
        RESULT=$(make_request GET "$URL" "")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            DASHBOARDS=$(echo "$BODY" | jq '[.[] | {
                uid: .uid,
                id: .id,
                title: .title,
                url: .url,
                folderUid: .folderUid,
                folderTitle: .folderTitle,
                tags: .tags
            }]')
            COUNT=$(echo "$DASHBOARDS" | jq 'length')
            cat << EOF
{
    "success": true,
    "operation": "search-dashboards",
    "dashboards": $DASHBOARDS,
    "message": "Found $COUNT dashboards"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "search-dashboards",
    "message": "Failed to search dashboards: HTTP $HTTP_CODE"
}
EOF
        fi
        ;;
        
    create-folder)
        TITLE=$(echo "$INPUT_JSON" | jq -r '.title')
        
        FOLDER_DATA=$(jq -n --arg title "$TITLE" '{title: $title}')
        
        RESULT=$(make_request POST "$GRAFANA_URL/api/folders" "$FOLDER_DATA")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            FOLDER=$(echo "$BODY" | jq '{
                uid: .uid,
                id: .id,
                title: .title,
                url: .url
            }')
            cat << EOF
{
    "success": true,
    "operation": "create-folder",
    "folder": $FOLDER,
    "message": "Folder created successfully: $TITLE"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "create-folder",
    "message": "Failed to create folder: HTTP $HTTP_CODE"
}
EOF
        fi
        ;;
        
    list-folders)
        RESULT=$(make_request GET "$GRAFANA_URL/api/folders" "")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            FOLDERS=$(echo "$BODY" | jq '[.[] | {
                uid: .uid,
                id: .id,
                title: .title,
                url: .url
            }]')
            COUNT=$(echo "$FOLDERS" | jq 'length')
            cat << EOF
{
    "success": true,
    "operation": "list-folders",
    "folders": $FOLDERS,
    "message": "Retrieved $COUNT folders"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "list-folders",
    "message": "Failed to list folders: HTTP $HTTP_CODE"
}
EOF
        fi
        ;;
        
    get-datasources)
        RESULT=$(make_request GET "$GRAFANA_URL/api/datasources" "")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            DATASOURCES=$(echo "$BODY" | jq '[.[] | {
                id: .id,
                uid: .uid,
                name: .name,
                type: .type,
                url: .url,
                isDefault: .isDefault
            }]')
            COUNT=$(echo "$DATASOURCES" | jq 'length')
            cat << EOF
{
    "success": true,
    "operation": "get-datasources",
    "datasources": $DATASOURCES,
    "message": "Retrieved $COUNT datasources"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "get-datasources",
    "message": "Failed to get datasources: HTTP $HTTP_CODE"
}
EOF
        fi
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
