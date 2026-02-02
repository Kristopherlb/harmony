import { describe, it, expect, vi } from 'vitest';
import { kubectlCapability } from './kubectl.capability.js';

describe('Kubectl Capability', () => {
    // Mock Dagger
    const mockContainer = {
        from: vi.fn().mockReturnThis(),
        withNewFile: vi.fn().mockReturnThis(),
        withExec: vi.fn().mockReturnThis(),
    };
    const mockDag = {
        container: vi.fn().mockReturnValue(mockContainer),
    };

    const mockContext = {
        config: {},
        secretRefs: {},
    } as any;

    it('should construct apply command', () => {
        kubectlCapability.factory(mockDag, mockContext, {
            operation: 'apply',
            manifest: 'apiVersion: v1\nkind: Pod...',
            namespace: 'test-ns'
        });

        expect(mockContainer.from).toHaveBeenCalledWith('bitnami/kubectl:latest');
        expect(mockContainer.withNewFile).toHaveBeenCalledWith('/tmp/manifest.yaml', expect.stringContaining('apiVersion'));
        expect(mockContainer.withExec).toHaveBeenCalledWith([
            'kubectl', 'apply', '-f', '/tmp/manifest.yaml', '-n', 'test-ns'
        ]);
    });

    it('should construct get command with json output', () => {
        kubectlCapability.factory(mockDag, mockContext, {
            operation: 'get',
            manifest: 'pods',
            resourceName: 'my-pod'
        });

        expect(mockContainer.withExec).toHaveBeenCalledWith([
            'kubectl', 'get', 'pods', 'my-pod', '-o', 'json'
        ]);
    });

    it('should construct exec command', () => {
        kubectlCapability.factory(mockDag, mockContext, {
            operation: 'exec',
            resourceName: 'my-pod',
            command: ['/bin/sh', '-c', 'ls']
        });

        expect(mockContainer.withExec).toHaveBeenCalledWith([
            'kubectl', 'exec', 'my-pod', '--', '/bin/sh', '-c', 'ls'
        ]);
    });
});
