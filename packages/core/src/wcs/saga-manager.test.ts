/**
 * packages/core/src/wcs/saga-manager.test.ts
 * TDD: Saga LIFO compensation execution (WCS 2.6.3).
 */
import { describe, it, expect } from 'vitest';
import { createSagaManager } from './saga-manager';

describe('SagaManager', () => {
  it('runs compensations in LIFO order on runCompensations', async () => {
    const order: string[] = [];
    const man = createSagaManager();
    man.addCompensation(async () => { order.push('A'); });
    man.addCompensation(async () => { order.push('B'); });
    man.addCompensation(async () => { order.push('C'); });
    await man.runCompensations();
    expect(order).toEqual(['C', 'B', 'A']);
  });

  it('marks execution with isCompensation flag when provided', async () => {
    let receivedFlag: boolean | undefined;
    const man = createSagaManager();
    man.addCompensation(async () => { receivedFlag = true; });
    await man.runCompensations({ setCompensationSpan: (v) => { receivedFlag = v; } });
    expect(receivedFlag).toBe(true);
  });

  it('runs no-op when no compensations registered', async () => {
    const man = createSagaManager();
    await expect(man.runCompensations()).resolves.toBeUndefined();
  });

  it('continues running remaining compensations if one throws', async () => {
    const order: string[] = [];
    const man = createSagaManager();
    man.addCompensation(async () => { order.push('first'); });
    man.addCompensation(async () => { throw new Error('fail'); });
    man.addCompensation(async () => { order.push('third'); });
    await expect(man.runCompensations()).rejects.toThrow('fail');
    expect(order).toContain('third');
    expect(order).toContain('first');
  });
});
