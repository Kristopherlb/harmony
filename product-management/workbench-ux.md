Harmony UX Execution Plan
1. Strategic Themes → Measurable UX Goals Mapping

The Harmony UX strategy identified several key themes. We translate each theme into a clear UX goal with measurable outcomes:

Conversational Orchestration – Goal: Enable users to coordinate complex workflows through natural language conversation, reducing the need to manually script or juggle multiple tools. Success is measured by how many steps or tasks a user can accomplish via chat alone (e.g. completing a multi-step incident response with one conversational session).

Unified Workspace – Goal: Provide a single integrated workspace (chat, canvas, tools) so users don’t have to context-switch across apps. All workflow design, execution, and collaboration happens in one place, improving efficiency and alignment. We will measure this by reduced task switching (e.g. fewer external app launches) and higher user engagement within the unified interface.

Hybrid Chat-Canvas – Goal: Seamlessly blend conversational and visual interfaces. Users can fluidly move between chatting with the assistant and editing a workflow on a canvas, with each reflecting changes in the other. This aims to support “mixed-mode” work, letting users choose the medium that suits the task. Success is measured by task completion rates when using both modes together (e.g. users successfully refine a workflow via both chat commands and direct canvas edits without confusion).

Generative Workflows – Goal: Leverage generative AI to assist in creating workflow “blueprints” from high-level user intents. The system should draft initial workflows or automation scripts based on a user’s description, which the user can then refine. We’ll measure this by the percentage of new workflows started from AI suggestions and the reduction in time to create a workflow (e.g. X% faster compared to manual building).

