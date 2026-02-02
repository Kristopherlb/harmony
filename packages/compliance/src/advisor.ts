import {
    ComplianceCheckResult,
    ComplianceEnforcementLevel,
    TenantComplianceConfig,
    CapabilityCompliance
} from '@golden/schema-registry';
import { resolveEnforcementLevel } from './enforcement.js';

export interface InvolvedCapability {
    id: string;
    compliance?: CapabilityCompliance;
}

export class ComplianceAdvisor {
    /**
     * Run a pre-execution compliance check for a set of capabilities.
     */
    static check(
        involvedCapabilities: InvolvedCapability[],
        config: TenantComplianceConfig
    ): ComplianceCheckResult {
        // 1. Check if compliance is enabled
        if (!config.enabled) {
            return this.pass("Compliance checks disabled for tenant");
        }

        const satisfiedControls = new Map<string, string[]>(); // controlId -> capabilityIds[]
        const requiredControls = new Map<string, string>(); // controlId -> requestingCapabilityId

        // 2. Gather satisfies/requires from all capabilities
        for (const cap of involvedCapabilities) {
            if (!cap.compliance) continue;

            // Aggregate satisfied controls
            for (const controlId of cap.compliance.satisfiesControls) {
                if (!satisfiedControls.has(controlId)) {
                    satisfiedControls.set(controlId, []);
                }
                satisfiedControls.get(controlId)!.push(cap.id);
            }

            // Aggregate required controls
            if (cap.compliance.requiresControls) {
                for (const controlId of cap.compliance.requiresControls) {
                    // Record the first capability that requires it (simplification for now)
                    if (!requiredControls.has(controlId)) {
                        requiredControls.set(controlId, cap.id);
                    }
                }
            }
        }

        const unsatisfied: ComplianceCheckResult['unsatisfiedControls'] = [];
        let maxEnforcement: ComplianceEnforcementLevel | 'NONE' = 'NONE';
        let blockReason: string | undefined;

        // 3. Gap Analysis
        for (const [controlId, requiredBy] of requiredControls) {
            if (!satisfiedControls.has(controlId)) {
                // Gap detected
                const enforcement = resolveEnforcementLevel(controlId, config);

                unsatisfied.push({
                    controlId,
                    requiredBy,
                    enforcementLevel: enforcement,
                    recommendations: [] // In future: lookup capabilities that satisfy this
                });

                // Update max enforcement level seen so far
                maxEnforcement = this.escalateEnforcement(maxEnforcement, enforcement);

                if (enforcement === 'BLOCKING') {
                    blockReason = `Blocking control ${controlId} is required by ${requiredBy} but not satisfied.`;
                }
            }
        }

        // 4. Determine final result
        const resultDetails: ComplianceCheckResult = {
            canProceed: maxEnforcement !== 'BLOCKING',
            enforcementLevel: maxEnforcement as ComplianceEnforcementLevel, // 'NONE' maps to one of the levels or handled
            satisfiedControls: Array.from(satisfiedControls.entries()).map(([controlId, satisfiedBy]) => ({
                controlId,
                satisfiedBy
            })),
            unsatisfiedControls: unsatisfied,
            remediationOptions: [],
            attestationRequired: false
        };

        if (maxEnforcement === 'BLOCKING') {
            resultDetails.blockReason = blockReason;
            resultDetails.remediationOptions.push({
                type: 'ADD_CAPABILITY',
                description: 'Add a capability that satisfies the missing controls',
                actionPayload: {}
            });
        } else if (maxEnforcement === 'WARNING') {
            resultDetails.remediationOptions.push({
                type: 'ACKNOWLEDGE_WARNING',
                description: 'Acknowledge missing controls to proceed',
                actionPayload: {}
            });
        }

        // Handle 'NONE' case (no gaps found) -> effectively ADVISORY or just PASS
        if (resultDetails.unsatisfiedControls.length === 0) {
            resultDetails.enforcementLevel = 'ADVISORY'; // Default if no issues
        } else if (maxEnforcement === 'NONE') {
            // Should not happen if unsatisfied list is not empty
            resultDetails.enforcementLevel = 'ADVISORY';
        }

        return resultDetails;
    }

    private static pass(reason?: string): ComplianceCheckResult {
        return {
            canProceed: true,
            enforcementLevel: 'ADVISORY',
            satisfiedControls: [],
            unsatisfiedControls: [],
            remediationOptions: [],
            attestationRequired: false,
            blockReason: reason
        };
    }

    private static escalateEnforcement(
        current: ComplianceEnforcementLevel | 'NONE',
        incoming: ComplianceEnforcementLevel
    ): ComplianceEnforcementLevel {
        if (current === 'BLOCKING' || incoming === 'BLOCKING') return 'BLOCKING';
        if (current === 'WARNING' || incoming === 'WARNING') return 'WARNING';
        if (current === 'ADVISORY' || incoming === 'ADVISORY') return 'ADVISORY';
        return incoming;
    }
}
