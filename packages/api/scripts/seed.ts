// Makes a demo account with a pantry already filled in, so you can log in and see the
// app working without scanning a receipt first.
//
// Run it with: pnpm --filter @pantryai/api seed
//
// You can run it as many times as you want. It only touches the demo account, clears its
// old data first, and never changes any real account.
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  ShoppingItemSource,
  StockDisposition,
  StockLocation,
} from '../src/generated/prisma/client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the API's own .env so this works no matter what folder you run it from.
config({ path: path.resolve(__dirname, '../.env') });

// The login for the demo account. Not a real email, just something to log in with.
const DEMO_EMAIL = 'demo@pantryai.test';
const DEMO_PASSWORD = 'Demo1234!';
const DEMO_NAME = 'Compte démo';

// Same number of rounds the auth service uses, so the demo password works like a normal one.
const SALT_ROUNDS = 12;

// Gives a date a few days before or after today. We use it so the expiry dates stay close
// to now every time, instead of being stuck on some old fixed date.
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// The products everyone shares (the catalog). The barcode has to be unique, so we look
// each one up by it and running this again won't make copies. These barcodes are made up
// (the 200 range is the one stores use in-house), so they won't clash with real Open Food
// Facts ones.
const PRODUCTS = [
  { ean13: '2000000000017', name: 'Lait demi-écrémé 1L', brand: 'Candia', category: 'Crémerie' },
  { ean13: '2000000000024', name: 'Œufs frais x6', brand: 'Matines', category: 'Crémerie' },
  { ean13: '2000000000031', name: 'Yaourt nature x4', brand: 'Danone', category: 'Crémerie' },
  {
    ean13: '2000000000048',
    name: 'Filet de poulet 500g',
    brand: 'Le Gaulois',
    category: 'Boucherie',
  },
  { ean13: '2000000000055', name: 'Pâtes penne 500g', brand: 'Barilla', category: 'Épicerie' },
  { ean13: '2000000000062', name: 'Sauce tomate basilic', brand: 'Panzani', category: 'Épicerie' },
  { ean13: '2000000000079', name: 'Courgettes 1kg', brand: null, category: 'Fruits et légumes' },
  { ean13: '2000000000086', name: 'Pommes Gala 1kg', brand: null, category: 'Fruits et légumes' },
  {
    ean13: '2000000000093',
    name: 'Épinards surgelés 1kg',
    brand: 'Bonduelle',
    category: 'Surgelés',
  },
  {
    ean13: '2000000000109',
    name: 'Glace vanille 500ml',
    brand: 'Häagen-Dazs',
    category: 'Surgelés',
  },
] as const;

