// Tests for StockController.
// We check two things: every route sits behind the JWT guard, and the controller
// always hands the caller's own userId (from the request) down to the service.
// The service is mocked here, it has its own test in stock.service.spec.ts.
import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { StockController } from '../stock.controller.js';
import type { StockService } from '../stock.service.js';

const GUARDS_METADATA = '__guards__';

// The guard is declared at the class level, so it covers every handler.
function classGuards(): unknown[] {
  return (Reflect.getMetadata(GUARDS_METADATA, StockController) ?? []) as unknown[];
}

function makeService() {
  return {
    findAll: vi.fn().mockResolvedValue({ items: [], meta: {} }),
    findOne: vi.fn().mockResolvedValue({ id: 's1' }),
    create: vi.fn().mockResolvedValue({ id: 's1' }),
    update: vi.fn().mockResolvedValue({ id: 's1' }),
    remove: vi.fn().mockResolvedValue(undefined),
  } as unknown as StockService;
}

const USER_ID = 'user-1';
const req = { user: { userId: USER_ID, email: 'u@pantryai.test' } };

describe('StockController auth', () => {
  it('protects the whole controller with JwtAuthGuard', () => {
    expect(classGuards()).toContain(JwtAuthGuard);
  });
});

describe('StockController delegation (user scoping)', () => {
  it('findAll passes the caller userId and query through', () => {
    const service = makeService();
    const controller = new StockController(service);
    const query = { page: 2, limit: 10 };
    void controller.findAll(req, query);
    expect(service.findAll).toHaveBeenCalledWith(USER_ID, query);
  });

  it('findOne scopes the lookup to the caller', () => {
    const service = makeService();
    const controller = new StockController(service);
    void controller.findOne('s1', req);
    expect(service.findOne).toHaveBeenCalledWith('s1', USER_ID);
  });

  it('create attaches the caller userId to the new item', () => {
    const service = makeService();
    const controller = new StockController(service);
    const dto = { productId: 'p1', quantity: 1, unit: 'unit' };
    void controller.create(dto, req);
    expect(service.create).toHaveBeenCalledWith(USER_ID, dto);
  });

  it('update scopes the change to the caller', () => {
    const service = makeService();
    const controller = new StockController(service);
    const dto = { quantity: 3 };
    void controller.update('s1', dto, req);
    expect(service.update).toHaveBeenCalledWith('s1', USER_ID, dto);
  });

  it('remove forwards the disposition query for the waste score', () => {
    const service = makeService();
    const controller = new StockController(service);
    void controller.remove('s1', { disposition: 'DISCARDED' }, req);
    expect(service.remove).toHaveBeenCalledWith('s1', USER_ID, 'DISCARDED');
  });

  it('remove passes undefined disposition when none is given', () => {
    const service = makeService();
    const controller = new StockController(service);
    void controller.remove('s1', {}, req);
    expect(service.remove).toHaveBeenCalledWith('s1', USER_ID, undefined);
  });
});
