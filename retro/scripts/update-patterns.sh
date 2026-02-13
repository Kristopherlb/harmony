#!/bin/bash
#
# update-patterns.sh — Extract patterns from a retrospective and update PATTERNS.md
#
# Usage: ./update-patterns.sh <retrospective-file>
#
# This is a helper that prompts you through pattern extraction.
# For full automation, patterns should be manually curated.
#

set -e

RETRO_FILE="${1:-}"
PATTERNS_FILE="retrospectives/PATTERNS.md"

if [ -z "$RETRO_FILE" ]; then
  echo "Usage: $0 <retrospective-file>"
  echo "Example: $0 retrospectives/sessions/2026-02-01-oscal-compass.md"
  exit 1
fi

if [ ! -f "$RETRO_FILE" ]; then
  echo "Error: File not found: $RETRO_FILE"
  exit 1
fi

echo "# Pattern Extraction"
echo ""
echo "Analyzing: $RETRO_FILE"
echo ""

# Extract session identifier
SESSION=$(basename "$RETRO_FILE" .md)

echo "## Potential Friction Patterns (🔴)"
echo ""
echo "Lines containing friction indicators:"
echo ""
grep -in "could.*better\|slow\|manual\|friction\|missing\|had to\|wasted" "$RETRO_FILE" | head -10 || echo "(none found)"
echo ""

echo "## Potential Success Patterns (🟢)"
echo ""
echo "Lines containing success indicators:"
echo ""
grep -in "went well\|worked\|efficient\|saved\|helped\|effective" "$RETRO_FILE" | head -10 || echo "(none found)"
echo ""

echo "## Recommendations to Track"
echo ""
echo "Lines containing recommendations:"
echo ""
grep -in "recommend\|should\|create\|add\|build\|implement" "$RETRO_FILE" | head -10 || echo "(none found)"
echo ""

echo "---"
echo ""
echo "## Next Steps"
echo ""
echo "1. Review the patterns above"
echo "2. For each significant pattern, add to $PATTERNS_FILE:"
echo ""
echo '   ### 🔴 [Pattern Name]'
echo "   **Occurrences:** 1 ($SESSION)"
echo '   **Description:** [What happened]'
echo '   **Impact:** [Time/effort lost]'
echo '   **Resolution:** [Proposed fix]'
echo ""
echo "3. For recommendations, add to retrospectives/IMPROVEMENTS.md with IMP-XXX ID"
echo ""
echo "---"
echo "_Run manually to curate patterns. Full automation may miss nuance._"
