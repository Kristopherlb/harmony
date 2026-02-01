/**
 * packages/core/src/wcs/saga-manager.ts
 * LIFO compensation stack for Saga pattern (WCS 2.6.3).
 */
import type { CompensationFn } from '../types.js';

export interface SagaManager {
  addCompensation(fn: CompensationFn): void;
  runCompensations(options?: { setCompensationSpan?: (isCompensation: boolean) => void }): Promise<void>;
}

export function createSagaManager(): SagaManager {
  const compensations: CompensationFn[] = [];

  return {
    addCompensation(fn) {
      compensations.push(fn);
    },

    async runCompensations(options) {
      const { setCompensationSpan } = options ?? {};
      let firstError: unknown;
      for (let i = compensations.length - 1; i >= 0; i--) {
        try {
          if (setCompensationSpan) setCompensationSpan(true);
          await compensations[i]();
        } catch (e) {
          if (firstError === undefined) firstError = e;
        }
      }
      if (firstError !== undefined) throw firstError;
    },
  };
}
