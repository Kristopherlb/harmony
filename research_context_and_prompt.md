# Deep Research Context: Harmony Platform IA, UX, & Workflow Generation

## 1. Project Context
**Name:** Harmony
**Domain:** Engineering Operations (Ops Center)
**Goal:** A "Compliance-as-Code" and "Ops Automator" platform where agents orchestrate diverse tools (Capabilities) to solve complex tasks (e.g., Incident Response, Release Pipelines, Compliance Checks).

### Technology Stack
-   **Frontend:** React, Vite, TailwindCSS, Radix UI, Framer Motion, TanStack Query.
-   **Backend:** Node.js, Express, Drizzle ORM (Postgres), Temporal (Workflow Orchestration).
-   **Architecture:** Monorepo (Nx). "Blueprints" define standard workflows. "Capabilities" are tool integrations (Jira, GitHub, AWS, etc.).

## 2. Current State & Friction Points
The platform currently consists of:
1.  **Static Dashboard:** Traditional navigation (Sidebar -> Dashboard, Incidents, Workbench).
2.  **Visual Builder (Drafting Canvas):** A React Flow-based canvas for manually dragging-and-dropping nodes to create workflows.
3.  **Chat Interface:** A separate "AI Agent" panel.
4.  **Blueprints:** Statically defined Temporal workflows in TypeScript.

**The Problem:**
-   **Disconnected UX:** The "Chat" and the "Workbench" are siloed. The agent cannot effectively "see" or "manipulate" the visual builder.
-   **Information Architecture:** The navigation is rigid, optimized for static CRUD, not for dynamic, agent-led operations.
-   **Workflow Generation:** Currently relies on either manual coding (TypeScript) or a primitive drag-and-drop builder. The goal is *Generative Workflow Creation*—where the user describes a goal, and the system synthesizes a valid, executable workflow (Temporal or IR) and visualizes it.
-   **Usability Barriers:** "Capabilities" (Tools), "Blueprints" (Templates), and "Skills" are currently hidden or hard to discover. Users struggle to know *what* is available to them.

## 3. Research Objectives
We aim to reimagine the Harmony UX/IA to be **AI-Native**.

1.  **Generative UI/IA:** How can the interface adapt to the current context? (e.g., if debugging an incident, the UI morphs into an incident war room).
2.  **Conversational-to-Visual Workflow:** How to seamlessly transition from "Chat" (Intent) -> "Visual Draft" (Verification) -> "Execution" (Temporal).
3.  **Agent-Driven Navigation:** Instead of a static sidebar, how can the Agent guide the user or "summon" the right views.
4.  **Asset Discovery:** How to make technical assets (Capabilities, Templates, Skills) visually browsable and intuitively usable for non-experts.

## 4. The Deep Research Prompt
*(Copy and paste the following into a reasoning model like Gemini Pro 1.5, o1, or Claude 3.5 Sonnet)*

---

**Research Prompt:**

I am architecting the UX and Information Architecture for "Harmony," an AI-native Engineering Operations platform. The system uses Agents to orchestrate tools (Capabilities) and execute long-running processes (Temporal workflows).

**Context:**
-   **Stack:** React, Tailwind, Temporal, Node.js.
-   **Current State:** A traditional dashboard with a siloed Chat bot and a primitive drag-and-drop workflow builder.
-   **Goal:** Move to a "Generative Workspace" model where the UI is fluid, and workflows are generated/modified via conversation + visual confirmation.

**Please perform deep research on the following areas and provide a strategy document:**

1.  **Competitive UX Analysis & Trends:**
    -   Analyze the UX patterns of the following top-tier workflow and automation products: **Make, Vellum, Zapier, Harness, n8n, Temporal (Cloud UI), Tray.io, and Workato.**
    -   Identify specific "UX Trends" in 2024/2025 for these tools. e.g., "The shift from rigid left-to-right pipelines to infinite canvas," or "AI-assisted node configuration."
    -   **Specific Comparison:** How does **Vellum** handle the "AI/Prompt Engineering" workflow compared to **Make's** distinct "Logic/Data" flow? Which model fits an Agentic Ops Platform better?
    -   **Temporal Specifics:** How does Temporal visualize *long-running code workflows*? How can we bridge the gap between "Code (Temporal)" and "Visual Representation (Canvas)" without losing fidelity?

2.  **Asset Discovery & Library UX (Capabilities, Templates, Skills):**
    -   **Problem:** Harmony has complex assets: "Capabilities" (Integrations like Jira), "Blueprints" (Templates like Incident Response), and "Skills" (Agent Instructions). Currently, these are hard to find and use.
    -   **Research:** How do **Zapier**, **Make**, and **Harness** handle their "App Marketplaces" and "Template Galleries"? Use screenshots or descriptions of their IA.
    -   **Best Practices:**
        -   How should these be presented to a user? (e.g., Cards, Search-first, Agent-suggested).
        -   How do we visualize the *relationship* between a "Skill" (Abstract capability) and a "Workflow" (Concrete implementation)?
        -   What is the best UX for "installing" or "activating" a capability? (OAuth flows, credential management best practices).

3.  **Generative Workflow Patterns:**
    -   What are the state-of-the-art patterns for Agents generating structured workflows (DAGs) from natural language?
    -   Compare "Direct-to-Code" (LLM writes Temporal TS) vs. "Intermediate Representation" (LLM writes JSON/YAML -> UI renders -> Code generated). Which gives better UX for human-in-the-loop verification?

4.  **AI-Native Information Architecture:**
    -   Critique the "Sidebar + Main View" standard. What replaces it for an agent-centric app?
    -   Research "Object-Oriented UI" (OOUI) vs. "Intent-Oriented UI" in the context of Agents. How should the system present "Active Context" (e.g., 'Deploying to Prod') vs. "Global Navigation"?

5.  **Hybrid Chat-Canvas UX:**
    -   Analyze best practices from tools like **Replit Agent** (Chat-to-App), **Cursor** (Chat-to-Code), or **Bolt.new**.
    -   Propose a specific interaction model for Harmony: How does a user "correct" a generated workflow? text-edit? drag-and-drop? or telling the agent to "fix the loop"?

**Output Requirements:**
-   **UX Trend Report:** A bulleted summary of key UX trends from the analyzed competitors.
-   **Library UX Patterns:** 3 specific concept ideas for visualizing "Capabilities" and "Skills" to make them highly usable.
-   **3 Distinct "North Star" UX Concepts:** (e.g., "The Infinite Canvas," "The Dynamic Notebook," "The Command Center").
-   **Workflow Generation Flow:** Recommend a specific technical flow.

---
