---
name: infrastructure-secrets
description: Apply ISS-001 for secret naming, late-binding injection (OpenBao/ESO), infrastructure provisioning, and Dagger/K8s security.
---

# Infrastructure & Secrets Standard (ISS-001)

Use this skill when managing secrets, secret injection into Capabilities, or infrastructure provisioning (Terraform/Pulumi as OCS Commanders) and when configuring Dagger/K8s quotas and governance.

## When to Use

- Defining OpenBao paths and naming for public vs user-scoped secrets
- Implementing or reviewing late-binding secret injection (logical key → OpenBao path → ESO → K8s Secret → Dagger mount)
- Designing PROVISION/DEPROVISION capabilities and Saga cleanup
- Setting K8s resource quotas or sandbox policies for Dagger engines

## Instructions

1. **Secret paths:** Use hierarchy—/artifacts/{appId}/public/secrets/{secretName} and /artifacts/{appId}/users/{userId}/secrets/{secretName}. Govern access by InitiatorID and AppID.
2. **Late-binding:** Map OCS SecretSchema logical keys to OpenBao paths at runtime; sync via ESO to K8s; mount into containers. Never embed secret values in code.
3. **Infrastructure:** Use GitOps; store remote state in encrypted buckets with object locking. Each PROVISION capability must have a DEPROVISION capability in the workflow Saga.
4. **Dagger/K8s:** Apply resource quotas and governance to execution environments as defined in the standard.

For the full normative standard, see **references/infrastructure-secrets.md**.