Library UX – Goal: Deliver a capability Library experience that empowers users to discover, reuse, and share workflow templates or components easily. The user should be able to quickly find pre-built steps or templates (e.g. “send Slack alert” step) and drop them into their workflows. Success is measured by library usage metrics (e.g. # of library items inserted per user) and decreased time to set up common workflows.

(These goals will be further refined with specific quantitative targets once baseline metrics are established.)

2. UX Initiatives Breakdown by Goal

For each UX goal above, we define an initiative with its scope, user stories, requirements, and open questions:

Initiative: Conversational Orchestration

Description: Introduce an AI-driven conversational assistant that can orchestrate multi-step processes and tools via chat. This means the user can ask the assistant to perform or set up complex tasks (like incident response, deployments, data retrieval) and the assistant coordinates the necessary steps or agents. The focus is on turning intent expressed in conversation into actions/workflows. This initiative will likely involve integrating backend orchestration (e.g. Temporal workflows or multiple agents) with the chat UX so that the user feels they are “talking to” a conductor of various services.

Example User Stories:

“As an SRE, I want to generate and execute an incident response workflow from chat so I can automate recovery steps without manually triggering each tool.”

“As a support engineer, I want to ask the assistant to gather diagnostics across systems (logs, metrics, etc.) via a single conversation, so I don’t have to run queries in five different UIs.”

“As a developer, I want to instruct the assistant to deploy a feature flag and run tests through chat commands, so I can coordinate release tasks in one place.”

Key Requirements:

The LLM agent must interpret multi-step or goal-oriented requests and map them to existing capabilities (APIs, scripts, or workflow templates).

Real-time tool integrations: Chat needs to connect with backend services (or a workflow engine like Temporal) to carry out user requests (trigger jobs, fetch data, create tickets, etc.).

Stateful conversation management: The system should maintain context of the ongoing task. For example, if the assistant is orchestrating an incident workflow, it should remember previous steps and results during that session.

Clear feedback and confirmations: The UX should display what actions the assistant is taking or plans to take (e.g. “📝 Drafting a Jira ticket for incident INC-123…”). Users must confirm high-impact actions (“Are you sure you want to restart Server X?”) to stay in control.

Error handling and fallback: If the assistant cannot complete a step (tool failure or misunderstanding), it should notify the user and possibly suggest alternatives, rather than silently failing.

Open Questions & Constraints:

Scope of automation: Which tasks will the assistant handle fully vs. when will it hand off to the user? (e.g. Should every suggested action require user approval, or only destructive ones?)

Reliability: How do we ensure the assistant’s orchestration is reliable and safe? (This ties into needing robust integration testing and possibly a simulation mode.)

Privacy & Security: Some orchestrated actions might require credentials or raise security concerns. How will OAuth and permissions be managed when the assistant performs actions on behalf of a user? (E.g., the user might need to connect their AWS/GitHub account for the assistant to deploy or fetch data.)

Complexity of natural language understanding: What happens if the user gives an ambiguous request? We may need a disambiguation UX – the assistant could ask follow-up questions if intent is unclear (to avoid doing the wrong thing).

Visualization: Do we need to visualize the “workflow” that the assistant is running behind the scenes? (Perhaps in the canvas or a log) Or is textual confirmation enough? This overlaps with the Hybrid Chat-Canvas initiative.

Initiative: Unified Workspace

Description: Create a cohesive UI that brings together chat, the workflow canvas, and related tools (history, logs, library, etc.) in one screen or a tightly integrated experience. The unified workspace should allow users to seamlessly transition between designing a workflow (visual or text) and conversing with the assistant, without losing context. In practice, this could mean a split-pane interface (chat on one side, canvas on the other) or an intelligent toggle, but the information should persist across views. The aim is to eliminate the current siloed experience of using separate apps for conversation vs. workflow editing, in line with ChatOps principles of a single source of truth.

Example User Stories:

“As a user, I want to see the chat and the workflow canvas together, so when the assistant adds steps via chat I immediately see them visually represented.”

“As a project manager, I want a unified dashboard where I can chat with the assistant, see the workflow diagram, and access the library, so everything I need is in one place during our automation planning sessions.”

“As a new user, I want an intuitive single workspace (instead of navigating multiple tabs or tools) so I can learn the system quickly and not lose track of what I’m doing.”

Key Requirements:

Layout & Navigation: Design a layout that can accommodate a chat panel, a canvas area, and possibly a side panel for library or details, without overwhelming the user. This could involve resizable panels or modals.

Context persistence: When the user switches focus (e.g. opens the canvas full-screen or focuses on chat), the system should maintain state. For example, selecting an element on the canvas could highlight or be referenced in the chat (“Edit this step…”). No work should be lost or hidden unintentionally when moving between modes.

Unified data model: The chat and canvas are two views of the same underlying workflow state. A change in one immediately updates the other. This requires the backend to treat conversational edits and direct edits uniformly.

Collaborative readiness: Although maybe a later concern, the unified workspace should consider multi-user collaboration (e.g. two people viewing the same workflow). Even if real-time collab isn’t first enabled, the design should not paint us into a corner (perhaps use an architecture similar to other collaborative editors).

Integrated authentication & settings: Ensure features like OAuth connections, user profile, and settings are accessible in this workspace without jumping to a different app or page. For instance, if a workflow action requires connecting a third-party service, the unified UI should prompt the OAuth flow and then return the user to the same context.

Open Questions & Constraints:

Optimal arrangement: What is the best way to arrange chat and canvas? Side-by-side, top-bottom, or overlay toggle? This likely needs user testing with prototypes (some users might prefer a focus mode for canvas with chat minimized, others want to see both at once on wide screens).

Performance: Will having both chat and canvas (and possibly other modules like logs or library) in one view cause performance or UI clutter issues? We may need to lazy-load components or provide ways to hide/show portions of the UI.

Responsiveness: How will this workspace scale to different screen sizes? Perhaps the canvas dominates on larger screens, whereas on smaller screens the user might toggle between chat and canvas views. Designing a responsive layout is a requirement.

Onboarding/Tutorial: A unified interface can be complex. We should plan a guided tutorial or tooltips to help new users understand the workspace (e.g. highlight “This is the chat where you ask Harmony to do things, and here is the canvas where you can fine-tune the workflow it creates.”).

Initiative: Hybrid Chat-Canvas Interaction

Description: Develop the interaction model that tightly links the chat and canvas. This initiative defines how a user can use natural language to manipulate the visual workflow (and vice versa, how the system can use the canvas context in conversation). It’s essentially the UX glue between chat and canvas – for example, a user could say “Add an approval step after Step 3” in the chat, and the canvas will update accordingly. Conversely, a user might click a node on the canvas and ask in chat “What does this step do?” or “Rename this step to ‘Send Alert’.” The goal is to make the chat an intelligent assistant within the canvas context, supporting a modern mixed-mode working style.

Example User Stories:

“As a workflow builder, I want to ask in chat to add or modify steps on my canvas, so I can build automations without dragging every component manually.”

“As a user, I want to get explanations or suggestions for parts of my workflow via chat (e.g. ‘What does this block do? Can it be optimized?’), so I can refine my workflow with AI guidance while I’m designing it.”

“As a user, I sometimes want to manually tweak the workflow on canvas and then tell the assistant to review it, so the AI can validate or improve what I drew.”

Key Requirements:

Real-time sync: Any changes made via chat commands should reflect on the canvas in real time (with some visible highlight or indication of what changed). Similarly, if a user manually changes the canvas, the assistant’s context/state should update (so it doesn’t suggest outdated info).

Referencing mechanism: The system needs a way to unambiguously refer to elements in the workflow through language. This could mean assigning each step a label or number (the assistant might say “Added Step 4: Send Notification” in the chat). The user should also be able to reference steps by name/label in conversation (“remove the Send Notification step”).

Undo/confirmation flow: Because an AI misunderstanding could incorrectly alter a complex canvas, provide an easy undo for any chat-driven changes (perhaps maintain a change log with revert options). Alternatively, some chat commands should propose changes first: e.g. the assistant replies “I will add an Email Notification step after Step 3. Should I proceed?” – letting the user confirm before it actually places it on the canvas. This maintains user trust and control.

Visual indicators: When the assistant adds or edits something on the canvas, use a visual cue (like a highlight glow or a different colored outline on new elements) to draw the user’s attention. This helps users follow along with what the AI did on the visual side.

Canvas-side chat cues: Consider small affordances on the canvas UI to invoke chat, e.g. a “Ask Harmony” tooltip if the user pauses on a particular node (triggering a question like “Need help with this step?”). Similarly, enabling drag-and-drop from chat (if the assistant suggests a snippet or template, the user could drag it into the canvas).

Open Questions & Constraints:

Disambiguation in language: How to handle complex instructions like “make the third step run in parallel with step 4” – the system needs to understand and possibly clarify if the intent is unclear. Designing the conversation for edge cases (perhaps the assistant asks which step specifically if there’s ambiguity) is an open area.

Language limitations: There may be structural edits easier done visually (like drawing a loop or parallel branch). Should we support describing these in chat (e.g. “create a loop between steps 2 and 5”) or encourage the user to do it on canvas? We might start with simpler linear edits via chat and later handle advanced cases.

Conflict resolution: If the user and assistant try to edit the same part of the workflow at the same time (or if two chat commands conflict), how do we resolve it? Possibly locking certain operations or queuing them. For now, maybe assume single-user sequential interactions, but keep this in mind.

Learnability: How will users know they can do X via chat versus the canvas? We might need UI hints or a cheat-sheet (e.g. a help command like “What can I ask?” listing examples like “try ‘Add a step to do X’”). Ensuring users discover these hybrid features will be crucial to adoption.

Initiative: Generative Workflow Blueprint

Description: Introduce a Generative Blueprint Editor capability where users can request the system to create an entire workflow outline or significant portions of it automatically. The user might provide a high-level goal or a few specifications, and the AI will generate a recommended workflow (a “blueprint”) on the canvas. This is essentially using the LLM to bootstrap the workflow-building process – for instance, a user could say “Help me create a customer onboarding automation”, and the system produces a draft workflow with steps like “Send welcome email, Provision account, Notify sales team,” etc. The user can then accept, modify, or iteratively refine this blueprint. This addresses blank-page syndrome and accelerates complex builds by providing a starting point.

Example User Stories:

“As a user new to Harmony, I want to describe my process in one prompt and get a draft workflow, so I have something concrete to start with instead of a blank canvas.”

“As a power user, I want to generate boilerplate sub-workflows (e.g. an error handling routine) via a quick command, so I don’t have to rebuild common patterns each time.”

“As an SRE lead, I want to have the assistant suggest an incident response playbook given a scenario I describe, so I can consider industry best practices I might not have thought of.”

Key Requirements:

Prompting & AI model tuning: The system should translate the user’s description into a well-structured prompt for the LLM that yields a useful workflow. This may involve few-shot examples or a specialized prompt template so that the AI output is formatted in a way we can map to canvas elements (e.g. JSON or a domain-specific language that the canvas can parse).

Domain knowledge integration: To make suggestions relevant, the AI might need knowledge of the capabilities library (see below) – e.g. the known actions/integrations Harmony supports. The generative component should preferably only use steps that exist or are feasible. One approach is retrieval-augmented generation: retrieve relevant template snippets from the library and have the LLM compose them.

User guidance & iteration: After the AI generates a workflow, present it to the user for review before it’s finalized on the canvas. Possibly show a summary: “I’ve drafted a workflow with 5 steps: 1) Do X, 2) Y, …” and ask for confirmation. The user should be able to say “Looks good, build it” or “Hmm, change step 3 to do Z instead.” This ties in with the Hybrid Chat-Canvas initiative – the user’s feedback could be via chat (natural language refinement) which the AI then applies to the draft.

