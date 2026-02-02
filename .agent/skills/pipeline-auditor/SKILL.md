---
name: self-auditing-pipeline
description: Build a self-auditing CI/CD pipeline using Harmony security capabilities.
---

# Self-Auditing Pipeline Skill

This skill guides you through constructing a secure, self-auditing pipeline that enforces policy-as-code gates using the Harmony platform.

## Pipeline Architecture

1.  **Source Stage**: `gittuf` verification.
2.  **Build Stage**: `slsa-verifier` for provenance.
3.  **Security Stage**: `minder` policy evaluation + `osv-scanner` check.
4.  **Artifact Stage**: `sigstore` signing.

## Steps

### 1. Verify Source Integrity
Use `gittuf` to ensure the checkout matches the reference state policy.

```typescript
const verification = await agent.run('golden.security.gittuf', {
  operation: 'verify-ref',
  repositoryUrl: '...',
  ref: 'main'
});
if (!verification.success) throw new Error("Source verification failed");
```

### 2. Static Analysis & Policy Check
Run `minder` to evaluate repository posture against the `secure-supply-chain` profile.

```typescript
const policy = await agent.run('golden.security.minder', {
  operation: 'evaluate',
  profileName: 'secure-supply-chain',
  repoOwner: 'org',
  repoName: 'repo'
});
if (policy.profileStatus.status === 'failing') {
  // Block pipeline or warn based on enforcement level
}
```

### 3. Vulnerability Scanning
Scan dependencies using `osv-scanner`.

```typescript
const scan = await agent.run('golden.security.package-analysis', {
  target: './package-lock.json'
});
if (scan.level === 'critical') {
   // Block
}
```

### 4. Artifact Signing
Sign the build output using `sigstore`.

```typescript
await agent.run('golden.security.sigstore', {
  operation: 'sign',
  artifactPath: './dist/app.tar.gz'
});
```

## Compliance Note
This flow satisfies **TCS-001** (Automated Security Gates) and **CAS-001** (Artifact Provenance).
