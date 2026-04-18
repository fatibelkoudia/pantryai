import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { ProductController } from '../product.controller.js';

const GUARDS_METADATA = '__guards__';

function guardsOf(method: keyof ProductController): unknown[] {
  return (Reflect.getMetadata(GUARDS_METADATA, ProductController.prototype[method]) ??
    []) as unknown[];
}

describe('ProductController auth guards', () => {
  it.each(['create', 'update', 'remove'] as const)('protects %s with JwtAuthGuard', (method) => {
    expect(guardsOf(method)).toContain(JwtAuthGuard);
  });

  it.each(['findAll', 'findByEan13', 'findOne'] as const)(
    'keeps %s public (shared reference data)',
    (method) => {
      expect(guardsOf(method)).not.toContain(JwtAuthGuard);
    },
  );
});
