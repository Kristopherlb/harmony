/**
 * packages/schema-registry/src/slsa.ts
 * Schemas for SLSA (Supply-chain Levels for Software Artifacts) provenance.
 * Supporting v1.0 provenance format.
 */
import { z } from 'zod';

export const digestSchema = z.record(z.string()).describe('Map of algorithm to digest');

export const resourceDescriptorSchema = z.object({
    name: z.string().optional(),
    uri: z.string().optional(),
    digest: digestSchema.optional(),
    content: z.string().optional(),
    downloadLocation: z.string().optional(),
    mediaType: z.string().optional(),
    annotations: z.record(z.unknown()).optional(),
});

export const builderSchema = z.object({
    id: z.string().describe('Builder URI'),
    version: z.record(z.string()).optional(),
    builderDependencies: z.array(resourceDescriptorSchema).optional(),
});

export const buildMetadataSchema = z.object({
    invocationId: z.string().optional(),
    startedOn: z.string().optional(),
    finishedOn: z.string().optional(),
});

export const runDetailsSchema = z.object({
    builder: builderSchema,
    metadata: buildMetadataSchema.optional(),
    byproducts: z.array(resourceDescriptorSchema).optional(),
});

export const slsaPredicateSchema = z.object({
    buildDefinition: z.object({
        buildType: z.string().describe('Build type URI'),
        externalParameters: z.record(z.unknown()),
        internalParameters: z.record(z.unknown()).optional(),
        resolvedDependencies: z.array(resourceDescriptorSchema).optional(),
    }),
    runDetails: runDetailsSchema,
});

export const slsaProvenanceSchema = z.object({
    _type: z.literal('https://in-toto.io/Statement/v1'),
    subject: z.array(resourceDescriptorSchema),
    predicateType: z.literal('https://slsa.dev/provenance/v1'),
    predicate: slsaPredicateSchema,
});

export type SlsaProvenance = z.infer<typeof slsaProvenanceSchema>;
export type SlsaPredicate = z.infer<typeof slsaPredicateSchema>;
