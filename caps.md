Capabilities & Primitives Roadmap
This plan defines the next wave of capabilities and primitives to add to the Harmony platform, organized into prioritized phases with OpenSSF tooling integration.

Executive Summary
Based on analysis of the existing codebase and OpenSSF project catalog, this plan proposes 45 new capabilities across 8 categories, organized into 4 implementation phases.

Phase 1: Foundation Layer (Weeks 1-3)
IMPORTANT

These capabilities unlock downstream integrations and should be prioritized first.

Authentication & Identity
[NEW] packages/capabilities/src/auth/oauth-provider.capability.ts
Generic OAuth 2.0/OIDC client supporting authorization code, client credentials, and PKCE flows. Provides token management, refresh handling, and scope negotiation.

[NEW] packages/capabilities/src/auth/jwt-utilities.capability.ts
JWT signing (HS256, RS256, ES256), validation, claims extraction, and expiry checking. Pure transformer pattern.

Feature Flags
[NEW] packages/capabilities/src/flags/openfeature-provider.capability.ts
OpenFeature SDK wrapper providing vendor-agnostic feature flag evaluation. Supports boolean, string, number, and object flags with context propagation.

OpenSSF Security Foundation (Graduated Projects)
[NEW] packages/capabilities/src/security/sigstore.capability.ts
OpenSSF Sigstore - Keyless signing and verification using Fulcio (certificate authority) and Rekor (transparency log). Essential for software supply chain security.

[NEW] packages/capabilities/src/security/slsa-verifier.capability.ts
OpenSSF SLSA - Verify SLSA provenance attestations on artifacts. Supports levels 1-4 verification.

[NEW] packages/capabilities/src/security/scorecard.capability.ts
OpenSSF Scorecard - Automated security risk assessment for open source projects. Returns scored checks for branch protection, dependency updates, fuzzing, etc.

Utilities Closet (Transformers)
[NEW] packages/capabilities/src/utilities/hashing.capability.ts
Cryptographic hashing: MD5, SHA-1, SHA-256, SHA-512, BLAKE3. Supports streaming for large files.

[NEW] packages/capabilities/src/utilities/compression.capability.ts
File compression/decompression: zip, gzip, tar, tar.gz, 7z. Bulk operations support.

[NEW] packages/capabilities/src/utilities/encoding.capability.ts
Encoding utilities: Base64, hex, URL encoding/decoding, HTML entity encoding.

Phase 2: Security Tooling (Weeks 4-6)
OpenSSF Incubation Projects
[NEW] packages/capabilities/src/security/guac.capability.ts
OpenSSF GUAC - Graph for Understanding Artifact Composition. Query supply chain data, identify vulnerable paths, understand transitive dependencies.

[NEW] packages/capabilities/src/security/openvex.capability.ts
OpenSSF OpenVEX - Create and validate VEX (Vulnerability Exploitability eXchange) documents. Mark vulnerabilities as "not affected" or "fixed" with justification.

[NEW] packages/capabilities/src/security/gittuf.capability.ts
OpenSSF gittuf - Git repository protection using TUF (The Update Framework). Verify commit signing policies, protect against unauthorized changes.

[NEW] packages/capabilities/src/security/osv-scanner.capability.ts
OpenSSF OSV Schema - Scan dependencies against the OSV database for known vulnerabilities.

SBOM Tooling
[NEW] packages/capabilities/src/sbom/bomctl.capability.ts
OpenSSF Bomctl - SBOM manipulation CLI. Merge, split, diff SBOMs. Bridge between generators and analyzers.

[NEW] packages/capabilities/src/sbom/protobom.capability.ts
OpenSSF Protobom - Format-neutral SBOM representation. Convert between SPDX and CycloneDX.

[NEW] packages/capabilities/src/sbom/syft.capability.ts
Generate SBOMs from container images, filesystems, and archives using Syft.

Vulnerability Scanning
[NEW] packages/capabilities/src/security/trivy.capability.ts
Container image and filesystem vulnerability scanning. Supports CVE databases, misconfigurations, and secrets detection.

[NEW] packages/capabilities/src/security/grype.capability.ts
Vulnerability scanner for container images and filesystems. Pairs with Syft SBOMs.

[NEW] packages/capabilities/src/security/clamav.capability.ts
Malware/virus scanning using ClamAV. File and stream scanning support.