Partial generation: Allow the feature to work in parts of a workflow too. For example, within an existing canvas the user might select a gap and ask the AI to “fill in the next steps to handle payment failure.” The system should be able to take the surrounding context into account and generate just that segment.

Verification and safety: The generated workflows should ideally be validated for correctness or feasibility. This could involve basic checks (e.g. no missing required parameters, APIs exist for suggested actions) and maybe an explanation mode – the assistant can explain why it added each step, to help users trust the suggestion. We could incorporate an acceptance criterion that “the user can revise a generated workflow via natural language without leaving the canvas,” ensuring iterative refinement.

Open Questions & Constraints:

Accuracy of AI suggestions: How do we handle if the LLM suggests steps that aren’t actually implementable (e.g. a step that requires a tool we don’t have)? We might need constraints on the generation or a post-processing step that flags unknown actions. Possibly tie into the Library: if an action isn’t found, prompt the user or replace with a placeholder that user must configure.

Over-reliance vs learning: Will users become passive, accepting whatever is generated? We should ensure the experience is collaborative (like Retool’s philosophy of AI as a collaborative builder). Design wise, we might encourage users to review each step (maybe a checklist UI to approve each generated step, though that could be tedious) or emphasize that they can always edit afterwards.

Evaluation: What metrics define a “good” generated workflow? We might need user testing where an expert rates the AI-generated workflows for completeness and correctness. Iteratively, we’ll refine the prompt/logic based on feedback until the generative results meet a quality bar (perhaps 80% of suggestions require only minor tweaks in user testing).

Integration with human-made content: If the library contains user-contributed templates, how to ensure the AI doesn’t plagiarize or produce something not permitted? Governance of generative content might need consideration (maybe not a big issue if everything is internal, but worth noting if in future sharing externally).

Initiative: Library & Template Experience

