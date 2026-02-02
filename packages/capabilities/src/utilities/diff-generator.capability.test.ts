
/**
 * packages/capabilities/src/utilities/diff-generator.capability.test.ts
 * Tests for Diff Generator Capability.
 */
import { describe, it, expect } from 'vitest';
import { diffGeneratorCapability } from './diff-generator.capability.js';

describe('Diff Generator Capability', () => {
    it('has correct metadata', () => {
        expect(diffGeneratorCapability.metadata.id).toBe('golden.utilities.diff-generator');
        expect(diffGeneratorCapability.metadata.name).toBe('diffGenerator');
    });

    it('validates diff input', () => {
        const validInput = {
            operation: 'diff',
            originalContent: 'foo',
            modifiedContent: 'bar',
            format: 'unified'
        };
        expect(diffGeneratorCapability.schemas.input.safeParse(validInput).success).toBe(true);
    });

    it('validates patch input', () => {
        const validInput = {
            operation: 'apply-patch',
            originalContent: 'foo',
            patchContent: '--- a/file\n+++ b/file\n@@ -1 +1 @@\n-foo\n+bar'
        };
        expect(diffGeneratorCapability.schemas.input.safeParse(validInput).success).toBe(true);
    });

    it('rejects invalid operation', () => {
        const invalidInput = {
            operation: 'invalid-op',
        };
        expect(diffGeneratorCapability.schemas.input.safeParse(invalidInput).success).toBe(false);
    });
});
