/**
 * Unit tests for OcrProcessor helper methods:
 * stripHtml, parseJsonReceipt, and validatePublicUrl.
 * Uses only mocks.
 */
import { lookup } from 'node:dns/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Module mocks (hoisted by Vitest)

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));

vi.mock('@nestjs/bullmq', () => ({
  Processor: () => () => undefined,
  InjectQueue: () => () => undefined,
  WorkerHost: class {
    async process(): Promise<void> {}
  },
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({ send: vi.fn() })),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}));

vi.mock('@mistralai/mistralai', () => ({
  Mistral: vi.fn(() => ({
    ocr: { process: vi.fn() },
    chat: { complete: vi.fn() },
  })),
}));

vi.mock('tesseract.js', () => ({ default: { recognize: vi.fn() } }));

// Import after mocks
import { OcrProcessor } from '../ocr.processor.js';
import type { ParsedReceipt } from '../parsers/index.js';

// Helper types to call private methods in tests
type StripHtml = (html: string) => string;
type ParseJsonReceipt = (json: unknown) => ParsedReceipt;
type ValidatePublicUrl = (url: string) => Promise<void>;
type ParseReceiptText = (rawText: string) => Promise<ParsedReceipt>;

interface PrivateHelpers {
  stripHtml: StripHtml;
  parseJsonReceipt: ParseJsonReceipt;
  validatePublicUrl: ValidatePublicUrl;
  parseReceiptText: ParseReceiptText;
  mistral: { chat: { complete: ReturnType<typeof vi.fn> } };
}

const mockLookup = vi.mocked(lookup);

// Shared processor instance

let helpers: PrivateHelpers;

beforeEach(() => {
  const processor = new OcrProcessor({} as never, {} as never, {} as never);
  helpers = processor as unknown as PrivateHelpers;
  vi.clearAllMocks();
});

// stripHtml

describe('stripHtml()', () => {
  it('converts <br> to newline', () => {
    expect(helpers.stripHtml('line1<br>line2')).toBe('line1\nline2');
  });

  it('converts self-closing <br/> to newline', () => {
    expect(helpers.stripHtml('line1<br/>line2')).toBe('line1\nline2');
  });

  it('converts </p> to newline', () => {
    expect(helpers.stripHtml('<p>first</p><p>second</p>')).toBe('first\nsecond');
  });

  it('converts </tr> to newline', () => {
    expect(helpers.stripHtml('<tr>row1</tr><tr>row2</tr>')).toBe('row1\nrow2');
  });

  it('converts </td> to two spaces (preserves column layout)', () => {
    const result = helpers.stripHtml('<td>FARINE</td><td>0,89</td>');
    expect(result).toBe('FARINE  0,89');
  });

  it('converts </th> to two spaces', () => {
    const result = helpers.stripHtml('<th>Produit</th><th>Prix</th>');
    expect(result).toBe('Produit  Prix');
  });

  it('decodes &amp;', () => {
    expect(helpers.stripHtml('Tom &amp; Jerry')).toBe('Tom & Jerry');
  });

  it('decodes &lt; and &gt;', () => {
    expect(helpers.stripHtml('1 &lt; 2 &gt; 0')).toBe('1 < 2 > 0');
  });

  it('decodes &nbsp; to space', () => {
    expect(helpers.stripHtml('hello&nbsp;world')).toBe('hello world');
  });

  it('decodes numeric character references', () => {
    // &#233; = e with accent, &#224; = a with accent
    expect(helpers.stripHtml('caf&#233;  &#224; emporter')).toBe('café  à emporter');
  });

  it('strips remaining HTML tags', () => {
    const html = '<div class="receipt"><p><b>CARREFOUR</b></p></div>';
    expect(helpers.stripHtml(html)).toBe('CARREFOUR');
  });

  it('collapses 3+ spaces/tabs to 2 spaces', () => {
    expect(helpers.stripHtml('a   b    c')).toBe('a  b  c');
  });

  it('collapses 3+ consecutive newlines to 2', () => {
    expect(helpers.stripHtml('a\n\n\n\nb')).toBe('a\n\nb');
  });

  it('trims leading/trailing whitespace', () => {
    expect(helpers.stripHtml('  <p>text</p>  ')).toBe('text');
  });

  it('handles a realistic HTML receipt snippet', () => {
    const html = `
      <table>
        <tr><th>Produit</th><th>Prix</th></tr>
        <tr><td>FARINE BLE T55 1KG</td><td>0,89&nbsp;€</td></tr>
        <tr><td>LAIT DEMI &amp; ECREME</td><td>0,95&nbsp;€</td></tr>
      </table>
    `;
    const result = helpers.stripHtml(html);
    expect(result).toContain('FARINE BLE T55 1KG');
    expect(result).toContain('LAIT DEMI & ECREME');
    expect(result).toContain('0,89 €');
  });
});

// parseJsonReceipt