Description: Build out the Capability Library UX – a searchable, well-organized library of pre-built workflow templates, common actions, and integrations. This initiative will turn the conceptual “Library” from the strategy report into a tangible feature that users can interact with. The library serves two purposes: inspiration (browsing to discover what’s possible or to get ideas) and acceleration (quickly adding known-good steps or subflows to one’s project). For example, a user might search the library for “PagerDuty alert step” or grab a “Daily Standup Workflow” template and then customize it. The UX should make it easy to find relevant snippets and incorporate them into the canvas or even via chat (the assistant could suggest library items in conversation).

Example User Stories:

“As a user, I want to browse a library of ready-made workflow templates (e.g. Incident Response, CI/CD pipeline), so I can jump-start creating a new workflow by starting from a proven template.”

“As a user, I want to search the library for specific actions or integrations (e.g. Slack, Datadog, Jira) to find if there’s an existing step I can reuse, so I don’t have to craft it from scratch.”

“As an advanced user/contributor, I want to publish a workflow I made to the library (or share with my team) with a description, so others can reuse and benefit from it.”

Key Requirements:

Catalog structure: Organize library content by categories (by domain, by integration type, by popularity). There should also be robust search with keywords/tags. E.g., typing “incident” should bring up incident management related templates, while “Slack” shows any step or workflow involving Slack API.

Metadata and preview: Each library item (template or step) should have a name, short description, maybe an icon, and details like “Last updated, author, number of steps, integrations used”. For templates, a preview (perhaps a mini workflow diagram or list of steps) helps users decide if it fits their needs before inserting.

Insertion & adaptation: The user should be able to insert a library item into their workflow easily. For a whole template, that could mean loading it onto the canvas as a new project or merging into an existing one. For single-step or small snippets, maybe drag-and-drop onto the canvas or a button “Add to canvas”. If the item requires configuration (e.g. an API key, or choosing a specific project ID), prompt the user upon insertion (like a quick setup wizard).

Library in chat: The assistant should leverage the library as well. For instance, if the user asks, “How do I add an email notification?”, the assistant can pull an appropriate library step (if available) and either insert it or at least link it. This means the library backend should be accessible via API to the LLM (or via tools) for suggestions.

Versioning and updates: Particularly for templates, consider version control – if we improve a template or fix a bug, users should ideally get the update or at least be notified. Also, if a user has customized a template after importing, we wouldn’t override their changes, but we might alert “A newer version of this template is available.” (This can be a later enhancement, but keep data model in mind.)

Open Questions & Constraints:

User contributions: Will the library initially be curated by our team only, or allow community contributions? The strategy likely starts curated (for quality control), but long-term it could be powerful to have user-submitted recipes. If so, we’ll need a submission workflow and possibly moderation. For now, we assume a curated set of items aligned with our key use cases.

Library scope: Does the library include only full workflow templates, or also individual “actions”/steps and smaller building blocks? We are leaning toward both (a hierarchical library). This needs to be reflected in the UI (maybe separate sections: “Templates” vs “Steps” vs “Utilities”). We should clarify this to avoid user confusion when searching.

Integration with external marketplaces: Are there existing template marketplaces or repositories (for similar automation tools) we can integrate or draw from? Or do we build from scratch? (This might affect content available in short term.)

Dependency management: If a library workflow requires certain credentials or services (e.g. a template that uses GitHub API), how do we make the user aware? Possibly show an alert like “Requires GitHub integration” and prompt the OAuth connection as part of insertion. Ensuring a smooth experience here is important so that using a template doesn’t lead to a bunch of broken steps.

Analytics and curation: Which items are popular or effective? We should plan to track usage of library items to learn what to create more of. Also, allow rating or feedback on templates so we know if something needs improvement.

3. Feature Prioritization (RICE Framework)

Using a RICE analysis (Reach, Impact, Confidence, Effort), we’ve prioritized the proposed features. Reach estimates how many users or use-cases each feature will affect. Impact gauges how much it improves the UX for those users (on a scale High=3, Medium=2, Low=1 for example). Confidence reflects our certainty in the estimates (and the solution approach) as a percentage. Effort is the development cost (High, Med, Low qualitatively). From these, we derive a priority (in MoSCoW terms) for execution:

Feature	Reach	Impact	Confidence	Effort	Priority (MoSCoW)
Unified Workspace UI (combined chat + canvas interface)	High (all users will use the new unified app)	High (significantly reduces context-switching friction)	High (90% – clear user need, analogous to proven ChatOps models)	Medium (requires UI overhaul, but straightforward technically)	Must – foundational for all other features, enables mixed use.
Chat-to-Canvas Workflow Creation (NL to build workflows)	High (core users who build workflows – majority of target users)	High (dramatically speeds up creation and lowers skill barrier)	Medium (70% – confident it helps, need to validate LLM accuracy)	High (complex LLM integration & UX work)	Must – key differentiator, focus of Phase 1/2 development.
Generative Workflow Suggestions (AI-generated blueprint)	Medium (new users and time-strapped users will use; others may prefer manual)	High (when used, it can save a lot of time)	Medium (60% – the concept is sound, quality of suggestions needs validation)	High (LLM fine-tuning, prompt engineering, validation features)	Should – important, but can be phased in after core chat-canvas is stable.
Capability Library Integration (template/step library)	High (eventually all builders will browse or import from library)	Medium (speeds up workflow assembly and promotes best practices)	High (90% – pattern proven in many platforms, users do seek templates)	Medium (mostly UI and content effort, moderate technical risk)	Should – adds considerable value, can be built in parallel with core features.
Conversational Orchestration Engine (assistant executing multi-step tasks)	Medium (advanced use-cases, but could grow as we integrate more tools)	High (for those use cases, it automates complex flows end-to-end)	Medium (70% – concept is powerful, but user trust and safety need proof)	High (requires robust backend orchestration, integration with many services)	Could – high potential, but complex; implement after foundational features (could be in later phases once basic chat & workflow features are in place).

