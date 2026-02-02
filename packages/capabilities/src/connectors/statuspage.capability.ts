/**
 * packages/capabilities/src/connectors/statuspage.capability.ts
 * Atlassian Statuspage Connector Capability (OCS-001 Connector Pattern)
 *
 * Manages status page incidents and component status for public-facing
 * service health communication.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
    'create-incident',      // Create new status page incident
    'update-incident',      // Update incident status/message
    'resolve-incident',     // Resolve incident
    'get-incident',         // Get incident details
    'list-incidents',       // List recent incidents
    'list-components',      // List page components
    'update-component',     // Update component status
]).describe('Statuspage operation');

const incidentStatusSchema = z.enum([
    'investigating',
    'identified',
    'monitoring',
    'resolved',
]).describe('Incident status');

const impactSchema = z.enum([
    'none',
    'minor',
    'major',
    'critical',
]).describe('Incident impact level');

const componentStatusSchema = z.enum([
    'operational',
    'degraded_performance',
    'partial_outage',
    'major_outage',
    'under_maintenance',
]).describe('Component status');

const inputSchema = z
    .object({
        operation: operationSchema,
        pageId: z.string().optional().describe('Statuspage page ID (uses config default if omitted)'),
        incidentId: z.string().optional().describe('Incident ID for update/resolve/get operations'),
        name: z.string().optional().describe('Incident name/title'),
        status: incidentStatusSchema.optional().describe('Incident status'),
        impact: impactSchema.optional().describe('Incident impact level'),
        body: z.string().optional().describe('Incident update message body'),
        componentIds: z.array(z.string()).optional().describe('Affected component IDs'),
        componentStatus: componentStatusSchema.optional().describe('Status for affected components'),
        componentId: z.string().optional().describe('Single component ID for update-component'),
        deliverNotifications: z.boolean().optional().describe('Send subscriber notifications'),
    })
    .describe('Statuspage Connector input');

const incidentSchema = z.object({
    id: z.string().describe('Incident ID'),
    name: z.string().describe('Incident name'),
    status: incidentStatusSchema.describe('Current status'),
    impact: impactSchema.describe('Impact level'),
    shortlink: z.string().describe('Short URL to incident'),
    pageId: z.string().describe('Page ID'),
    createdAt: z.string().describe('Creation timestamp'),
    updatedAt: z.string().describe('Last update timestamp'),
    resolvedAt: z.string().optional().describe('Resolution timestamp'),
});

const componentSchema = z.object({
    id: z.string().describe('Component ID'),
    name: z.string().describe('Component name'),
    status: componentStatusSchema.describe('Current status'),
    description: z.string().optional().describe('Component description'),
    position: z.number().optional().describe('Display position'),
    groupId: z.string().optional().describe('Component group ID'),
});

const outputSchema = z
    .object({
        success: z.boolean().describe('Whether the operation succeeded'),
        operation: operationSchema.describe('Operation performed'),
        incident: incidentSchema.optional().describe('Incident details'),
        incidents: z.array(incidentSchema).optional().describe('List of incidents'),
        component: componentSchema.optional().describe('Component details'),
        components: z.array(componentSchema).optional().describe('List of components'),
        message: z.string().describe('Human-readable result message'),
    })
    .describe('Statuspage Connector output');

const configSchema = z
    .object({
        pageId: z.string().optional().describe('Default Statuspage page ID'),
        baseUrl: z.string().optional().describe('API base URL (default: https://api.statuspage.io/v1)'),
    })
    .describe('Statuspage Connector configuration');

const secretsSchema = z
    .object({
        apiKey: z.string().describe('Statuspage API key'),
    })
    .describe('Statuspage Connector secrets');

export type StatuspageInput = z.infer<typeof inputSchema>;
export type StatuspageOutput = z.infer<typeof outputSchema>;
export type StatuspageConfig = z.infer<typeof configSchema>;
export type StatuspageSecrets = z.infer<typeof secretsSchema>;

export const statuspageCapability: Capability<
    StatuspageInput,
    StatuspageOutput,
    StatuspageConfig,
    StatuspageSecrets
> = {
    metadata: {
        id: 'golden.connectors.statuspage',
        version: '1.0.0',
        name: 'statuspageConnector',
        description:
            'Atlassian Statuspage connector for managing public-facing status page incidents and component status. Use for incident communication, service health updates, and customer-facing status management.',
        tags: ['connector', 'statuspage', 'atlassian', 'incidents', 'status', 'communication'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['statuspage:read', 'statuspage:write'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: ['api.statuspage.io'],
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
            operation: 'create-incident',
            name: 'API Degradation - Increased Latency',
            status: 'investigating',
            impact: 'minor',
            body: 'We are investigating reports of increased API response times.',
            componentIds: ['abc123'],
            componentStatus: 'degraded_performance',
            deliverNotifications: true,
        },
        exampleOutput: {
            success: true,
            operation: 'create-incident',
            incident: {
                id: 'inc_xyz789',
                name: 'API Degradation - Increased Latency',
                status: 'investigating',
                impact: 'minor',
                shortlink: 'https://stspg.io/xyz789',
                pageId: 'page_abc123',
                createdAt: '2024-01-15T10:30:00Z',
                updatedAt: '2024-01-15T10:30:00Z',
            },
            message: 'Incident created successfully: API Degradation - Increased Latency',
        },
        usageNotes:
            'Use create-incident to open new status page incidents. Update with status changes via update-incident. Always resolve incidents when issues are fixed. Component status updates automatically reflect on the status page.',
    },
    factory: (
        dag,
        context: CapabilityContext<StatuspageConfig, StatuspageSecrets>,
        input: StatuspageInput
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
            pageId: input.pageId ?? context.config.pageId,
            incidentId: input.incidentId,
            name: input.name,
            status: input.status,
            impact: input.impact,
            body: input.body,
            componentIds: input.componentIds,
            componentStatus: input.componentStatus,
            componentId: input.componentId,
            deliverNotifications: input.deliverNotifications ?? true,
            baseUrl: context.config.baseUrl ?? 'https://api.statuspage.io/v1',
        };

        let container = d
            .container()
            .from('curlimages/curl:latest')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload));

        if (context.secretRefs.apiKey) {
            container = container.withMountedSecret(
                '/run/secrets/api_key',
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
PAGE_ID=$(echo "$INPUT_JSON" | jq -r '.pageId // empty')
INCIDENT_ID=$(echo "$INPUT_JSON" | jq -r '.incidentId // empty')
BASE_URL=$(echo "$INPUT_JSON" | jq -r '.baseUrl')

# Read API key from secret
API_KEY=""
if [ -f /run/secrets/api_key ]; then
    API_KEY=$(cat /run/secrets/api_key | tr -d '\\n')
fi

# Common curl options
CURL_OPTS="-s -w '\\n%{http_code}' -H 'Authorization: OAuth $API_KEY' -H 'Content-Type: application/json'"

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
    create-incident)
        NAME=$(echo "$INPUT_JSON" | jq -r '.name')
        STATUS=$(echo "$INPUT_JSON" | jq -r '.status // "investigating"')
        IMPACT=$(echo "$INPUT_JSON" | jq -r '.impact // "none"')
        BODY_TEXT=$(echo "$INPUT_JSON" | jq -r '.body // ""')
        COMPONENT_IDS=$(echo "$INPUT_JSON" | jq -c '.componentIds // []')
        COMPONENT_STATUS=$(echo "$INPUT_JSON" | jq -r '.componentStatus // "degraded_performance"')
        DELIVER=$(echo "$INPUT_JSON" | jq -r '.deliverNotifications')
        
        # Build incident payload
        INCIDENT_DATA=$(jq -n \\
            --arg name "$NAME" \\
            --arg status "$STATUS" \\
            --arg impact "$IMPACT" \\
            --arg body "$BODY_TEXT" \\
            --argjson component_ids "$COMPONENT_IDS" \\
            --arg component_status "$COMPONENT_STATUS" \\
            --argjson deliver "$DELIVER" \\
            '{
                incident: {
                    name: $name,
                    status: $status,
                    impact_override: $impact,
                    body: $body,
                    component_ids: $component_ids,
                    deliver_notifications: $deliver
                }
            }')
        
        RESULT=$(make_request POST "$BASE_URL/pages/$PAGE_ID/incidents" "$INCIDENT_DATA")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
            INCIDENT=$(echo "$BODY" | jq '{
                id: .id,
                name: .name,
                status: .status,
                impact: .impact,
                shortlink: .shortlink,
                pageId: .page_id,
                createdAt: .created_at,
                updatedAt: .updated_at
            }')
            cat << EOF
{
    "success": true,
    "operation": "create-incident",
    "incident": $INCIDENT,
    "message": "Incident created successfully: $NAME"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "create-incident",
    "message": "Failed to create incident: HTTP $HTTP_CODE - $BODY"
}
EOF
        fi
        ;;
        
    update-incident)
        STATUS=$(echo "$INPUT_JSON" | jq -r '.status // empty')
        BODY_TEXT=$(echo "$INPUT_JSON" | jq -r '.body // empty')
        
        UPDATE_DATA=$(jq -n \\
            --arg status "$STATUS" \\
            --arg body "$BODY_TEXT" \\
            '{incident: {status: $status, body: $body}}')
        
        RESULT=$(make_request PATCH "$BASE_URL/pages/$PAGE_ID/incidents/$INCIDENT_ID" "$UPDATE_DATA")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            INCIDENT=$(echo "$BODY" | jq '{
                id: .id,
                name: .name,
                status: .status,
                impact: .impact,
                shortlink: .shortlink,
                pageId: .page_id,
                createdAt: .created_at,
                updatedAt: .updated_at
            }')
            cat << EOF
{
    "success": true,
    "operation": "update-incident",
    "incident": $INCIDENT,
    "message": "Incident updated successfully"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "update-incident",
    "message": "Failed to update incident: HTTP $HTTP_CODE"
}
EOF
        fi
        ;;
        
    resolve-incident)
        UPDATE_DATA='{"incident": {"status": "resolved"}}'
        
        RESULT=$(make_request PATCH "$BASE_URL/pages/$PAGE_ID/incidents/$INCIDENT_ID" "$UPDATE_DATA")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            INCIDENT=$(echo "$BODY" | jq '{
                id: .id,
                name: .name,
                status: .status,
                impact: .impact,
                shortlink: .shortlink,
                pageId: .page_id,
                createdAt: .created_at,
                updatedAt: .updated_at,
                resolvedAt: .resolved_at
            }')
            cat << EOF
{
    "success": true,
    "operation": "resolve-incident",
    "incident": $INCIDENT,
    "message": "Incident resolved successfully"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "resolve-incident",
    "message": "Failed to resolve incident: HTTP $HTTP_CODE"
}
EOF
        fi
        ;;
        
    get-incident)
        RESULT=$(make_request GET "$BASE_URL/pages/$PAGE_ID/incidents/$INCIDENT_ID" "")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            INCIDENT=$(echo "$BODY" | jq '{
                id: .id,
                name: .name,
                status: .status,
                impact: .impact,
                shortlink: .shortlink,
                pageId: .page_id,
                createdAt: .created_at,
                updatedAt: .updated_at,
                resolvedAt: .resolved_at
            }')
            cat << EOF
{
    "success": true,
    "operation": "get-incident",
    "incident": $INCIDENT,
    "message": "Incident retrieved successfully"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "get-incident",
    "message": "Failed to get incident: HTTP $HTTP_CODE"
}
EOF
        fi
        ;;
        
    list-incidents)
        RESULT=$(make_request GET "$BASE_URL/pages/$PAGE_ID/incidents?limit=25" "")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            INCIDENTS=$(echo "$BODY" | jq '[.[] | {
                id: .id,
                name: .name,
                status: .status,
                impact: .impact,
                shortlink: .shortlink,
                pageId: .page_id,
                createdAt: .created_at,
                updatedAt: .updated_at,
                resolvedAt: .resolved_at
            }]')
            COUNT=$(echo "$INCIDENTS" | jq 'length')
            cat << EOF
{
    "success": true,
    "operation": "list-incidents",
    "incidents": $INCIDENTS,
    "message": "Retrieved $COUNT incidents"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "list-incidents",
    "message": "Failed to list incidents: HTTP $HTTP_CODE"
}
EOF
        fi
        ;;
        
    list-components)
        RESULT=$(make_request GET "$BASE_URL/pages/$PAGE_ID/components" "")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            COMPONENTS=$(echo "$BODY" | jq '[.[] | {
                id: .id,
                name: .name,
                status: .status,
                description: .description,
                position: .position,
                groupId: .group_id
            }]')
            COUNT=$(echo "$COMPONENTS" | jq 'length')
            cat << EOF
{
    "success": true,
    "operation": "list-components",
    "components": $COMPONENTS,
    "message": "Retrieved $COUNT components"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "list-components",
    "message": "Failed to list components: HTTP $HTTP_CODE"
}
EOF
        fi
        ;;
        
    update-component)
        COMPONENT_ID=$(echo "$INPUT_JSON" | jq -r '.componentId')
        NEW_STATUS=$(echo "$INPUT_JSON" | jq -r '.componentStatus')
        
        UPDATE_DATA=$(jq -n --arg status "$NEW_STATUS" '{component: {status: $status}}')
        
        RESULT=$(make_request PATCH "$BASE_URL/pages/$PAGE_ID/components/$COMPONENT_ID" "$UPDATE_DATA")
        HTTP_CODE=$(echo "$RESULT" | head -1)
        BODY=$(echo "$RESULT" | tail -n +2)
        
        if [ "$HTTP_CODE" = "200" ]; then
            COMPONENT=$(echo "$BODY" | jq '{
                id: .id,
                name: .name,
                status: .status,
                description: .description,
                position: .position,
                groupId: .group_id
            }')
            cat << EOF
{
    "success": true,
    "operation": "update-component",
    "component": $COMPONENT,
    "message": "Component status updated to $NEW_STATUS"
}
EOF
        else
            cat << EOF
{
    "success": false,
    "operation": "update-component",
    "message": "Failed to update component: HTTP $HTTP_CODE"
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
