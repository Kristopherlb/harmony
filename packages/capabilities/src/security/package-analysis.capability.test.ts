import { describe, it, expect, vi, beforeEach } from 'vitest';
import { packageAnalysisCapability } from './package-analysis.capability.js';

describe('Package Analysis Capability', () => {
    const mockWithExec = vi.fn().mockReturnThis();

    const mockContainer = {
        from: vi.fn().mockReturnThis(),
        withExec: mockWithExec,
    };

    const mockDag = {
        container: vi.fn().mockReturnValue(mockContainer),
    };

    const mockContext = { config: {}, secretRefs: {} } as any;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should construct scan command using osv-scanner', () => {
        packageAnalysisCapability.factory(mockDag, mockContext, {
            target: './package-lock.json'
        });

        expect(mockContainer.from).toHaveBeenCalledWith('ghcr.io/google/osv-scanner:latest');

        const execCall = mockWithExec.mock.calls[0][0];
        expect(execCall[2]).toContain('TARGET="./package-lock.json"');
        expect(execCall[2]).toContain('osv-scanner -r -L --json "$TARGET"');
    });
});
