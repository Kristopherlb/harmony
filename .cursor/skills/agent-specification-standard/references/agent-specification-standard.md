Agent Specification Standard (ASS)| Metadata | Value || ID | ASS-001 || Version | 1.0.0 || Status | DRAFT || Context | Golden Path Monorepo |1. IntroductionThe Agent Specification Standard (ASS) defines the contract for probabilistic "Reasoners" within the ecosystem. While the WCS (Workflow Standard) handles deterministic execution, the ASS handles cognitive processes using LangGraph.2. Normative Requirements2.1. Cognitive Architecture (LangGraph)2.1.1 State Definition: Every Agent MUST define a strictly typed State Schema using Zod. This state represents the Agent's "Short-term Memory."2.1.2 Deterministic Persistence: Agents MUST utilize a Checkpointer (Postgres or Temporal-backed) to ensure that agentic loops can survive crashes and be resumed.2.1.3 Node Purity: While the graph is probabilistic, individual nodes (functions) SHOULD be as pure as possible, offloading side effects to OCS Capabilities.2.2. Tool Integration (MCP)2.2.1 Tool Binding: Agents MUST NOT have hardcoded API clients. They MUST interact with the world via the Model Context Protocol (MCP).2.2.2 Discovery: Agents MUST query the local or remote MCP Registry to discover "Blueprints" and "Capabilities" at runtime.2.3. Safety & Guardrails2.3.1 System Prompt Governance: Prompts MUST be versioned and treated as code. They MUST include a "Negative Constraint" block (e.g., "Never expose internal IDs to the user").2.3.2 Token Budgeting: Agents MUST define a max_iterations and token_limit per reasoning cycle to prevent infinite loops and cost overruns.2.3.3 HITL Requirement: Any tool call marked as RESTRICTED in the OCS standard MUST trigger an interrupt in the LangGraph, requiring human approval before the node executes.2.4. Observability (OTel for Agents)2.4.1 Trace Context: LangGraph spans MUST be nested under the parent OTel Trace ID.2.4.2 Reasoning Logs: The "Thought Process" (internal monologues) MUST be captured in structured logs, but stripped from final user-facing responses.3. Technical Specification (TypeScript/LangGraph)import { StateGraph, Annotation } from "@langchain/langgraph";
import { z } from 'zod';

/**
 * The Agent Specification
 */
export interface AgentSpec<State, Tools> {
  metadata: {
    id: string;          // e.g., "agents.ops.remediation"
    version: string;
    description: string; // Used by other agents to "delegate" work
  };

  /** The Zod Schema for the Agent's Memory */
  stateSchema: z.ZodSchema<State>;

  /** The MCP Servers/Tools this agent is authorized to use */
  authorizedTools: string[]; 

  /** The System Prompt (Versioned Asset) */
  systemPrompt: string;

  /** The LangGraph definition */
  graph: StateGraph<State>;
}
4. Operational BaselinesEvals as a First-Class Citizen: No Agent can be deployed without an evals.yaml (Promptfoo) score of >0.8 on semantic tool selection.A/B Testing: Use OpenFeature to route user requests between different Agent versions or LLM providers (e.g., Claude 3.5 vs 3.7).