Phase 3: Static Analysis & Policy (Weeks 7-9)
Code Security
[NEW] packages/capabilities/src/security/semgrep.capability.ts
Static analysis using Semgrep rules. SAST for finding bugs, security issues, and anti-patterns.

[NEW] packages/capabilities/src/security/gitleaks.capability.ts
Secret detection in git repositories. Scans commit history for leaked credentials.

[NEW] packages/capabilities/src/security/checkov.capability.ts
Infrastructure-as-Code security scanning. Terraform, CloudFormation, Kubernetes misconfigurations.

OpenSSF Sandbox Projects
[NEW] packages/capabilities/src/security/minder.capability.ts
OpenSSF Minder - Security posture management with policy-as-code. Define and enforce security policies across repositories.

[NEW] packages/capabilities/src/security/package-analysis.capability.ts
OpenSSF Package Analysis - Detect malicious behavior in packages during install/runtime.

[NEW] packages/capabilities/src/security/security-insights.capability.ts
OpenSSF Security Insights - Parse and generate SECURITY-INSIGHTS.yml files for projects.

Additional Utilities
[NEW] packages/capabilities/src/utilities/json-yaml-transform.capability.ts
JSON/YAML transformations using jq-style queries. YAML to JSON conversion and vice versa.

[NEW] packages/capabilities/src/utilities/diff-generator.capability.ts
Generate unified diffs between files or strings. Patch generation and application.

[NEW] packages/capabilities/src/utilities/template-renderer.capability.ts
Template rendering using Handlebars/Mustache syntax. Variable substitution, loops, conditionals.

Phase 4: Enterprise Connectors (Weeks 10-12)
Cloud SDKs
[NEW] packages/capabilities/src/connectors/aws-sdk.capability.ts
AWS SDK wrapper for common operations: S3 (upload/download), STS (assume role), Lambda (invoke), SSM (parameters).

[NEW] packages/capabilities/src/connectors/postgres.capability.ts
PostgreSQL connector for query execution, transactions, and connection pooling.

[NEW] packages/capabilities/src/connectors/redis.capability.ts
Redis connector for cache operations, pub/sub, and sorted sets.

Communication
[NEW] packages/capabilities/src/connectors/slack.capability.ts
Slack API connector: post messages, manage channels, handle reactions, upload files.

[NEW] packages/capabilities/src/connectors/pagerduty.capability.ts
PagerDuty connector: create/resolve incidents, manage on-call schedules.

Infrastructure Commanders
[NEW] packages/capabilities/src/commanders/terraform.capability.ts
Terraform CLI wrapper: init, plan, apply, destroy. State management and variable injection.

[NEW] packages/capabilities/src/commanders/kubectl.capability.ts
Kubectl wrapper: get, apply, delete, logs, exec. Namespace and context management.

OpenSSF Additional
[NEW] packages/capabilities/src/security/model-signing.capability.ts
OpenSSF Model Signing - Sign and verify ML models for AI/ML pipeline security.

[NEW] packages/capabilities/src/security/tuf-repository.capability.ts
OpenSSF Repository Service for TUF - Secure artifact distribution using The Update Framework.

OpenSSF Project Evaluation Matrix
Project	Stage	Recommendation	Rationale
Sigstore	Graduated	✅ Must Have	Keyless signing is the future of artifact provenance
SLSA	Graduated	✅ Must Have	Supply chain security baseline
Scorecard	Graduated	✅ Must Have	Automated security risk assessment
GUAC	Incubating	✅ High Value	Supply chain graph queries
OpenVEX	Incubating	✅ High Value	VEX for vuln management
gittuf	Incubating	🟡 Medium	Git security, less common
OSV Schema	Sandbox	✅ High Value	Vulnerability database access
Bomctl	Incubating	✅ High Value	SBOM manipulation essential
Protobom	Incubating	🟡 Medium	SBOM format conversion
Minder	Incubating	🟡 Medium	Policy engine, complex setup
OpenBao	Incubating	✅ Already Using	You have secret-broker!
Model Signing	Incubating	🟡 If AI/ML	Only if doing ML pipelines
TUF Repo Service	Incubating	🟠 Later	Advanced artifact distribution
Package Analysis	Sandbox	🟡 Medium	Niche malware detection
Security Insights	Sandbox	🟢 Easy Win	Simple YAML parsing
Zarf	Incubating	🟠 Niche	Air-gapped deployments only
Best Practices Badge	Graduated	🟢 Read-only	API to check badge status
Criticality Score	Sandbox	🟢 Easy Win	API-based scoring
Fuzz Introspector	Sandbox	🟠 Later	Advanced fuzzing support
Gemara	Sandbox	🟠 Later	Governance models, abstract
SBOMit	Sandbox	🟠 Later	Attestation spec, bleeding edge
New Core Primitives
These support the capabilities above:

