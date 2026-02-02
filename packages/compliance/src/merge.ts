
export interface SSPNarrativeMerge {
    /** Original auto-generated (at time human edited) */
    base: string;

    /** Current auto-generated (from latest capabilities) */
    incoming: string;

    /** Human override */
    humanOverride: string;
}

export interface MergeConflict {
    region: any; // Placeholder for diff region
    autoVersion: string;
    humanVersion: string;
}

export interface MergeResult {
    result: string | null;
    hasConflict: boolean;
    conflicts?: MergeConflict[];
}

/**
 * Merges SSP narratives using a 3-way merge strategy.
 * 
 * Note: Full diff/merge logic requires a diff library (e.g. 'diff' or 'diff-match-patch').
 * This implementation handles non-conflicting cases and simple equality.
 */
export function mergeNarratives(merge: SSPNarrativeMerge): MergeResult {
    // 1. If no human override (should be handled by caller, but safe to check here if we treated empty string as no override)
    // But here we assume humanOverride is provided. If it's identical to base, it's trivial.

    // 2. If base === incoming, no auto-gen changes, keep human
    if (merge.base === merge.incoming) {
        return { result: merge.humanOverride, hasConflict: false };
    }

    // 3. If base === humanOverride, human didn't change anything, take incoming
    if (merge.base === merge.humanOverride) {
        return { result: merge.incoming, hasConflict: false };
    }

    // 4. If incoming === humanOverride, they converged (unlikely but possible)
    if (merge.incoming === merge.humanOverride) {
        return { result: merge.incoming, hasConflict: false };
    }

    // Fallback for complex merges without a library:
    // For now, declare conflict if both changed and they are different.
    // In a real implementation we would compute diffs.

    return {
        result: null,
        hasConflict: true,
        conflicts: [{
            region: "full-text",
            autoVersion: merge.incoming,
            humanVersion: merge.humanOverride
        }]
    };
}
