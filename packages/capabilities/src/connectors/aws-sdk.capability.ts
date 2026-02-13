/**
 * packages/capabilities/src/connectors/aws-sdk.capability.ts
 * AWS SDK Capability (OCS-001 Connector Pattern)
 *
 * Provides AWS service operations via AWS SDK v3.
 * Supports S3, STS, Lambda, DynamoDB, SQS, SNS, Secrets Manager, and more.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const serviceSchema = z.string().describe('AWS service name (e.g., s3, sts, lambda)');

const inputSchema = z
  .object({
    service: serviceSchema,
    operation: z.string().describe('SDK operation name (e.g., getObject, putItem)'),
    params: z.record(z.unknown()).describe('Operation parameters'),
    region: z.string().optional().describe('Override region for this operation'),
  })
  .describe('AWS SDK input');

const outputSchema = z
  .object({
    success: z.boolean().describe('Whether operation succeeded'),
    data: z.unknown().describe('Operation response data'),
    metadata: z.object({
      requestId: z.string().optional(),
      httpStatusCode: z.number().optional(),
      attempts: z.number().optional(),
    }).optional().describe('Response metadata'),
    error: z.object({
      name: z.string(),
      message: z.string(),
      code: z.string().optional(),
    }).optional().describe('Error details if failed'),
    duration: z.number().describe('Operation duration in milliseconds'),
  })
  .describe('AWS SDK output');

const configSchema = z
  .object({
    region: z.string().describe('Default AWS region'),
    endpoint: z.string().optional().describe('Custom endpoint (for LocalStack, etc.)'),
    maxRetries: z.number().int().min(0).optional().describe('Maximum retry attempts'),
  })
  .describe('AWS SDK configuration');

const secretsSchema = z
  .object({
    accessKeyId: z.string().optional().describe('AWS access key ID'),
    secretAccessKey: z.string().optional().describe('AWS secret access key'),
    sessionToken: z.string().optional().describe('AWS session token'),
  })
  .describe('AWS SDK secrets');

export type AwsSdkInput = z.infer<typeof inputSchema>;
export type AwsSdkOutput = z.infer<typeof outputSchema>;
export type AwsSdkConfig = z.infer<typeof configSchema>;
export type AwsSdkSecrets = z.infer<typeof secretsSchema>;

export const awsSdkCapability: Capability<
  AwsSdkInput,
  AwsSdkOutput,
  AwsSdkConfig,
  AwsSdkSecrets
> = {
  metadata: {
    id: 'golden.connectors.aws-sdk',
    domain: 'connectors',
    version: '1.0.0',
    name: 'awsSdk',
    description:
      'AWS SDK v3 connector for cloud operations. Supports S3, STS, Lambda, DynamoDB, SQS, SNS, Secrets Manager, and all AWS services.',
    tags: ['connector', 'connectors', 'aws', 'cloud', 's3', 'lambda'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['aws:read', 'aws:write'],
    dataClassification: 'CONFIDENTIAL',
    networkAccess: {
      allowOutbound: ['*.amazonaws.com', '*.aws.amazon.com'],
    },
  },
  operations: {
    isIdempotent: false, // Depends on operation
    retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 1, backoffCoefficient: 2 },
    errorMap: (error: unknown) => {
      if (error instanceof Error) {
        if (error.message.includes('throttl')) return 'RETRYABLE';
        if (error.message.includes('timeout')) return 'RETRYABLE';
        if (error.message.includes('ServiceUnavailable')) return 'RETRYABLE';
        if (error.message.includes('AccessDenied')) return 'FATAL';
      }
      return 'FATAL';
    },
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      service: 's3',
      operation: 'listObjects',
      params: { Bucket: 'my-bucket', Prefix: 'logs/' },
    },
    exampleOutput: {
      success: true,
      data: {
        Contents: [
          { Key: 'logs/app.log', Size: 1234 },
          { Key: 'logs/error.log', Size: 567 },
        ],
        IsTruncated: false,
      },
      metadata: {
        requestId: 'abc123',
        httpStatusCode: 200,
      },
      duration: 245,
    },
    usageNotes:
      'Use service name in lowercase (s3, sts, lambda). Operation names match SDK method names (getObject, putItem). Provide credentials via secretRefs or use IAM roles.',
  },
  factory: (
    dag,
    context: CapabilityContext<AwsSdkConfig, AwsSdkSecrets>,
    input: AwsSdkInput
  ) => {
    // ISS-compliant types - includes withMountedSecret for secret mounting
    type DaggerSecret = unknown;
    type ContainerBuilder = {
      from(image: string): ContainerBuilder;
      withEnvVariable(key: string, value: string): ContainerBuilder;
      withMountedSecret(path: string, secret: DaggerSecret): ContainerBuilder;
      withExec(args: string[]): unknown;
    };
    type DaggerClient = {
      container(): ContainerBuilder;
      setSecret(name: string, value: string): DaggerSecret;
    };
    const d = dag as unknown as DaggerClient;

    const payload = {
      service: input.service,
      operation: input.operation,
      params: input.params,
      region: input.region ?? context.config.region,
      endpoint: context.config.endpoint,
      maxRetries: context.config.maxRetries ?? 3,
    };

    // Build container with mounted secrets (ISS-compliant)
    let container = d
      .container()
      .from('node:20-alpine')
      .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
      .withEnvVariable('AWS_SERVICE', input.service)
      .withEnvVariable('AWS_OPERATION', input.operation)
      .withEnvVariable('AWS_REGION', input.region ?? context.config.region);

    // Mount AWS credentials if provided (platform resolves to Dagger Secrets)
    if (context.secretRefs.accessKeyId && typeof (container as Record<string, unknown>).withMountedSecret === 'function') {
      container = container.withMountedSecret('/run/secrets/aws_access_key_id', context.secretRefs.accessKeyId as unknown as DaggerSecret);
    }
    if (context.secretRefs.secretAccessKey && typeof (container as Record<string, unknown>).withMountedSecret === 'function') {
      container = container.withMountedSecret('/run/secrets/aws_secret_access_key', context.secretRefs.secretAccessKey as unknown as DaggerSecret);
    }
    if (context.secretRefs.sessionToken && typeof (container as Record<string, unknown>).withMountedSecret === 'function') {
      container = container.withMountedSecret('/run/secrets/aws_session_token', context.secretRefs.sessionToken as unknown as DaggerSecret);
    }

    return container.withExec([
      'sh',
      '-c',
      `
npm install --no-save @aws-sdk/client-s3 @aws-sdk/client-sts @aws-sdk/client-lambda @aws-sdk/client-dynamodb @aws-sdk/client-sqs @aws-sdk/client-sns @aws-sdk/client-secrets-manager 2>/dev/null && node -e '
const fs = require("fs");
const input = JSON.parse(process.env.INPUT_JSON);

async function run() {
  const startTime = Date.now();

  // ISS-compliant: Read credentials from mounted paths only
  const ACCESS_KEY_PATH = "/run/secrets/aws_access_key_id";
  const SECRET_KEY_PATH = "/run/secrets/aws_secret_access_key";
  const SESSION_TOKEN_PATH = "/run/secrets/aws_session_token";
  
  let credentials = undefined;
  if (fs.existsSync(ACCESS_KEY_PATH) && fs.existsSync(SECRET_KEY_PATH)) {
    credentials = {
      accessKeyId: fs.readFileSync(ACCESS_KEY_PATH, "utf8").trim(),
      secretAccessKey: fs.readFileSync(SECRET_KEY_PATH, "utf8").trim(),
    };
    
    if (fs.existsSync(SESSION_TOKEN_PATH)) {
      credentials.sessionToken = fs.readFileSync(SESSION_TOKEN_PATH, "utf8").trim();
    }
  }

  // Build client config
  const clientConfig = {
    region: input.region,
    ...(credentials && { credentials }),
    ...(input.endpoint && { endpoint: input.endpoint }),
    maxAttempts: input.maxRetries,
  };

  // Import and create client dynamically
  const serviceMap = {
    s3: "@aws-sdk/client-s3",
    sts: "@aws-sdk/client-sts",
    lambda: "@aws-sdk/client-lambda",
    dynamodb: "@aws-sdk/client-dynamodb",
    sqs: "@aws-sdk/client-sqs",
    sns: "@aws-sdk/client-sns",
    secretsmanager: "@aws-sdk/client-secrets-manager",
  };

  const servicePkg = serviceMap[input.service.toLowerCase()];
  if (!servicePkg) {
    throw new Error("Unsupported service: " + input.service + ". Install additional SDK packages.");
  }

  const sdk = require(servicePkg);
  
  // Find the client class (e.g., S3Client, LambdaClient)
  const clientClassName = Object.keys(sdk).find(k => k.endsWith("Client") && k !== "Client");
  if (!clientClassName) {
    throw new Error("Could not find client class for " + input.service);
  }
  
  const ClientClass = sdk[clientClassName];
  const client = new ClientClass(clientConfig);

  // Find the command class
  const commandName = input.operation.charAt(0).toUpperCase() + input.operation.slice(1) + "Command";
  const CommandClass = sdk[commandName];
  
  if (!CommandClass) {
    throw new Error("Unknown operation: " + input.operation + " for service " + input.service);
  }

  try {
    const command = new CommandClass(input.params);
    const response = await client.send(command);
    
    const { $metadata, ...data } = response;
    
    process.stdout.write(JSON.stringify({
      success: true,
      data,
      metadata: {
        requestId: $metadata?.requestId,
        httpStatusCode: $metadata?.httpStatusCode,
        attempts: $metadata?.attempts,
      },
      duration: Date.now() - startTime,
    }));
  } catch (err) {
    process.stdout.write(JSON.stringify({
      success: false,
      data: null,
      error: {
        name: err.name,
        message: err.message,
        code: err.Code || err.code,
      },
      duration: Date.now() - startTime,
    }));
  }
}

run().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
'
        `.trim(),
    ]);
  },
};
