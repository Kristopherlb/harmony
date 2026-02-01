/**
 * packages/capabilities/src/connectors/pagerduty.capability.ts
 * PagerDuty Connector Capability (OCS-001 Commander Pattern)
 *
 * PagerDuty connector for incident management and on-call operations.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
    'create-incident',    // Create new incident
    'resolve-incident',   // Resolve an incident
    'acknowledge',        // Acknowledge an incident
    'add-note',           // Add note to incident
    'get-incident',       // Get incident details
    'list-incidents',     // List incidents
    'get-oncall',         // Get on-call schedule
    'trigger-event',      // Send event via Events API v2
]).describe('PagerDuty operation');

const urgencySchema = z.enum(['high', 'low']).describe('Incident urgency');
const severitySchema = z.enum(['critical', 'error', 'warning', 'info']).describe('Event severity');

const inputSchema = z
    .object({
        operation: operationSchema,
        incidentId: z.string().optional().describe('Incident ID for operations on existing incidents'),
        title: z.string().optional().describe('Incident title'),
        description: z.string().optional().describe('Incident description'),
        serviceId: z.string().optional().describe('PagerDuty service ID'),
        urgency: urgencySchema.optional().describe('Incident urgency'),
        escalationPolicyId: z.string().optional().describe('Escalation policy ID'),
        note: z.string().optional().describe('Note content for add-note'),
        dedupKey: z.string().optional().describe('Deduplication key for events'),
        severity: severitySchema.optional().describe('Event severity for trigger-event'),
        source: z.string().optional().describe('Event source'),
        component: z.string().optional().describe('Component that triggered event'),
        customDetails: z.record(z.unknown()).optional().describe('Custom event details'),
        scheduleId: z.string().optional().describe('Schedule ID for on-call lookup'),
    })
    .describe('PagerDuty Connector input');

const incidentSchema = z.object({
    id: z.string().describe('Incident ID'),
    title: z.string().describe('Incident title'),
    status: z.enum(['triggered', 'acknowledged', 'resolved']).describe('Incident status'),
    urgency: urgencySchema.describe('Incident urgency'),
    service: z.object({
        id: z.string(),
        name: z.string(),
    }).describe('Service info'),
    createdAt: z.string().describe('Creation timestamp'),
    htmlUrl: z.string().describe('Incident URL'),
});

const outputSchema = z
    .object({
        success: z.boolean().describe('Whether the operation succeeded'),
        operation: operationSchema.describe('Operation performed'),
        incident: incidentSchema.optional().describe('Incident details'),
        incidents: z.array(incidentSchema).optional().describe('List of incidents'),
        eventId: z.string().optional().describe('Event ID from Events API'),
        dedupKey: z.string().optional().describe('Deduplication key'),
        oncall: z.array(z.object({
            user: z.object({
                id: z.string(),
                name: z.string(),
                email: z.string(),
            }),
            escalationLevel: z.number(),
            start: z.string(),
            end: z.string(),
        })).optional().describe('On-call users'),
        message: z.string().describe('Human-readable result message'),
    })
    .describe('PagerDuty Connector output');

const configSchema = z
    .object({
        subdomain: z.string().optional().describe('PagerDuty subdomain'),
        defaultServiceId: z.string().optional().describe('Default service ID'),
        defaultEscalationPolicyId: z.string().optional().describe('Default escalation policy'),
    })
    .describe('PagerDuty Connector configuration');

const secretsSchema = z
    .object({
        apiToken: z.string().optional().describe('PagerDuty API token'),
        routingKey: z.string().optional().describe('Events API v2 routing key'),
    })
    .describe('PagerDuty Connector secrets');

export type PagerDutyInput = z.infer<typeof inputSchema>;
export type PagerDutyOutput = z.infer<typeof outputSchema>;
export type PagerDutyConfig = z.infer<typeof configSchema>;
export type PagerDutySecrets = z.infer<typeof secretsSchema>;

export const pagerdutyCapability: Capability<
    PagerDutyInput,
    PagerDutyOutput,
    PagerDutyConfig,
    PagerDutySecrets
> = {
    metadata: {
        id: 'golden.connectors.pagerduty',
        version: '1.0.0',
        name: 'pagerduty',
        description:
            'PagerDuty connector for incident management. Create, acknowledge, and resolve incidents. Trigger events and query on-call schedules.',
        tags: ['commander', 'connectors', 'pagerduty', 'incidents', 'oncall'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['pagerduty:write'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: [
                'api.pagerduty.com',
                'events.pagerduty.com',
            ],
        },
    },
    operations: {
        isIdempotent: false,
        retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 2, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('rate limit')) return 'RETRYABLE';
                if (error.message.includes('timeout')) return 'RETRYABLE';
                if (error.message.includes('unauthorized')) return 'FATAL';
                if (error.message.includes('not found')) return 'FATAL';
            }
            return 'FATAL';
        },
        costFactor: 'LOW',
    },
    aiHints: {
        exampleInput: {
            operation: 'create-incident',
            title: 'High CPU on harmony-worker-prod-1',
            description: 'CPU usage exceeded 90% for 5 minutes',
            serviceId: 'P1234ABC',
            urgency: 'high',
        },
        exampleOutput: {
            success: true,
            operation: 'create-incident',
            incident: {
                id: 'Q1234ABC',
                title: 'High CPU on harmony-worker-prod-1',
                status: 'triggered',
                urgency: 'high',
                service: { id: 'P1234ABC', name: 'Harmony Production' },
                createdAt: '2024-01-15T10:30:00Z',
                htmlUrl: 'https://acme.pagerduty.com/incidents/Q1234ABC',
            },
            message: 'Incident created successfully',
        },
        usageNotes:
            'Use create-incident for manual incident creation. Use trigger-event with Events API v2 for automated alerting with deduplication.',
    },
    factory: (
        dag,
        context: CapabilityContext<PagerDutyConfig, PagerDutySecrets>,
        input: PagerDutyInput
    ) => {
        type DaggerSecret = unknown;
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withMountedSecret(path: string, secret: DaggerSecret): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = {
            container(): ContainerBuilder;
        };
        const d = dag as unknown as DaggerClient;

        const serviceId = input.serviceId ?? context.config.defaultServiceId;
        const escalationPolicyId = input.escalationPolicyId ?? context.config.defaultEscalationPolicyId;

        const payload = {
            operation: input.operation,
            incidentId: input.incidentId,
            title: input.title,
            description: input.description,
            serviceId,
            urgency: input.urgency ?? 'high',
            escalationPolicyId,
            note: input.note,
            dedupKey: input.dedupKey,
            severity: input.severity ?? 'error',
            source: input.source,
            component: input.component,
            customDetails: input.customDetails,
            scheduleId: input.scheduleId,
        };

        let container = d
            .container()
            .from('curlimages/curl:latest')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('OPERATION', input.operation);

        if (context.secretRefs.apiToken) {
            container = container.withMountedSecret(
                '/run/secrets/api_token',
                context.secretRefs.apiToken as unknown as DaggerSecret
            );
        }
        if (context.secretRefs.routingKey) {
            container = container.withMountedSecret(
                '/run/secrets/routing_key',
                context.secretRefs.routingKey as unknown as DaggerSecret
            );
        }

        return container.withExec([
            'sh',
            '-c',
            `
#!/bin/sh
set -e

apk add --no-cache jq >/dev/null 2>&1

OPERATION="${input.operation}"
API_TOKEN=""
ROUTING_KEY=""

if [ -f /run/secrets/api_token ]; then
  API_TOKEN=$(cat /run/secrets/api_token)
fi
if [ -f /run/secrets/routing_key ]; then
  ROUTING_KEY=$(cat /run/secrets/routing_key)
fi

API_URL="https://api.pagerduty.com"
EVENTS_URL="https://events.pagerduty.com/v2/enqueue"

SUCCESS=true
MESSAGE=""
INCIDENT=""
INCIDENTS="[]"
EVENT_ID=""
DEDUP_KEY=""
ONCALL="[]"

api_call() {
  local method="$1"
  local endpoint="$2"
  local data="$3"
  
  if [ -n "$data" ]; then
    curl -s -X "$method" "$API_URL$endpoint" \\
      -H "Authorization: Token token=$API_TOKEN" \\
      -H "Content-Type: application/json" \\
      -d "$data"
  else
    curl -s -X "$method" "$API_URL$endpoint" \\
      -H "Authorization: Token token=$API_TOKEN" \\
      -H "Content-Type: application/json"
  fi
}

case "$OPERATION" in
  create-incident)
    DATA='{"incident":{"type":"incident","title":"${input.title ?? 'Incident'}","service":{"id":"${serviceId ?? ''}","type":"service_reference"},"urgency":"${input.urgency ?? 'high'}","body":{"type":"incident_body","details":"${input.description ?? ''}"}}}'
    RESPONSE=$(api_call POST "/incidents" "$DATA")
    INCIDENT=$(echo "$RESPONSE" | jq '.incident | {id, title, status, urgency, service: {id: .service.id, name: .service.summary}, createdAt: .created_at, htmlUrl: .html_url}')
    MESSAGE="Incident created successfully"
    ;;
    
  resolve-incident)
    DATA='{"incident":{"type":"incident_reference","status":"resolved"}}'
    RESPONSE=$(api_call PUT "/incidents/${input.incidentId ?? ''}" "$DATA")
    INCIDENT=$(echo "$RESPONSE" | jq '.incident | {id, title, status, urgency, service: {id: .service.id, name: .service.summary}, createdAt: .created_at, htmlUrl: .html_url}')
    MESSAGE="Incident resolved"
    ;;
    
  acknowledge)
    DATA='{"incident":{"type":"incident_reference","status":"acknowledged"}}'
    RESPONSE=$(api_call PUT "/incidents/${input.incidentId ?? ''}" "$DATA")
    INCIDENT=$(echo "$RESPONSE" | jq '.incident | {id, title, status, urgency, service: {id: .service.id, name: .service.summary}, createdAt: .created_at, htmlUrl: .html_url}')
    MESSAGE="Incident acknowledged"
    ;;

  add-note)
    DATA='{"note":{"content":"${input.note ?? ''}"}}'
    api_call POST "/incidents/${input.incidentId ?? ''}/notes" "$DATA" > /dev/null
    MESSAGE="Note added to incident"
    ;;

  get-incident)
    RESPONSE=$(api_call GET "/incidents/${input.incidentId ?? ''}")
    INCIDENT=$(echo "$RESPONSE" | jq '.incident | {id, title, status, urgency, service: {id: .service.id, name: .service.summary}, createdAt: .created_at, htmlUrl: .html_url}')
    MESSAGE="Retrieved incident details"
    ;;

  list-incidents)
    RESPONSE=$(api_call GET "/incidents?statuses%5B%5D=triggered&statuses%5B%5D=acknowledged")
    INCIDENTS=$(echo "$RESPONSE" | jq '[.incidents[] | {id, title, status, urgency, service: {id: .service.id, name: .service.summary}, createdAt: .created_at, htmlUrl: .html_url}]')
    MESSAGE="Retrieved incidents"
    ;;

  get-oncall)
    RESPONSE=$(api_call GET "/oncalls?schedule_ids%5B%5D=${input.scheduleId ?? ''}")
    ONCALL=$(echo "$RESPONSE" | jq '[.oncalls[] | {user: {id: .user.id, name: .user.summary, email: .user.email}, escalationLevel: .escalation_level, start: .start, end: .end}]')
    MESSAGE="Retrieved on-call schedule"
    ;;

  trigger-event)
    DEDUP_KEY="${input.dedupKey ?? ''}"
    [ -z "$DEDUP_KEY" ] && DEDUP_KEY=$(cat /dev/urandom | tr -dc 'a-z0-9' | head -c 32)
    DATA='{"routing_key":"'"$ROUTING_KEY"'","event_action":"trigger","dedup_key":"'"$DEDUP_KEY"'","payload":{"summary":"${input.title ?? 'Event'}","severity":"${input.severity ?? 'error'}","source":"${input.source ?? 'harmony'}","component":"${input.component ?? ''}","custom_details":${JSON.stringify(input.customDetails ?? {})}}}'
    RESPONSE=$(curl -s -X POST "$EVENTS_URL" -H "Content-Type: application/json" -d "$DATA")
    EVENT_ID=$(echo "$RESPONSE" | jq -r '.dedup_key // empty')
    MESSAGE="Event triggered"
    ;;
    
  *)
    SUCCESS=false
    MESSAGE="Unknown operation: $OPERATION"
    ;;
esac

cat <<EOF
{
  "success": $SUCCESS,
  "operation": "$OPERATION",
  "incident": \${INCIDENT:-null},
  "incidents": $INCIDENTS,
  "eventId": "$EVENT_ID",
  "dedupKey": "$DEDUP_KEY",
  "oncall": $ONCALL,
  "message": "$MESSAGE"
}
EOF
            `.trim(),
        ]);
    },
};
