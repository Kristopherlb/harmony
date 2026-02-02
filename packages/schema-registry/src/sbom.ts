/**
 * packages/schema-registry/src/sbom.ts
 * Schemas for Software Bill of Materials (SBOM) data structures.
 * Supporting CycloneDX and SPDX common fields.
 */
import { z } from 'zod';

// Common License Schema
export const licenseSchema = z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    url: z.string().optional(),
});

// CycloneDX Component Type
export const componentTypeSchema = z.enum([
    'application',
    'framework',
    'library',
    'container',
    'operating-system',
    'device',
    'firmware',
    'file',
]);

// CycloneDX Hash Schema
export const hashSchema = z.object({
    alg: z.string(),
    content: z.string(),
});

// Common Component Schema (abstracted)
export const componentSchema = z.object({
    type: componentTypeSchema,
    name: z.string(),
    version: z.string().optional(),
    group: z.string().optional(),
    description: z.string().optional(),
    licenses: z.array(licenseSchema).optional(),
    purl: z.string().optional().describe('Package URL'),
    cpe: z.string().optional().describe('Common Platform Enumeration'),
    hashes: z.array(hashSchema).optional(),
});

// CycloneDX Tool Schema
export const toolSchema = z.object({
    vendor: z.string().optional(),
    name: z.string().optional(),
    version: z.string().optional(),
    hashes: z.array(hashSchema).optional(),
});

// Main SBOM Schema
export const sbomSchema = z.object({
    bomFormat: z.enum(['CycloneDX', 'SPDX']),
    specVersion: z.string(),
    serialNumber: z.string().optional(),
    version: z.number().int().optional(),
    metadata: z.object({
        timestamp: z.string().optional(),
        tools: z.array(toolSchema).optional(),
        component: componentSchema.optional().describe('Top-level component'),
    }).optional(),
    components: z.array(componentSchema).optional(),
    dependencies: z.array(z.object({
        ref: z.string(),
        dependsOn: z.array(z.string()).optional(),
    })).optional(),
});

export type Sbom = z.infer<typeof sbomSchema>;
export type Component = z.infer<typeof componentSchema>;
export type License = z.infer<typeof licenseSchema>;
