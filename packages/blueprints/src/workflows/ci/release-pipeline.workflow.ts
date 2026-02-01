/**
 * packages/blueprints/src/workflows/ci/release-pipeline.workflow.ts
 * Release Pipeline Blueprint (WCS-001)
 *
 * Full release pipeline: certification, security scans, OSCAL generation,
 * and artifact bundling. Composes existing capabilities.
 */
import { BaseBlueprint } from '@golden/core/workflow';
import { z } from '@golden/schema-registry';

export interface ReleasePipelineInput {
  /** Release version (e.g., "2.0.0") */
  version: string;
  /** Git commit SHA */
  gitSha: string;
  /** Path to context for scanning */
  contextPath: string;
  /** Paths to scan for capabilities/blueprints */
  artifactPaths?: string[];
  /** Skip specific checks */
  skipChecks?: string[];
  /** Continue on security warnings */
  continueOnWarning?: boolean;
}

export interface ReleasePipelineOutput {
  /** Overall status */
  status: 'PASS' | 'FAIL';
  /** Release version */
  version: string;
  /** Path to release manifest */
  manifestPath: string;
  /** Artifact paths */
  artifacts: {
    certification: string;
    oscal: string;
    trivy: string;
    gitleaks: string;
    sbom: string;
    flags: string;
  };
  /** Summary of results */
  summary: {
    certificationStatus: 'PASS' | 'FAIL';
    vulnerabilityCount: number;
    secretLeaksCount: number;
    controlsCovered: string[];
  };
}

export interface ReleasePipelineConfig {
  /** Output directory for artifacts */
  outputDir?: string;
  /** Fail on security warnings */
  failOnWarning?: boolean;
  /** Trivy severity filter */
  trivySeverities?: string[];
}

export class ReleasePipelineWorkflow extends BaseBlueprint<
  ReleasePipelineInput,
  ReleasePipelineOutput,
  ReleasePipelineConfig
