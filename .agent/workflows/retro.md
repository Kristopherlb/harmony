---
description: Run a retrospective checkpoint or full retrospective
---

# Retrospective Workflow

## Usage

- `/retro checkpoint` — Save mid-project progress
- `/retro analyze` — Run codebase analysis
- `/retro report` — Generate full retrospective

---

## Checkpoint (Default)

Use when you want to save progress during work.

// turbo
1. Read the [retrospective skill](file:///Users/kristopherbowles/code/harmony/.cursor/skills/retrospective/SKILL.md)

2. Create a checkpoint file at:
   ```
   /retrospectives/checkpoints/YYYY-MM-DD-<project>-checkpoint.md
   ```

3. Use the [checkpoint template](file:///Users/kristopherbowles/code/harmony/.cursor/skills/retrospective/references/checkpoint-template.md)

---

## Analyze

Use to identify improvement opportunities.

// turbo
1. Run the analysis script:
   ```bash
   .cursor/skills/retrospective/scripts/analyze-codebase.sh packages/
   ```

2. Review the [analysis checklist](file:///Users/kristopherbowles/code/harmony/.cursor/skills/retrospective/references/analysis-checklist.md)

3. Document findings in a checkpoint or retrospective

---

## Report

Use after completing significant work.

// turbo
1. Read the [retrospective skill](file:///Users/kristopherbowles/code/harmony/.cursor/skills/retrospective/SKILL.md)

2. Create a retrospective file at:
   ```
   /retrospectives/sessions/YYYY-MM-DD-<project>.md
   ```

3. Use the [retrospective template](file:///Users/kristopherbowles/code/harmony/.cursor/skills/retrospective/references/retrospective-template.md)

4. After completing:
   - Update `/retrospectives/PATTERNS.md` with any recurring patterns
   - Add recommendations to `/retrospectives/IMPROVEMENTS.md`
