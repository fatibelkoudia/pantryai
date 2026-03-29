---
name: receipt-parsing
description: |
  Activate for receipt parsing, OCR output processing, product extraction,
  French retailer format handling. Use PROACTIVELY for files in src/ocr/ or src/worker/.
---

# Receipt Parsing Patterns

## French Retailer Formats

### Lidl (JPEG)

- Truncated labels (~20 chars), discount lines interleaved, no EAN
- Strategy: Line-by-line regex, discount association by proximity

### Carrefour (native PDF)

- Structured PDF, full names, EAN-13 present
- Strategy: PDF text extraction first, OCR fallback

### Leclerc (thermal paper scan)

- Variable quality, often skewed, category headers mixed
- Strategy: Image preprocessing (deskew, contrast) → Mistral OCR

## Pipeline

1. Detect format (PDF → text extract, Image → OCR)
2. Normalize encoding (UTF-8, French accents)
3. Extract: product name, quantity, unit price, total
4. Associate discounts with correct products
5. Validate totals (sum ≈ receipt total)
6. Map to Product model via fuzzy match or EAN lookup
