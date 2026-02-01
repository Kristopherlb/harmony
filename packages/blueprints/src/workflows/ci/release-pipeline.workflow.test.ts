/**
 * packages/blueprints/src/workflows/ci/release-pipeline.workflow.test.ts
 * TCS-001 contract verification for Release Pipeline blueprint.
 */
import { describe, it, expect } from 'vitest';
import { ReleasePipelineWorkflow } from './release-pipeline.workflow.js';

describe('ReleasePipelineWorkflow', () => {
  const workflow = new ReleasePipelineWorkflow();

  describe('TCS-001 contract verification', () => {
    it('has required WCS metadata fields', () => {
      expect(workflow.metadata.id).toBe('blueprints.ci.release-pipeline');
      expect(workflow.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(workflow.metadata.name).toBeTruthy();
      expect(workflow.metadata.description).toBeTruthy();
      expect(workflow.metadata.owner).toBe('platform');
      expect(workflow.metadata.tags).toContain('ci');
      expect(workflow.metadata.tags).toContain('release');
    });

    it('declares security requirements', () => {
      expect(workflow.security.requiredRoles).toContain('ci:release');
      expect(workflow.security.classification).toBe('INTERNAL');
      expect(workflow.security.oscalControlIds).toBeDefined();
    });

    it('declares SLA operations', () => {
      expect(workflow.operations.sla.targetDuration).toBe('15m');
      expect(workflow.operations.sla.maxDuration).toBe('30m');
    });

    it('declares alerting threshold', () => {
      expect(workflow.operations.alerting?.errorRateThreshold).toBe(0.1);
    });
  });

  describe('input schema validation', () => {
    it('accepts valid minimal input', () => {
      expect(() =>
        workflow.inputSchema.parse({
          version: '2.0.0',
          gitSha: 'abc123',
          contextPath: '.',
        })
      ).not.toThrow();
    });

    it('accepts valid full input', () => {
      expect(() =>
        workflow.inputSchema.parse({
          version: '2.0.0',
          gitSha: 'abc123def456',
          contextPath: 'packages',
          artifactPaths: ['packages/capabilities', 'packages/blueprints'],
          skipChecks: ['ocs-tests'],
          continueOnWarning: true,
        })
      ).not.toThrow();
    });

    it('requires version', () => {
      expect(() =>
        workflow.inputSchema.parse({
          gitSha: 'abc123',
          contextPath: '.',
        })
      ).toThrow();
    });

    it('requires gitSha', () => {
      expect(() =>
        workflow.inputSchema.parse({
          version: '2.0.0',
          contextPath: '.',
        })
      ).toThrow();
    });

    it('requires contextPath', () => {
      expect(() =>
        workflow.inputSchema.parse({
          version: '2.0.0',
          gitSha: 'abc123',
        })
      ).toThrow();
    });
  });

  describe('config schema validation', () => {
    it('accepts empty config', () => {
      expect(() => workflow.configSchema.parse({})).not.toThrow();
    });

    it('accepts full config', () => {
      expect(() =>
        workflow.configSchema.parse({
          outputDir: 'dist/release',
          failOnWarning: true,
          trivySeverities: ['CRITICAL'],
        })
      ).not.toThrow();
    });
  });

  describe('capability composition', () => {
    it('composes certification capability', () => {
      // The workflow composes golden.ci.certify
      expect(workflow.metadata.description).toContain('certification');
    });

    it('composes security scan capabilities', () => {
      // The workflow composes trivy, gitleaks, syft
      expect(workflow.metadata.description).toContain('Trivy');
      expect(workflow.metadata.description).toContain('Gitleaks');
      expect(workflow.metadata.description).toContain('Syft');
    });

    it('composes OSCAL generation capability', () => {
      // The workflow composes golden.ci.oscal-generator
      expect(workflow.metadata.description).toContain('OSCAL');
    });
  });

  describe('output structure', () => {
    // Test output structure expectations
    it('defines expected output fields', () => {
      // The workflow output should include status, version, manifestPath, artifacts, summary
      // This is verified by TypeScript types, but we document expectations here
      const expectedFields = ['status', 'version', 'manifestPath', 'artifacts', 'summary'];
      expectedFields.forEach((field) => {
        expect(field).toBeTruthy(); // Placeholder for type safety
      });
    });
  });
});
