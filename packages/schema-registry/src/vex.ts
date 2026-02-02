/**
 * packages/schema-registry/src/vex.ts
 * Schemas for OpenVEX (Vulnerability Exploitability eXchange) documents.
 */
import { z } from 'zod';

export const vexStatusSchema = z.enum([
    'not_affected',
    'affected',
    'fixed',
    'under_investigation',
]);

export const vexJustificationSchema = z.enum([
    'component_not_present',
    'vulnerable_code_not_present',
    'vulnerable_code_not_in_execute_path',
    'vulnerable_code_cannot_be_controlled_by_adversary',
    'inline_mitigations_already_exist',
]);

export const vexProductSchema = z.object({
    product_id: z.string(),
    subcomponents: z.array(z.object({
        subcomponent_id: z.string(),
    })).optional(),
});

export const vexStatementSchema = z.object({
    vulnerability: z.object({
        name: z.string().describe('CVE ID or vulnerability identifier'),
        description: z.string().optional(),
        aliases: z.array(z.string()).optional(),
    }),
    products: z.array(vexProductSchema),
    status: vexStatusSchema,
    status_notes: z.string().optional(),
    justification: vexJustificationSchema.optional(),
    impact_statement: z.string().optional(),
    action_statement: z.string().optional(),
    action_statement_timestamp: z.string().optional(),
});

export const vexDocumentSchema = z.object({
    '@context': z.string().default('https://openvex.dev/ns/v0.2.0'),
    '@id': z.string().describe('Document ID IRI'),
    author: z.string().describe('Author IRI'),
    role: z.string().optional(),
    timestamp: z.string(),
    version: z.number().int().optional(),
    tooling: z.string().optional(),
    statements: z.array(vexStatementSchema),
});

export type VexDocument = z.infer<typeof vexDocumentSchema>;
export type VexStatement = z.infer<typeof vexStatementSchema>;
