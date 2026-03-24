import { describe, expect, it } from 'vitest';
import { CarrefourParser } from '../carrefour.parser.js';
import { LeclercParser } from '../leclerc.parser.js';
import { LidlParser } from '../lidl.parser.js';
import { ParserRegistry } from '../parser-registry.js';

const registry = new ParserRegistry();

describe('ParserRegistry', () => {
  it('detects CarrefourParser from header containing CARREFOUR', () => {
    const rawText = 'CARREFOUR MARKET PARIS 15\n================\n3228857000166  FARINE  1  0,89';
    expect(registry.detect(rawText)).toBeInstanceOf(CarrefourParser);
  });

  it('detects LidlParser from header containing LIDL', () => {
    const rawText = 'LIDL\n================\nYAOURT NATUR BCO  1.89 A';
    expect(registry.detect(rawText)).toBeInstanceOf(LidlParser);
  });

  it('detects LeclercParser from header containing E.LECLERC', () => {
    const rawText = 'E.LECLERC\nEPICERIE\nFARINE DE BLE T55  0,89 A';
    expect(registry.detect(rawText)).toBeInstanceOf(LeclercParser);
  });

  it('detects LeclercParser from header containing LECLERC', () => {
    const rawText = 'LECLERC DRIVE\nFARINE DE BLE T55  0,89 A';
    expect(registry.detect(rawText)).toBeInstanceOf(LeclercParser);
  });

  it('returns null for unknown retailer', () => {
    const rawText = 'SUPERMARCHE BONHEUR\nBAGUETTE  0.95';
    expect(registry.detect(rawText)).toBeNull();
  });

  it('does not false-positive on CARREFOUR appearing after line 20', () => {
    const header = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n');
    const rawText = `${header}\nCARREFOUR`;
    expect(registry.detect(rawText)).toBeNull();
  });
});
