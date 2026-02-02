import {
    ComplianceEnforcementLevel,
    TenantComplianceConfig
} from '@golden/schema-registry';

/**
 * Resolves the effective enforcement level for a specific control based on tenant configuration.
 * 
 * Order of precedence:
 * 1. Control-specific override (most specific)
 * 2. Family override
 * 3. Default enforcement level (least specific)
 * 
 * @param controlId - The NIST/OSCAL control ID (e.g., "AC-2", "IA-5(1)")
 * @param config - The tenant's compliance configuration
 * @returns The resolved enforcement level
 */
export function resolveEnforcementLevel(
    controlId: string,
    config: TenantComplianceConfig
): ComplianceEnforcementLevel {
    // 1. Check control-specific override (most specific)
    const controlOverride = config.controlOverrides.find(o => o.controlId === controlId);
    if (controlOverride) return controlOverride.enforcement;

    // 2. Check family override
    // Extract family from control ID (keywords: first two letters provided standard format like "AC-2")
    const familyMatch = controlId.match(/^([A-Z]{2})/);
    if (familyMatch) {
        const family = familyMatch[1];
        const familyOverride = config.familyOverrides.find(o => o.family === family);
        if (familyOverride) return familyOverride.enforcement;
    }

    // 3. Fall back to tenant default
    return config.defaultEnforcement;
}