Notes: We categorized Unified Workspace and Chat-to-Canvas as Must-have because they form the backbone of the user experience changes. Generative features and the Library are next priority once the foundation is set, as they markedly improve efficiency but the system can function without them in v1. Conversational orchestration (the assistant actually running tasks) is extremely powerful but also carries higher technical and design risk; we will likely iterate towards it once the user is comfortably building workflows in the platform.

(The RICE scoring details are kept internal, but this priority aligns with delivering a usable core first, then layering advanced capabilities.)

4. Implementation Roadmap (Now, Next, Later)

We propose a phased execution plan to incrementally deliver these initiatives. Each phase groups features that logically and technically go together, with an eye on dependencies across teams (LLM integration, Canvas UI, Backend Orchestration, etc.):

Now (Q1 2026) – Foundation and MVP Integration:

Unified Workspace & Basic Canvas Integration: Begin by merging the chat and canvas into one interface. Implement the UI shell (perhaps behind a feature flag for internal testing) where users can toggle or see both. Dependency: Front-end team (UI/UX) and design collaborate on layout; ensure the canvas component can render inside the new workspace container.

Basic Chat-to-Canvas Commands: Enable a limited set of natural language commands that affect the canvas. For MVP, focus on simple actions like “add step” or “rename step”. Use the existing LLM (GPT-4 or similar) with a prompt-based approach – no fine-tuning yet. Dependency: LLM team to help craft prompts and a parsing method for the LLM’s output (or define a small DSL for workflow edits). Canvas/Engineering to provide an API for adding/editing steps programmatically.

Capability Library (Structure & Backend): Set up the database or repository for library items and an API to fetch them. Populate it with a few initial templates or actions for common use cases (maybe 5–10 items to start). The UI could be simple (even a modal search box) in this phase. Dependency: Backend team for data store; maybe content team or solution engineers to supply initial templates.

OAuth & Integration Prep: Implement the OAuth flow for at least one critical integration (e.g. Slack or Jira) to demonstrate end-to-end usage. This ensures that when a workflow step or assistant action needs to access an external service, we have the authentication groundwork. Dependency: Platform team to handle OAuth handshakes and token storage securely.

Internal Testing & Feedback: Conduct internal tests with the design team and a few friendly users on the new unified interface and chat commands. Collect feedback on usability (e.g. is the unified workspace overwhelming? Are the chat commands understood by the AI correctly?). Iterate quickly on obvious UX issues (like resizing panels, improving prompt phrasing).

Next (Q2–Q3 2026) – Expand Functionality & Pilot to Users:

Generative Workflow Blueprint (Beta): Integrate the generative AI capabilities. Using the feedback from initial chat commands, expand the NL understanding to full workflow suggestions. Possibly start with a button “AI Generate Workflow” that triggers a prompt for the user’s goal, then uses the LLM to create a draft on the canvas. Dependency: LLM team for model fine-tuning or prompt improvements; need strong collaboration with the Canvas team to map AI outputs to actual workflow objects.

Advanced Chat-Orchestration: Expand conversational abilities from just building workflows to also running them or orchestrating actions. For example, allow the user to say “Run this workflow” or even ask follow-up questions like “What happened in step 2?” after execution. This likely requires hooking up with the execution engine (Temporal or similar). Dependency: Orchestration backend (Temporal) team to provide APIs to trigger and monitor workflow runs, and possibly stream status updates back to the chat. Also need error messages or logs to be sent to the chat if things fail.

Library UX Enhancements: Evolve the library interface based on earlier feedback. Possibly implement categories, a proper search bar, and the ability to click-to-preview a template. By now we’ll have more templates (aim to have ~20-30). We might also allow users to mark favorites. Dependency: Design team for a polished library UI; content team for populating more items.

Collaboration & Permissions: Introduce basic role-based access if needed (for example, ensure that only authorized users can run certain workflow actions, perhaps relevant in multi-user scenarios). Also, implement any missing security features – e.g., if multiple roles use the system, respect their OAuth scopes (the Retool example shows the importance of inheriting user permissions for AI actions). Dependency: Security/Platform team for RBAC support.

Cross-team Synchronization: At this stage, coordinate a pilot program with a subset of real users or a friendly customer. Before wider launch, we want to test these features in a real environment. This involves scheduling: the LLM team must have the AI model updates ready; the Canvas team must have ensured stability of the new integrated UI; the Backend team must validate that orchestrations (especially those hitting external APIs) are working end-to-end. We’ll likely run a “alpha/beta” with close support.