async function main(): Promise<void> {
  const url = process.env['DATABASE_TRANSACTION_POOLER_URL'];
  if (!url) {
    throw new Error(
      'DATABASE_TRANSACTION_POOLER_URL is not set. Copy packages/api/.env.example to ' +
        'packages/api/.env and fill in the Supabase connection strings first.',
    );
  }

  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    // 1. The demo user. Update it if it's already there, otherwise make it.
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);
    const user = await prisma.user.upsert({
      where: { email: DEMO_EMAIL },
      update: { name: DEMO_NAME, passwordHash, deletedAt: null },
      create: { email: DEMO_EMAIL, name: DEMO_NAME, passwordHash },
    });

    // 2. Clear out this user's old data first, so running again gives the same clean
    // pantry instead of piling more on top.
    await prisma.stockItem.deleteMany({ where: { userId: user.id } });
    await prisma.shoppingItem.deleteMany({ where: { userId: user.id } });
    await prisma.userXp.deleteMany({ where: { userId: user.id } });

    // 3. Add the catalog products. We look each one up by barcode and update it or make it.
    const products = new Map<string, string>(); // barcode -> product id
    for (const p of PRODUCTS) {
      const product = await prisma.product.upsert({
        where: { ean13: p.ean13 },
        update: { name: p.name, brand: p.brand, category: p.category },
        create: { ean13: p.ean13, name: p.name, brand: p.brand, category: p.category },
      });
      products.set(p.ean13, product.id);
    }
    const pid = (ean: string): string => {
      const id = products.get(ean);
      if (!id) throw new Error(`missing product ${ean}`);
      return id;
    };

    // 4. What's in the pantry right now. A mix of fridge, freezer and pantry, with one
    // item already past its date and one going off in two days, so you can see the
    // highlighting and the alert.
    await prisma.stockItem.createMany({
      data: [
        {
          userId: user.id,
          productId: pid('2000000000017'),
          quantity: 1,
          unit: 'L',
          location: StockLocation.FRIDGE,
          expirationDate: daysFromNow(5),
        },
        {
          userId: user.id,
          productId: pid('2000000000024'),
          quantity: 6,
          unit: 'pièce',
          location: StockLocation.FRIDGE,
          expirationDate: daysFromNow(12),
        },
        {
          userId: user.id,
          productId: pid('2000000000031'),
          quantity: 4,
          unit: 'pot',
          location: StockLocation.FRIDGE,
          expirationDate: daysFromNow(2),
        },
        {
          userId: user.id,
          productId: pid('2000000000048'),
          quantity: 1,
          unit: 'paquet',
          location: StockLocation.FRIDGE,
          expirationDate: daysFromNow(-1),
        },
        {
          userId: user.id,
          productId: pid('2000000000079'),
          quantity: 1,
          unit: 'kg',
          location: StockLocation.FRIDGE,
          expirationDate: daysFromNow(4),
        },
        {
          userId: user.id,
          productId: pid('2000000000086'),
          quantity: 1,
          unit: 'kg',
          location: StockLocation.PANTRY,
          expirationDate: daysFromNow(10),
        },
        {
          userId: user.id,
          productId: pid('2000000000055'),
          quantity: 2,
          unit: 'paquet',
          location: StockLocation.PANTRY,
          expirationDate: daysFromNow(300),
        },
        {
          userId: user.id,
          productId: pid('2000000000062'),
          quantity: 1,
          unit: 'pot',
          location: StockLocation.PANTRY,
          expirationDate: daysFromNow(180),
        },
        {
          userId: user.id,
          productId: pid('2000000000093'),
          quantity: 1,
          unit: 'kg',
          location: StockLocation.FREEZER,
          expirationDate: daysFromNow(120),
        },
        {
          userId: user.id,
          productId: pid('2000000000109'),
          quantity: 1,
          unit: 'pièce',
          location: StockLocation.FREEZER,
          expirationDate: daysFromNow(90),
        },
      ],
    });

    // 5. Some older items that already left the pantry. We mark them deleted with a reason
    // (eaten or thrown away), and that's what the waste score reads. Three eaten and one
    // thrown away, so the score has some real numbers to show.
    await prisma.stockItem.createMany({
      data: [
        {
          userId: user.id,
          productId: pid('2000000000017'),
          quantity: 1,
          unit: 'L',
          location: StockLocation.FRIDGE,
          addedAt: daysFromNow(-20),
          deletedAt: daysFromNow(-8),
          disposition: StockDisposition.CONSUMED,
        },
        {
          userId: user.id,
          productId: pid('2000000000055'),
          quantity: 1,
          unit: 'paquet',
          location: StockLocation.PANTRY,
          addedAt: daysFromNow(-25),
          deletedAt: daysFromNow(-10),
          disposition: StockDisposition.CONSUMED,
        },
        {
          userId: user.id,
          productId: pid('2000000000079'),
          quantity: 1,
          unit: 'kg',
          location: StockLocation.FRIDGE,
          addedAt: daysFromNow(-15),
          deletedAt: daysFromNow(-6),
          disposition: StockDisposition.CONSUMED,
        },
        {
          userId: user.id,
          productId: pid('2000000000086'),
          quantity: 1,
          unit: 'kg',
          location: StockLocation.PANTRY,
          addedAt: daysFromNow(-18),
          deletedAt: daysFromNow(-7),
          disposition: StockDisposition.DISCARDED,
        },
      ],
    });

    // 6. A short shopping list. A couple added by hand and one that came from low stock.
    await prisma.shoppingItem.createMany({
      data: [
        {
          userId: user.id,
          name: 'Pain complet',
          quantity: 1,
          unit: 'pièce',
          source: ShoppingItemSource.MANUAL,
          checked: false,
        },
        {
          userId: user.id,
          name: 'Beurre doux',
          quantity: 1,
          unit: 'plaquette',
          source: ShoppingItemSource.MANUAL,
          checked: true,
        },
        {
          userId: user.id,
          name: 'Tomates',
          quantity: 500,
          unit: 'g',
          source: ShoppingItemSource.LOW_STOCK,
          checked: false,
        },
      ],
    });

    // 7. Give them some points so the Trashy game part isn't sitting at zero. The
    // challenges themselves get added by the app when it starts, so we don't touch those.
    await prisma.userXp.create({ data: { userId: user.id, total: 150 } });

    console.log('Demo data seeded.');
    console.log(`  Login: ${DEMO_EMAIL}`);
    console.log(`  Password: ${DEMO_PASSWORD}`);
    console.log('  10 products, 10 items in stock, 4 history items, 3 shopping items, 150 XP.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
