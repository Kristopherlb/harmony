import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openbaoCapability } from './openbao.capability.js';

describe('OpenBao Capability', () => {
    const mockWithExec = vi.fn().mockReturnThis();

    const mockContainer = {
        from: vi.fn().mockReturnThis(),
        withEnvVariable: vi.fn().mockReturnThis(),
        withMountedSecret: vi.fn().mockReturnThis(),
        withExec: mockWithExec,
    };

    const mockDag = {
        container: vi.fn().mockReturnValue(mockContainer),
    };

    const mockContext = {
        config: { address: 'https://vault.example.com' },
        secretRefs: { token: 'mock-token-ref' },
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should construct read command', () => {
        openbaoCapability.factory(mockDag, mockContext, {
            operation: 'read',
            path: 'app/config',
        });

        expect(mockContainer.from).toHaveBeenCalledWith('hashicorp/vault:latest');
        expect(mockContainer.withEnvVariable).toHaveBeenCalledWith('VAULT_ADDR', 'https://vault.example.com');

        expect(mockWithExec).toHaveBeenCalledTimes(1);
        const execCall = mockWithExec.mock.calls[0][0];
        expect(execCall[0]).toBe('sh');
        expect(execCall[2]).toContain('OP="read"');
        expect(execCall[2]).toContain('vault kv get');
    });

    it('should construct write command', () => {
        openbaoCapability.factory(mockDag, mockContext, {
            operation: 'write',
            path: 'app/config',
            data: { key: 'val' },
        });

        expect(mockWithExec).toHaveBeenCalledTimes(1);
        const execCall = mockWithExec.mock.calls[0][0];
        expect(execCall[2]).toContain('OP="write"');
        expect(execCall[2]).toContain('vault kv put');

        // Check that the data JSON is embedded correctly
        // The implementation stringifies input.data into the script: echo '...' > /tmp/data.json
        expect(execCall[2]).toContain('{"key":"val"}');
    });
});