describe('parseJsonReceipt()', () => {
  it('returns empty items for null input', () => {
    expect(helpers.parseJsonReceipt(null)).toEqual({ items: [] });
  });

  it('returns empty items for a string input', () => {
    expect(helpers.parseJsonReceipt('not an object')).toEqual({ items: [] });
  });

  it('returns empty items when no recognized array key exists', () => {
    expect(helpers.parseJsonReceipt({ data: [] })).toEqual({ items: [] });
  });

  it('returns empty items when the array key is not an array', () => {
    expect(helpers.parseJsonReceipt({ items: 'foo' })).toEqual({ items: [] });
  });

  it('maps items[] with French AGEC field names (libelle/quantite/unite/prixUnitaire)', () => {
    const json = {
      items: [
        { libelle: 'Farine Blé T55 1kg', quantite: 1, unite: 'kg', prixUnitaire: 0.89 },
        { libelle: 'Beurre Extra Fin 250g', quantite: 2, unite: 'pcs', prixUnitaire: 1.55 },
      ],
    };
    const { items } = helpers.parseJsonReceipt(json);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      name: 'Farine Blé T55 1kg',
      quantity: 1,
      unit: 'kg',
      price: 0.89,
      confidence: 0.95,
    });
    expect(items[1]).toMatchObject({
      name: 'Beurre Extra Fin 250g',
      quantity: 2,
      unit: 'pcs',
      price: 1.55,
      confidence: 0.95,
    });
  });

  it('maps lignes[] with English field names (name/quantity/unit/price)', () => {
    const json = {
      lignes: [{ name: 'Yaourt Nature', quantity: 4, unit: 'pcs', price: 1.29 }],
    };
    const { items } = helpers.parseJsonReceipt(json);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: 'Yaourt Nature',
      quantity: 4,
      unit: 'pcs',
      price: 1.29,
    });
  });

  it('maps products[] key', () => {
    const json = {
      products: [{ name: 'Pain Complet', quantity: 1 }],
    };
    const { items } = helpers.parseJsonReceipt(json);
    expect(items).toHaveLength(1);
    expect(items[0]!.name).toBe('Pain Complet');
  });

  it('maps produits[] key', () => {
    const json = {
      produits: [{ libelle: 'Lait Entier 1L', quantite: 3 }],
    };
    const { items } = helpers.parseJsonReceipt(json);
    expect(items).toHaveLength(1);
    expect(items[0]!.name).toBe('Lait Entier 1L');
  });

  it('uses qty field as quantity fallback', () => {
    const json = {
      items: [{ name: 'Tomates', qty: 2 }],
    };
    const { items } = helpers.parseJsonReceipt(json);
    expect(items[0]!.quantity).toBe(2);
  });

  it('uses label field as name fallback', () => {
    const json = {
      items: [{ label: 'Pommes Golden' }],
    };
    const { items } = helpers.parseJsonReceipt(json);
    expect(items[0]!.name).toBe('Pommes Golden');
  });

  it('uses nom field as name fallback', () => {
    const json = {
      items: [{ nom: 'Jambon Blanc' }],
    };
    const { items } = helpers.parseJsonReceipt(json);
    expect(items[0]!.name).toBe('Jambon Blanc');
  });

  it('skips items with empty or whitespace-only name', () => {
    const json = {
      items: [{ libelle: '' }, { libelle: '   ' }, { libelle: 'Valide' }],
    };
    const { items } = helpers.parseJsonReceipt(json);
    expect(items).toHaveLength(1);
    expect(items[0]!.name).toBe('Valide');
  });

  it('extracts retailer from enseigneCommerciale', () => {
    const json = {
      enseigneCommerciale: 'CARREFOUR MARKET',
      items: [{ libelle: 'Farine', quantite: 1 }],
    };
    const result = helpers.parseJsonReceipt(json);
    expect(result.retailer).toBe('CARREFOUR MARKET');
  });

  it('extracts retailer from retailer field', () => {
    const json = {
      retailer: 'LIDL',
      items: [{ name: 'Yaourt' }],
    };
    const result = helpers.parseJsonReceipt(json);
    expect(result.retailer).toBe('LIDL');
  });

  it('extracts retailer from magasin field', () => {
    const json = {
      magasin: 'E.LECLERC ANGLET',
      items: [{ name: 'Pain' }],
    };
    const result = helpers.parseJsonReceipt(json);
    expect(result.retailer).toBe('E.LECLERC ANGLET');
  });

  it('assigns confidence 0.95 to all items', () => {
    const json = {
      items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    };
    const { items } = helpers.parseJsonReceipt(json);
    expect(items.every((i) => i.confidence === 0.95)).toBe(true);
  });

  it('does not include unit field when unite is empty/whitespace', () => {
    const json = {
      items: [{ libelle: 'Farine', unite: '   ' }],
    };
    const { items } = helpers.parseJsonReceipt(json);
    expect(items[0]).not.toHaveProperty('unit');
  });

  it('does not include quantity/price when fields are non-numeric', () => {
    const json = {
      items: [{ name: 'Beurre', quantity: 'deux', price: 'un euro' }],
    };
    const { items } = helpers.parseJsonReceipt(json);
    expect(items[0]).not.toHaveProperty('quantity');
    expect(items[0]).not.toHaveProperty('price');
  });
});