Analytics Instrumentation: Add tracking for key events (e.g. how often users use chat commands, generate workflows, insert library items). This data will be useful to measure success against our UX goals later on.

Later (Q4 2026 and beyond) – Refinement, Scale, and Additional Innovations:

UX Refinement & Polish: Based on pilot feedback, refine the UI/UX. This could include improving the visual design of the canvas, adding quality-of-life features (multi-select, copy-paste of steps), better error messages from the assistant, and more guidance within the UI (like on-boarding wizards or tooltips for new features discovered to be confusing).

Performance & Scaling: Optimize performance for large workflows or heavy chat usage. For instance, ensure that the system remains responsive when a workflow has dozens of steps or when chat history grows long (maybe implement conversation truncation/summary for LLM context). If we have many concurrent users, make sure the architecture (especially Temporal and the LLM service) scales – might involve load testing and possibly model distillation or caching for the LLM.

Expanded Library & Community Sharing: Open up library contributions to users (if we see demand). This might include building a submission workflow and a review process. Also, consider a template marketplace concept if appropriate (could be an avenue for partners or the community to contribute specialized flows).

Multi-Modal and Collaboration Features: Explore adding features like real-time collaboration on a workflow (multiple users editing or viewing, with presence indicators), or multi-modal inputs (voice commands to the assistant, or attaching diagrams). These are stretch goals once the core experience is solid.

Continuous Improvement via Research: By this phase, we should have a lot of usage data and user feedback. We’ll cycle that into further improvements. Perhaps spin up targeted UX research on specific pain points uncovered (e.g. if users still find it hard to trust the AI suggestions, figure out why and improve the explanation or approval mechanism). Also, evaluate the success metrics tied to our UX goals – if some goals (like adoption of generative workflows) are not meeting targets, plan tweaks or additional education for users.

Throughout these phases, we will maintain close alignment between teams:

Design/UX will be involved in all phases to test prototypes and ensure the experiences meet user needs.

Engineering (Front-end) drives the workspace, canvas, and library implementation.

Engineering (Backend & Infra) handles orchestration, integrations, and performance tuning.

AI/ML Team iterates on the LLM prompts/models (especially in Phase 2) to ensure the assistant’s conversational abilities and generative quality improve.

Product Management coordinates the schedule and ensures that dependencies (like OAuth or Temporal integration) land on time for the features that need them.

We will use agile iterative delivery – aiming for an end of Q1 2026 internal MVP, a Q2 beta with select users, and a broader rollout in Q3 for core features. Later-phase items can be delivered via continuous updates as they become ready.

5. UX Acceptance Criteria

To validate that we’ve achieved the desired user experience, we define acceptance criteria for key scenarios. These criteria will guide our testing (both user testing and QA) and ensure the UX goals are met. Each criterion is phrased in a testable way, describing an observable behavior or outcome:

Conversational Workflow Building: Given a blank canvas and an active chat, when a user asks the assistant to create a simple workflow (e.g. “Create a workflow that pings the database and then sends me an email if a value is over X”), then the system should produce a multi-step workflow on the canvas reflecting the request, and the chat should explain what was created. Success Measure: The user can get a valid workflow of at least 3 steps via one chat command, and they report it matched their intent (tested via scenario playback).

Chat-to-Canvas Edit Loop: Given a workflow is already on the canvas, when the user issues an edit command in chat (e.g. “Remove the second step” or “Change the order: make email step last”), then the specified change is applied on the canvas within seconds and highlighted, and the assistant confirms the change in chat (e.g. “Removed Step 2”). Success Measure: The user is able to successfully modify at least 5 different aspects of a workflow using chat alone (adding, deleting, renaming steps, etc.) without errors or resorting to manual edits.

No Context Loss in Unified Workspace: When a user navigates between chat and canvas views (e.g. collapsing the chat panel to focus on canvas, then expanding it again), then the conversation history and the current canvas state remain intact and in sync. Success Measure: In user tests, no one reports “losing their place” or having to redo actions due to switching context. The state preservation will also be verified by automated tests (e.g. simulate switching views 100 times, ensure data consistency).

Generative Blueprint Revision: Given the assistant has generated a workflow draft, when the user provides a follow-up instruction (e.g. “That’s good, but add a final step to notify the VP.”), then the assistant updates the workflow accordingly without the user leaving the canvas view. Success Measure: Users can iteratively refine an AI-generated workflow with at least two rounds of natural language feedback, and they feel in control of the outcome (per post-test survey). This aligns with keeping the human-in-loop for quality.

Execution & Orchestration via Chat: When a user triggers a workflow run through the chat (e.g. “Run this workflow now” command), then the system executes it and posts live updates or a summary in the chat (e.g. “Step 1 completed, result X; Step 2 failed, error Y”), and if an error occurs, the assistant suggests next steps (retry, debug info, etc.). Success Measure: In an end-to-end test, a user can deploy and run a workflow entirely through the unified interface, and observe the outcome, without needing to go to an external system or refresh the page. They should also be able to stop or pause a running workflow via chat command.

Library Usage Ease: When a user searches the library for a term (e.g. “email”), then relevant results appear with clear names/descriptions, and when the user selects a library item to insert, then it appears on their canvas correctly configured or prompts for minimal required info. Success Measure: New users can find and import a template within, say, 2 minutes of browsing. In testing, at least 80% of participants were able to use a library template in their workflow without assistance.