Binders
Primitive	Location	Purpose
OAuth Token Broker	packages/core/src/binders/oauth-broker.ts	Token lifecycle management, caching, refresh
Feature Flag Provider	packages/core/src/binders/flag-provider.ts	OpenFeature provider abstraction
Schemas
Schema	Location	Purpose
SBOM Schema	packages/schema-registry/src/sbom.ts	CycloneDX/SPDX validation
VEX Schema	packages/schema-registry/src/vex.ts	OpenVEX document validation
SLSA Provenance	packages/schema-registry/src/slsa.ts	SLSA attestation validation
Directory Structure Changes
packages/capabilities/src/
├── auth/                    # NEW - OAuth, JWT, SAML
├── connectors/              # Existing (GitHub, Jira)
│   ├── aws-sdk.capability.ts
│   ├── postgres.capability.ts
│   ├── redis.capability.ts
│   ├── slack.capability.ts
│   └── pagerduty.capability.ts
├── commanders/              # NEW - CLI wrappers
│   ├── terraform.capability.ts
│   └── kubectl.capability.ts
├── demo/                    # Existing
├── flags/                   # NEW - Feature flags
├── sbom/                    # NEW - SBOM tooling
│   ├── bomctl.capability.ts
│   ├── protobom.capability.ts
│   └── syft.capability.ts
├── security/                # NEW - Security scanning
│   ├── clamav.capability.ts
│   ├── checkov.capability.ts
│   ├── gitleaks.capability.ts
│   ├── grype.capability.ts
│   ├── guac.capability.ts
│   ├── gittuf.capability.ts
│   ├── minder.capability.ts
│   ├── model-signing.capability.ts
│   ├── openvex.capability.ts
│   ├── osv-scanner.capability.ts
│   ├── package-analysis.capability.ts
│   ├── scorecard.capability.ts
│   ├── security-insights.capability.ts
│   ├── semgrep.capability.ts
│   ├── sigstore.capability.ts
│   ├── slsa-verifier.capability.ts
│   ├── trivy.capability.ts
│   └── tuf-repository.capability.ts
└── utilities/               # NEW - Transformer utilities
    ├── compression.capability.ts
    ├── diff-generator.capability.ts
    ├── encoding.capability.ts
    ├── hashing.capability.ts
    ├── json-yaml-transform.capability.ts
    └── template-renderer.capability.ts
Recommended Priority Order
Week 1: Foundation
oauth-provider - Unlocks authenticated integrations
jwt-utilities - Token handling
openfeature-provider - Feature flags
hashing - Basic utility
encoding - Basic utility
Week 2: OpenSSF Core
sigstore - Keyless signing (Graduated)
slsa-verifier - Supply chain verification (Graduated)
scorecard - Security assessment (Graduated)
osv-scanner - Vulnerability scanning
compression - Basic utility
Week 3: SBOM Pipeline
syft - SBOM generation
bomctl - SBOM manipulation
grype - Vulnerability scanning
trivy - Container scanning
clamav - Malware scanning
Week 4+: Expand as needed
Static analysis (semgrep, gitleaks, checkov)
GUAC for dependency graph
Enterprise connectors (AWS, Postgres, Slack)
Commanders (Terraform, kubectl)
Verification Plan
Since this is a planning document, verification will happen during implementation. For each capability:

Automated Tests
Each capability will have a *.capability.test.ts file following existing patterns
Run with: pnpm nx test capabilities
Integration Verification
Capabilities will be validated by running through the MCP server demo
Command: pnpm nx run harmony:dev-demo-local
Manual Verification
User will validate that generated capabilities integrate with the existing createCapabilityRegistry pattern
User will verify OpenSSF tools are correctly containerized in Dagger
Questions for User
ML/AI pipelines: Do you need Model Signing (OMS) for AI model provenance?
Air-gapped deployments: Is Zarf relevant for disconnected environments?
Policy engine: Should Minder be prioritized for security policy enforcement?
Cloud providers: AWS first, or should GCP/Azure be added simultaneously?
Phase timing: Is the 3-week-per-phase cadence realistic for your team?

Comment
⌥⌘M
