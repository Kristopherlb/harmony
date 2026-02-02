import { describe, it, expect, vi, beforeEach } from 'vitest';
import { modelSigningCapability } from './model-signing.capability.js';

describe('Model Signing Capability', () => {
    const mockWithExec = vi.fn().mockReturnThis();
    const mockWithEnvVariable = vi.fn().mockReturnThis();

    const mockContainer = {
        from: vi.fn().mockReturnThis(),
        withExec: mockWithExec,
        withEnvVariable: mockWithEnvVariable,
    };

    const mockDag = {
        container: vi.fn().mockReturnValue(mockContainer),
    };

    const mockContext = { config: {}, secretRefs: {} } as any;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should construct sign-model command', () => {
        modelSigningCapability.factory(mockDag, mockContext, {
            operation: 'sign-model',
            modelPath: '/app/model.pt',
            keyData: 'mock-key'
        });

        expect(mockContainer.from).toHaveBeenCalledWith('cgr.dev/chainguard/cosign:latest');
        expect(mockWithEnvVariable).toHaveBeenCalledWith('COSIGN_KEY', 'mock-key');

        const execCall = mockWithExec.mock.calls[0][0];
        expect(execCall[2]).toContain('OP="sign-model"');
        expect(execCall[2]).toContain('cosign sign-blob');
    });

    it('should construct verify-model command', () => {
        modelSigningCapability.factory(mockDag, mockContext, {
            operation: 'verify-model',
            modelPath: '/app/model.pt',
            signaturePath: '/app/model.pt.sig'
        });

        const execCall = mockWithExec.mock.calls[0][0];
        expect(execCall[2]).toContain('OP="verify-model"');
        expect(execCall[2]).toContain('cosign verify-blob');
    });
});
