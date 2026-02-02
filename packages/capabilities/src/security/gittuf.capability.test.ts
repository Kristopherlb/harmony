import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gittufCapability } from './gittuf.capability.js';

describe('Gittuf Capability', () => {
    const mockWithExec = vi.fn().mockReturnThis();
    const mockWithWorkdir = vi.fn().mockReturnThis();

    const mockContainer = {
        from: vi.fn().mockReturnThis(),
        withExec: mockWithExec,
        withWorkdir: mockWithWorkdir,
    };

    const mockDag = {
        container: vi.fn().mockReturnValue(mockContainer),
    };

    const mockContext = { config: {}, secretRefs: {} } as any;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should construct verify-ref command', () => {
        gittufCapability.factory(mockDag, mockContext, {
            operation: 'verify-ref',
            repositoryUrl: 'https://github.com/test/repo',
            ref: 'main'
        });

        expect(mockContainer.from).toHaveBeenCalledWith('alpine/git:latest');

        // Should install gittuf
        expect(mockWithExec).toHaveBeenCalledWith(expect.arrayContaining(['apk', 'add', '--no-cache', 'curl', 'tar', 'jq']));

        // Should clone
        expect(mockWithExec).toHaveBeenCalledWith(['git', 'clone', 'https://github.com/test/repo', '/repo']);

        // Should execute verify
        const execCalls = mockWithExec.mock.calls;
        const lastCall = execCalls[execCalls.length - 1][0];
        expect(lastCall[2]).toContain('OP="verify-ref"');
        expect(lastCall[2]).toContain('REF="main"');
        expect(lastCall[2]).toContain('gittuf verify-ref "$REF"');
    });
});