Onboarding & Learnability: When a new user (with no prior exposure) starts using Harmony, then they can discover how to use the chat-canvas hybrid features through on-screen guidance (such as a tutorial overlay or example hints in the chat input). Success Measure: In a usability study, new users can accomplish a basic task (e.g. create a 3-step workflow with one AI-generated step) in their first session, and they rate the onboarding experience as satisfactory (say, 4 out of 5 on ease-of-learning).

Each of these criteria will be validated through a combination of automated integration tests (where possible) and moderated user testing sessions. They map back to our UX goals – for instance, the ability to revise a workflow via natural language (fourth criterion) directly supports the goal of a hybrid chat-canvas experience and generative workflow utility. We will treat these criteria as “exit criteria” for moving from beta to general availability: the feature isn’t done until it meets these UX conditions consistently.

6. Design & Research Briefs for Key Features

To ensure the design team deeply explores the most critical new interactions, we outline briefs for 4 key feature areas. For each, the brief describes the feature’s purpose and lists aspects for design to prototype or questions to answer via research:

a. Chat-to-Canvas Interaction Model
Brief: Design how users will invoke and control workflow editing through chat, and how those changes are visualized on the canvas. This includes the conversational UI elements (e.g. special message bubbles for confirmations or errors) and canvas highlights. Areas to explore/prototype:

Different ways to indicate AI-made changes on the canvas (glowing borders? an icon on the node? a side-by-side diff view for complex changes?). The goal is to communicate “the assistant did this change for you” clearly.

The confirmation flow for potentially destructive edits: for example, if a user says “delete step 5”, should the assistant ask “Are you sure?” in chat or perhaps require a specific confirm phrase? Designs should try a couple of approaches (explicit “Confirm” buttons in the chat vs. an undo snackbar after the fact) and test which users find more reassuring.

Inline suggestions vs. direct actions: should the assistant sometimes respond with a suggestion card (“💡 I can add a step to do X, would you like to add this?”) that the user can accept, rather than doing it immediately? This could be useful if the AI is guessing the user’s intent. The design should consider how these suggestion cards look and behave (and how they appear on the canvas if accepted).

Research question: Do users prefer typing freeform commands or clicking preset options for common tasks? For instance, if a user types “add step…”, should the UI auto-complete or show a picker of possible actions? A small usability test or A/B in prototype could shed light on whether a command palette or pure NL is more user-friendly for different types of users.

b. Unified Workspace Layout & Navigation
Brief: Determine the optimal layout and navigation paradigm for the integrated chat/canvas workspace. This is a broad design problem requiring exploration of multiple layout configurations. Areas to explore/prototype:

Layout variations: e.g. Side-by-side (chat panel on left, canvas on right) vs. stacked (chat on top, canvas below) vs. tabbed (one visible at a time with a tab or toggle to switch). The design team should mock up and, if possible, create interactive prototypes of each layout to test with users. Key feedback to gather: which layout makes users feel most in control and not overwhelmed? Which allows them to reference information in one panel while working in the other more easily?

Responsive behavior: How should the UI adapt when window is resized or on smaller devices? Possibly the chat could collapse to a floating icon or the canvas could zoom out. The brief should include designing a mobile or narrow-width view, even if primary use is desktop, to future-proof the responsiveness.

Global elements: The unified workspace will likely have a top nav or menu (for settings, profile, help). Design needs to ensure these are accessible without clutter. Maybe a thin top bar or a collapsible side menu. This also includes where notifications or alerts appear (e.g. success messages, error toasts).

Indicator of context: If the user has multiple projects or workflows open, how do they know what context the assistant is operating in? Perhaps a breadcrumb or title of the current workflow at top. The design should incorporate context labels so the user is always aware of “where” they are working (especially if in future we allow multiple canvases or chat threads).

Usability testing focus: Present users with a scenario in each prototype layout (like “add a step via chat and edit a parameter on canvas”) and observe efficiency and preference. Collect qualitative feedback: Did they notice the canvas update when using chat? Was any layout confusing? Use this to converge on the best elements of each.

c. Capability Library Experience
Brief: Design the user experience for discovering and inserting library templates or components. The library should be inviting and not just an afterthought side panel. Areas to explore/prototype:

Browsing vs. searching: The design should accommodate both use cases. Perhaps a “Library” panel that by default shows categorized suggestions (“Popular templates”, “Recently used”, “By Category: Monitoring, CI/CD, etc.”) and a search field for direct queries. Prototype how a user would switch between browsing categories and searching keywords.

Template preview: Create a design for a template detail view. E.g., when a user clicks on a template “Daily Standup Workflow”, show a modal or side drawer that has a short description, maybe a mini flow diagram or list of steps included, and a one-click “Use this template” button. The preview might also show required integrations (e.g. an icon for Slack API, Jira API if those are used, to hint “you’ll need Slack connected”).

Insertion flow: When the user chooses to use a library item, what feedback do they get? Possibly the canvas should highlight the newly added steps, or the chat could say “Imported template: Daily Standup – please configure X and Y”. Design should cover how we prompt the user for any config (like “enter your team’s Slack channel”) – maybe an inline form or guided dialog.

