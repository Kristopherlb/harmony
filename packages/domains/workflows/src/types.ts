export interface WorkflowHistoryEvent {
    id: string;
    eventId: number;
    eventType: string;
    timestamp: string;
    activityType?: { name: string };
    // Add other fields as needed
}
