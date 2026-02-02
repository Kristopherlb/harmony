import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tufRepositoryCapability } from './tuf-repository.capability.js';

describe('TUF Repository Capability', () => {
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

    it('should construct init-repo command', () => {
        tufRepositoryCapability.factory(mockDag, mockContext, {
            operation: 'init-repo',
            repoPath: '/tmp/repo'
        });

        expect(mockContainer.from).toHaveBeenCalledWith('python:3.11-alpine');
        expect(mockWithExec).toHaveBeenCalledWith(['pip', 'install', 'tuf']);

        const execCall = mockWithExec.mock.calls[1][0];
        expect(execCall[2]).toContain('OP="init-repo"');
        expect(execCall[2]).toContain('REPO="/tmp/repo"');
        expect(execCall[2]).toContain('from tuf.repository_tool import create_new_repository');
    });
});
