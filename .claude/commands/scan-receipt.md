---
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
description: Process a receipt image through the OCR pipeline and verify output
---

Process the receipt at $ARGUMENTS through the PantryAI OCR pipeline:

1. Identify the retailer format (Lidl JPEG, Carrefour PDF, etc.)
2. Run through the appropriate parsing strategy
3. Show extracted products in a table
4. Flag any parsing errors or low-confidence items
5. Suggest database entries for each product
