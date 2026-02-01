/**
 * Represents a node in the workflow blueprint.
 * This is a high-level description, not necessarily a React Flow node yet.
 */
export interface BlueprintNode {
    id: string;
    label: string;
    type: string; // e.g., 'trigger', 'action', 'condition'
    description?: string;
    properties?: Record<string, any>; // For specific config like 'repoUrl' or 'channelId'
}

/**
 * Represents a connection between nodes.
 */
export interface BlueprintEdge {
    source: string;
    target: string;
    label?: string;
}

/**
 * The complete structure of a proposed workflow draft.
 * This is the contract between the Agent (Backend) and the Workbench (Frontend).
 */
export interface BlueprintDraft {
    title: string;
    summary: string;
    nodes: BlueprintNode[];
    edges: BlueprintEdge[];
}

/**
 * Type guard to check if an arbitrary object is a valid BlueprintDraft.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isBlueprintDraft(obj: any): obj is BlueprintDraft {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        Array.isArray(obj.nodes) &&
        Array.isArray(obj.edges) &&
        typeof obj.title === 'string'
    );
}