Empty state and encouragement: For new users (with no workflows yet), the library could be the first thing they see (“Don’t start from scratch, use a template!”). Designing a friendly empty state that nudges them to the library could improve adoption. A concept to test: a wizard that asks a few questions and then recommends a template. Is this more effective than the user manually browsing?

Research questions: How much do users trust or like templates? We could interview some target users about whether they currently use templates in other tools. Also, test findability: ask users “How would you add an email step?” and see if they go to library vs. try to craft it themselves. This will tell us if we need to make the library more prominent or integrate suggestions into chat (design overlap with the assistant suggesting library items).

d. Generative Blueprint Editor
Brief: Focus on the UX for requesting and reviewing AI-generated workflows. Since this feature can be complex, design needs to ensure users feel it’s a help, not a black box. Areas to explore/prototype:

Entry point for generation: How do users invoke this? Options to design: a dedicated “🪄 Generate Workflow” button that opens a prompt dialog (“Describe what you want to automate…”), or purely via the chat (“As an SRE, ...”). Maybe both – but we need consistency. Prototyping a modal wizard might be useful to see if users prefer a structured prompt as opposed to just typing to the assistant for this.

Output presentation: After generation, how is the draft shown? Perhaps the workflow is drawn on the canvas in a preview mode (not fully saved until confirmed). Or a summary list of steps is shown in chat first for approval. Design both scenarios: one where the canvas populates immediately (with maybe a banner “AI-generated draft – review and confirm”) versus one where nothing changes until user confirms in chat. Gather feedback on which instills more confidence.

Editing & iterating UI: When the user wants changes, do they just continue the chat, or do we provide a specialized interface? Likely continuing the chat is simplest (“Add a step, remove that”). The design should ensure the user knows they can edit – perhaps a tip or a highlighted prompt like “Not quite right? You can ask me to change something.” Also possibly allow direct canvas edits at this stage. We need to confirm through testing if users prefer to tweak the AI output by talking to the AI again or by manual adjustments. We might find more technically-oriented users jump straight to manual editing, whereas others might try telling the AI to fix it.

Trust and guidance: To increase trust, designs might include an explanation mode. For example, after generating, the assistant could annotate each step with a short rationale (design idea: hover tooltip or an info icon on each step that shows the AI’s note like “Added this because ...”). This might be too advanced for initial release, but the design team can explore lightweight ways to communicate why the AI did something, addressing user curiosity or skepticism.

Error handling in generation: If the AI says “I’m not sure what tools to use for X step,” how do we surface that? Possibly highlight that step in red or with a warning icon and message like “✖ Requires configuration or tool”. The design should consider how uncertainty or partial suggestions are displayed so users can easily identify and correct gaps.

e. Conversational Orchestration & Feedback Loop
(Optional key feature, if time permits additional focus)
Brief: As we implement the assistant executing tasks, design how those run-time actions and system messages appear in the UI. Areas to explore:

Real-time updates in chat: If the assistant is orchestrating a process (say it’s running a 5-step sequence), should it stream messages like “Step 1 done, Step 2 in progress…”? Design the style of these system messages – perhaps differentiate them visually (italic system font or prefixed with [System]). We want them clear but not too distracting.

Linking to canvas from chat updates: If a step errors out and we show that in chat, allow user to click that message to highlight the relevant step on the canvas (context linking). Prototype how clickable chat messages could work (maybe the step name in the message is underlined and clickable).

Intervention controls: What if the user wants to stop or alter a running orchestration? We should design a “Stop execution” button or voice command. Possibly an on-screen control (like a stop icon near the workflow name while running). Also consider “Step-through debugging” for future. These might be advanced, but thinking early will help place UI elements appropriately.

Each of these design briefs should result in low-to-high fidelity prototypes that we can test with users. The design team will work closely with product and engineering during this prototyping to ensure feasibility (e.g., if a certain real-time update isn’t easily available from the backend yet, we might mock it). We will use tools like Figma for prototyping the UI and possibly interactive demos for the chat interactions.

The research team (or UX designers performing research) will conduct usability testing on these prototypes. For example, moderated sessions where a user is given a scenario to complete using a prototype of the chat-to-canvas interface, thinking aloud their experience. We’ll also potentially do A/B testing during beta (if feasible) for certain UI variations (like layout or confirmation flows) to gather quantitative preference data.

Ultimately, these design explorations ensure that when engineering builds the features, we have high confidence in their usability and that they address real user needs in the Harmony UX strategy. The deliverables (wireframes, interaction flows, and test results) from these briefs will feed directly into the implementation plan and help avoid costly redesigns late in the development cycle.

By translating the Harmony UX vision into these concrete initiatives, requirements, and plans, we create a roadmap that product, design, and engineering can execute against with clarity. Each phase delivers tangible improvements tied to the strategic themes, moving from conceptual ideas (conversational orchestration, unified workspace, etc.) to shippable features. This execution plan will be used in our internal project tracker (e.g. Notion or Jira) to align teams on timelines and responsibilities, and will serve as a living document to adjust as we learn from users.