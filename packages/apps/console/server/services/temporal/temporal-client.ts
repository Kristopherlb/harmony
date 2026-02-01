import { Connection, WorkflowClient } from '@temporalio/client';

let client: WorkflowClient | undefined;

export async function getTemporalClient() {
  if (client) return client;

  const connection = await Connection.connect({ address: 'localhost:7233' });
  client = new WorkflowClient({
    connection,
    // namespace: 'default', // default namespace
  });

  return client;
}