> {
  readonly metadata = {
    id: 'blueprints.ci.release-pipeline',
    version: '1.0.0',
    name: 'Release Pipeline',
    description:
      'Full release pipeline: certification, security scans (Trivy, Gitleaks, Syft), OSCAL generation, and artifact bundling. Composes existing capabilities.',
    owner: 'platform',
    costCenter: 'CC-0',
    tags: ['ci', 'release', 'compliance', 'security'],
  };

  readonly security = {
    requiredRoles: ['ci:release'],
    classification: 'INTERNAL' as const,
    oscalControlIds: ['CM-3', 'SA-11', 'AU-2'],
  };

  readonly operations = {
    sla: { targetDuration: '15m', maxDuration: '30m' },
    alerting: { errorRateThreshold: 0.1 },
  };

  readonly inputSchema = z.object({
    version: z.string().describe('Release version'),
    gitSha: z.string().describe('Git commit SHA'),
    contextPath: z.string().describe('Path to context for scanning'),
    artifactPaths: z.array(z.string()).optional().describe('Paths to audit'),
    skipChecks: z.array(z.string()).optional().describe('Checks to skip'),
    continueOnWarning: z.boolean().optional().describe('Continue on warnings'),
  }) as BaseBlueprint<ReleasePipelineInput, ReleasePipelineOutput, ReleasePipelineConfig>['inputSchema'];

  readonly configSchema = z.object({
    outputDir: z.string().optional(),
    failOnWarning: z.boolean().optional(),
    trivySeverities: z.array(z.string()).optional(),
  }) as BaseBlueprint<ReleasePipelineInput, ReleasePipelineOutput, ReleasePipelineConfig>['configSchema'];

  protected async logic(
    input: ReleasePipelineInput,
    config: ReleasePipelineConfig
  ): Promise<ReleasePipelineOutput> {
    const outputDir = config.outputDir ?? 'dist';
    const failOnWarning = config.failOnWarning ?? false;

    // Step 1: Run certification (CAS-001)
    const certification = await this.executeById<
      {
        operation: string;
        gitSha: string;
        failOnWarning: boolean;
        artifactPaths?: string[];
        skipChecks?: string[];
      },
      { status: 'PASS' | 'FAIL'; reportPath: string; audits: unknown[] }
    >('golden.ci.certify', {
      operation: 'full',
      gitSha: input.gitSha,
      failOnWarning,
      artifactPaths: input.artifactPaths,
      skipChecks: input.skipChecks,
    });

    // Fail early if certification fails
    if (certification.status !== 'PASS') {
      return {
        status: 'FAIL',
        version: input.version,
        manifestPath: '',
        artifacts: {
          certification: certification.reportPath,
          oscal: '',
          trivy: '',
          gitleaks: '',
          sbom: '',
          flags: '',
        },
        summary: {
          certificationStatus: certification.status,
          vulnerabilityCount: 0,
          secretLeaksCount: 0,
          controlsCovered: [],
        },
      };
    }

    // Step 2: Run security scans in parallel (composing EXISTING capabilities)
    const [trivyResult, gitleaksResult, sbomResult] = await Promise.all([
      // Trivy vulnerability scan
      this.executeById<
        { target: string; scanType: string; severities?: string[] },
        { vulnerabilities: unknown[]; summary: { critical: number; high: number; medium: number; low: number } }
      >('golden.security.trivy-scanner', {
        target: input.contextPath,
        scanType: 'filesystem',
        severities: config.trivySeverities ?? ['CRITICAL', 'HIGH'],
      }),

      // Gitleaks secret scan
      this.executeById<
        { operation: string; source: string; redact: boolean },
        { findings: unknown[]; findingsCount: number; exitCode: number }
      >('golden.security.gitleaks', {
        operation: 'detect',
        source: input.contextPath,
        redact: true,
      }),

      // Syft SBOM generation
      this.executeById<
        { sourceType: string; source: string; format: string },
        { sbom: string; packageCount: number }
      >('golden.sbom.syft', {
        sourceType: 'directory',
        source: input.contextPath,
        format: 'cyclonedx-json',
      }),
    ]);

    // Check for critical security issues
    const vulnerabilityCount =
      trivyResult.vulnerabilities?.length ??
      (trivyResult.summary?.critical ?? 0) + (trivyResult.summary?.high ?? 0);
    const secretLeaksCount = gitleaksResult.findingsCount ?? 0;

    // Step 3: Generate OSCAL Component Definition
    const oscalResult = await this.executeById<
      { operation: string; title: string; version: string },
      { outputPath: string; controlsCovered: string[]; controlCount: number }
    >('golden.ci.oscal-generator', {
      operation: 'generate',
      title: 'Harmony Platform',
      version: input.version,
    });

    // Step 4: Generate feature flags for release
    const flagsResult = await this.executeById<
      { operation: string; releaseVersion: string },
      { flagdConfigPath: string; flagsGenerated: unknown[] }
    >('golden.flags.auto-feature-flag', {
      operation: 'generateReleaseFlags',
      releaseVersion: input.version,
    });

    // Step 5: Bundle release manifest
    const manifestResult = await this.executeById<
      {
        operation: string;
        version: string;
        gitSha: string;
        certificationPath: string;
        certificationStatus: 'PASS' | 'FAIL' | 'UNKNOWN';
        oscalPath: string;
        oscalControlsCovered?: string[];
        security: { trivyScanPath: string; gitleaksScanPath: string; sbomPath: string };
        securitySummary?: { vulnerabilities?: number; secretLeaks?: number; sbomPackages?: number };
        flagsConfigPath: string;
        flagCount?: number;
      },
      { manifestPath: string }
    >('golden.ci.release-manifest', {
      operation: 'generate',
      version: input.version,
      gitSha: input.gitSha,
      certificationPath: certification.reportPath,
      certificationStatus: certification.status === 'PASS' ? 'PASS' : 'FAIL',
      oscalPath: oscalResult.outputPath,
      oscalControlsCovered: oscalResult.controlsCovered,
      security: {
        trivyScanPath: `${outputDir}/security/trivy.json`,
        gitleaksScanPath: `${outputDir}/security/gitleaks.json`,
        sbomPath: `${outputDir}/sbom/sbom.json`,
      },
      securitySummary: {
        vulnerabilities: vulnerabilityCount,
        secretLeaks: secretLeaksCount,
        sbomPackages: sbomResult.packageCount,
      },
      flagsConfigPath: flagsResult.flagdConfigPath,
      flagCount: flagsResult.flagsGenerated?.length,
    });

    // Determine overall status
    const hasSecurityIssues =
      vulnerabilityCount > 0 || (secretLeaksCount > 0 && !input.continueOnWarning);
    const overallStatus = hasSecurityIssues ? 'FAIL' : 'PASS';

    return {
      status: overallStatus,
      version: input.version,
      manifestPath: manifestResult.manifestPath,
      artifacts: {
        certification: certification.reportPath,
        oscal: oscalResult.outputPath,
        trivy: `${outputDir}/security/trivy.json`,
        gitleaks: `${outputDir}/security/gitleaks.json`,
        sbom: `${outputDir}/sbom/sbom.json`,
        flags: flagsResult.flagdConfigPath,
      },
      summary: {
        certificationStatus: certification.status,
        vulnerabilityCount,
        secretLeaksCount,
        controlsCovered: oscalResult.controlsCovered,
      },
    };
  }
}
