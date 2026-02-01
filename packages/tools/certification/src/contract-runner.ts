import { createCapabilityRegistry } from '@golden/capabilities';
import type { Capability } from '@golden/core';

export type ContractVerificationFailure = {
  id: string;
  area: 'input' | 'output' | 'metadata';
  message: string;
};

export type ContractVerificationResult = {
  total: number;
  failures: ContractVerificationFailure[];
};

export function runContractVerification(
  registry = createCapabilityRegistry()
): ContractVerificationResult {
  const failures: ContractVerificationFailure[] = [];
  const seenIds = new Set<string>();

  for (const cap of registry.values()) {
    const metadataFailure = validateMetadata(cap, seenIds);
    if (metadataFailure) {
      failures.push(metadataFailure);
    }

    const inputCheck = cap.schemas.input.safeParse(cap.aiHints.exampleInput);
    if (!inputCheck.success) {
      failures.push({
        id: cap.metadata.id,
        area: 'input',
        message: inputCheck.error.message,
      });
    }

    const outputCheck = cap.schemas.output.safeParse(cap.aiHints.exampleOutput);
    if (!outputCheck.success) {
      failures.push({
        id: cap.metadata.id,
        area: 'output',
        message: outputCheck.error.message,
      });
    }
  }

  return { total: registry.size, failures };
}

function validateMetadata(cap: Capability, seenIds: Set<string>): ContractVerificationFailure | null {
  const metadataFailure = validateMetadataInternal(cap);
  if (metadataFailure) {
    return metadataFailure;
  }

  if (seenIds.has(cap.metadata.id)) {
    return {
      id: cap.metadata.id,
      area: 'metadata',
      message: `Duplicate capability metadata.id detected: ${cap.metadata.id}`,
    };
  }

  seenIds.add(cap.metadata.id);
  return null;
}

function validateMetadataInternal(cap: Capability): ContractVerificationFailure | null {
  const { metadata } = cap;
  if (!metadata.id || !metadata.version || !metadata.name || !metadata.description) {
    return {
      id: metadata.id ?? 'unknown',
      area: 'metadata',
      message: 'Missing required metadata fields (id, version, name, description).',
    };
  }

  if (!Array.isArray(metadata.tags) || metadata.tags.length === 0) {
    return {
      id: metadata.id,
      area: 'metadata',
      message: 'Capability metadata.tags must be a non-empty array.',
    };
  }

  if (!metadata.maintainer) {
    return {
      id: metadata.id,
      area: 'metadata',
      message: 'Capability metadata.maintainer must be set.',
    };
  }

  return null;
}