// parseReceiptText

describe('parseReceiptText()', () => {
  it('falls back to Mistral Chat when a detected parser yields no items', async () => {
    // The footer triggers Grand Frais detection, but the body has no parsable rows.
    const rawText = 'random header\nunparseable line\nVOTRE MAGASIN GRAND FRAIS';
    const processor = new OcrProcessor(
      {} as never,
      {} as never,
      {} as never,
    ) as unknown as PrivateHelpers;
    processor.mistral.chat.complete.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ retailer: null, items: [{ name: 'Pain', quantity: 1 }] }),
          },
        },
      ],
    });

    const result = await processor.parseReceiptText(rawText);

    expect(processor.mistral.chat.complete).toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
    // Detected retailer is preserved even though Chat returned none.
    expect(result.retailer).toBe('GRAND FRAIS');
  });
});

// validatePublicUrl

describe('validatePublicUrl()', () => {
  it('resolves without throwing for a valid public IP', async () => {
    mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });
    await expect(
      helpers.validatePublicUrl('https://example.com/receipt.pdf'),
    ).resolves.toBeUndefined();
  });

  it('throws for 127.x.x.x (IPv4 loopback)', async () => {
    mockLookup.mockResolvedValue({ address: '127.0.0.1', family: 4 });
    await expect(helpers.validatePublicUrl('https://localhost/evil')).rejects.toThrow('SSRF');
  });

  it('throws for 0.0.0.0', async () => {
    mockLookup.mockResolvedValue({ address: '0.0.0.0', family: 4 });
    await expect(helpers.validatePublicUrl('https://evil.com')).rejects.toThrow('SSRF');
  });

  it('throws for 10.x.x.x (RFC-1918 class A)', async () => {
    mockLookup.mockResolvedValue({ address: '10.0.0.1', family: 4 });
    await expect(helpers.validatePublicUrl('https://internal.corp')).rejects.toThrow('SSRF');
  });

  it('throws for 192.168.x.x (RFC-1918 class C)', async () => {
    mockLookup.mockResolvedValue({ address: '192.168.1.100', family: 4 });
    await expect(helpers.validatePublicUrl('https://router.local')).rejects.toThrow('SSRF');
  });

  it('throws for 172.16.x.x (RFC-1918 class B start)', async () => {
    mockLookup.mockResolvedValue({ address: '172.16.0.1', family: 4 });
    await expect(helpers.validatePublicUrl('https://somewhere.internal')).rejects.toThrow('SSRF');
  });

  it('throws for 172.20.x.x (RFC-1918 class B middle)', async () => {
    mockLookup.mockResolvedValue({ address: '172.20.5.5', family: 4 });
    await expect(helpers.validatePublicUrl('https://somewhere.internal')).rejects.toThrow('SSRF');
  });

  it('throws for 172.31.x.x (RFC-1918 class B end)', async () => {
    mockLookup.mockResolvedValue({ address: '172.31.255.255', family: 4 });
    await expect(helpers.validatePublicUrl('https://somewhere.internal')).rejects.toThrow('SSRF');
  });

  it('does NOT throw for 172.32.x.x (just outside RFC-1918 range)', async () => {
    mockLookup.mockResolvedValue({ address: '172.32.0.1', family: 4 });
    await expect(helpers.validatePublicUrl('https://edge.example.com')).resolves.toBeUndefined();
  });

  it('throws for 169.254.x.x (link-local)', async () => {
    mockLookup.mockResolvedValue({ address: '169.254.1.1', family: 4 });
    await expect(helpers.validatePublicUrl('https://link-local.test')).rejects.toThrow('SSRF');
  });

  it('throws for ::1 (IPv6 loopback)', async () => {
    mockLookup.mockResolvedValue({ address: '::1', family: 6 });
    await expect(helpers.validatePublicUrl('https://ipv6.localhost')).rejects.toThrow('SSRF');
  });

  it('throws for fc00:: (IPv6 ULA)', async () => {
    mockLookup.mockResolvedValue({ address: 'fc00::1', family: 6 });
    await expect(helpers.validatePublicUrl('https://ula.ipv6.internal')).rejects.toThrow('SSRF');
  });

  it('throws for fd00:: (IPv6 ULA fd prefix)', async () => {
    mockLookup.mockResolvedValue({ address: 'fd12:3456:789a::1', family: 6 });
    await expect(helpers.validatePublicUrl('https://ula.ipv6.internal')).rejects.toThrow('SSRF');
  });
});
