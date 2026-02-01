import { describe, it, expect } from 'vitest';
import { workbenchProviderSchema } from '@golden/core';

describe('Workbench contracts wiring', () => {
  it('includes jira provider in provider schema', () => {
    expect(workbenchProviderSchema.options).toContain('jira');
  });
});

