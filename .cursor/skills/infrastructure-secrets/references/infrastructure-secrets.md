# Infrastructure & Secrets Standard (ISS)

| Metadata | Value |
| -------- | ----- |
| ID | ISS-001 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authors | Platform Security Team |
| Context | OpenBao / K8s / Dagger |

## 1. Introduction

The Infrastructure & Secrets Standard (ISS) defines the contract for secure resource provisioning and the late-binding secret architecture. It ensures that sensitive data is never exposed in code and that execution environments (Dagger Engines) are appropriately sandboxed and governed.

## 2. Secret Mapping (OpenBao)

Secrets are managed in OpenBao. Access is governed by the InitiatorID and AppID.

### 2.1. Naming Convention

Paths MUST follow the strict hierarchy:

- **Public/Shared Secrets:** /artifacts/{appId}/public/secrets/{secretName}
- **Private/User Secrets:** /artifacts/{appId}/users/{userId}/secrets/{secretName}

### 2.2. Secret Injection (The "Late-Binding" Pattern)

- **Developer Action:** Maps a logical key (e.g., API_TOKEN) in the OCS SecretSchema.
- **Platform Mapping:** The Secret Broker maps the logical key to the OpenBao path based on the runtime environment (Dev/Staging/Prod).
- **Execution:** The External Secrets Operator (ESO) syncs the OpenBao path to a K8s Secret, which is then mounted as a Dagger Secret into the container.

## 3. Infrastructure Provisioning

The platform uses a GitOps approach for infrastructure.

- **Provisioner:** Terraform or Pulumi modules wrapped as OCS Capabilities (Pattern C: Commander).
- **State Management:** Remote state MUST be stored in encrypted buckets with object locking enabled.
- **Cleanup:** Every PROVISION capability MUST include a corresponding DEPROVISION capability registered in the Workflow's Saga context.

## 4. K8s Resource Quotas (Dagger Engines)

To prevent resource exhaustion and thundering herd issues, Dagger engines running Executables MUST adhere to the following standard quotas:

| Profile | CPU Request/Limit | RAM Request/Limit | Storage |
| ------- | ----------------- | ----------------- | ------- |
| Standard | 500m / 2000m | 1Gi / 4Gi | 10Gi |
| High Performance | 2000m / 4000m | 4Gi / 8Gi | 50Gi |

**Network Policy:** By default, all Dagger pods MUST have an Egress NetworkPolicy denying all traffic except to DNS and the specific FQDNs listed in the OCS security.networkAccess block.

## 5. Deployment Lifecycle

- **Blue/Green Workers:** Temporal Workers MUST be deployed using Blue/Green strategies. New Workflows (Blue) are registered under a new BuildID, while existing Workflows (Green) complete on the old BuildID.
- **Auto-Scaling:** K8s Horizontal Pod Autoscalers (HPA) MUST be tuned based on the Saturation signal from the GOS metrics.
