import { Client } from 'pg';
import { config } from 'dotenv';
import { pathToFileURL } from 'node:url';

const categories = [
  { id: 'peripherals', name: 'Периферия', slug: 'peripherals' },
  { id: 'monitors', name: 'Мониторы', slug: 'monitors' },
  { id: 'other', name: 'Прочее', slug: 'other' },
];

export const products = [
  {
    id: 'keyboard',
    title: 'Split keyboard',
    description: 'A split keyboard for a comfortable desktop workspace.',
    priceMinor: 14900,
    badge: 'new',
    categoryId: 'peripherals',
  },
  {
    id: 'monitor',
    title: 'Portable monitor',
    description:
      'A portable monitor for an additional screen at home or on the move.',
    priceMinor: 22900,
    badge: null,
    categoryId: 'monitors',
  },
  {
    id: 'dock',
    title: 'USB-C dock',
    description: 'A USB-C dock for connecting desktop peripherals.',
    priceMinor: 11900,
    badge: 'team pick',
    categoryId: 'peripherals',
  },
];

const additionalProducts = [
  [
    'wireless-mouse',
    'Wireless mouse',
    'Quiet ergonomic mouse with USB receiver.',
    3900,
    'peripherals',
  ],
  [
    'trackball',
    'Desktop trackball',
    'Thumb-operated trackball for a compact desk.',
    6900,
    'peripherals',
  ],
  [
    'mechanical-keyboard',
    'Mechanical keyboard',
    'Compact keyboard with tactile switches.',
    9900,
    'peripherals',
  ],
  [
    'low-profile-keyboard',
    'Low-profile keyboard',
    'Slim wireless keyboard for everyday typing.',
    7900,
    'peripherals',
  ],
  [
    'webcam',
    'Full HD webcam',
    '1080p webcam with a built-in privacy shutter.',
    5900,
    'peripherals',
  ],
  [
    'usb-microphone',
    'USB microphone',
    'Desktop microphone for calls and recordings.',
    8900,
    'peripherals',
  ],
  [
    'headset',
    'Office headset',
    'Lightweight headset with a flexible boom microphone.',
    4900,
    'peripherals',
  ],
  [
    'speakers',
    'Desktop speakers',
    'Compact stereo speakers with volume control.',
    6500,
    'peripherals',
  ],
  [
    'usb-hub',
    'USB hub',
    'Four-port hub for connecting everyday accessories.',
    2500,
    'peripherals',
  ],
  [
    'graphics-tablet',
    'Graphics tablet',
    'Pen tablet for sketching and handwritten notes.',
    10900,
    'peripherals',
  ],
  [
    'monitor-24',
    '24-inch monitor',
    'Full HD IPS display for a home office.',
    15900,
    'monitors',
  ],
  [
    'monitor-27',
    '27-inch monitor',
    'QHD display with an adjustable stand.',
    27900,
    'monitors',
  ],
  [
    'monitor-32',
    '32-inch monitor',
    '4K display with room for multiple windows.',
    44900,
    'monitors',
  ],
  [
    'ultrawide-monitor',
    'Ultrawide monitor',
    'Wide QHD screen for multitasking.',
    49900,
    'monitors',
  ],
  [
    'gaming-monitor',
    'Gaming monitor',
    'Fast refresh display for smooth motion.',
    32900,
    'monitors',
  ],
  [
    'portable-oled',
    'Portable OLED monitor',
    'Lightweight OLED display with USB-C input.',
    39900,
    'monitors',
  ],
  [
    'monitor-arm',
    'Monitor arm',
    'Adjustable single-screen desk mount.',
    5900,
    'other',
  ],
  [
    'laptop-stand',
    'Laptop stand',
    'Ventilated aluminum stand for a laptop.',
    4500,
    'other',
  ],
  [
    'desk-mat',
    'Desk mat',
    'Large soft mat for keyboard and mouse.',
    1900,
    'other',
  ],
  [
    'desk-lamp',
    'Desk lamp',
    'Dimmable lamp with adjustable color temperature.',
    3900,
    'other',
  ],
  [
    'cable-organizer',
    'Cable organizer',
    'Reusable clips for keeping cables tidy.',
    900,
    'other',
  ],
  [
    'usb-c-cable',
    'USB-C cable',
    'Two-meter braided USB-C charging cable.',
    1500,
    'other',
  ],
  [
    'charger',
    'USB-C charger',
    'Compact 65 W charger with two USB-C ports.',
    3500,
    'other',
  ],
  [
    'ssd',
    'Portable SSD',
    'One-terabyte external solid-state drive.',
    9900,
    'peripherals',
  ],
  [
    'card-reader',
    'Card reader',
    'USB-C reader for SD and microSD cards.',
    1900,
    'peripherals',
  ],
  [
    'wrist-rest',
    'Wrist rest',
    'Cushioned support for long typing sessions.',
    2200,
    'other',
  ],
  [
    'screen-light',
    'Screen light bar',
    'Monitor-mounted light for a clear desktop.',
    5500,
    'other',
  ],
];
products.push(
  ...additionalProducts.map(
    ([id, title, description, priceMinor, categoryId]) => ({
      id,
      title,
      description,
      priceMinor,
      categoryId,
      badge: null,
    }),
  ),
);

// The caller owns the connected client. All inserts are atomic and preserve existing rows.
export async function seedCatalog(client) {
  await client.query('BEGIN');
  try {
    for (const category of categories) {
      await client.query(
        'INSERT INTO categories (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [category.id, category.name, category.slug],
      );
    }
    for (const product of products) {
      await client.query(
        'INSERT INTO products (id, title, description, price_minor, currency, badge, category_id) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
        [
          product.id,
          product.title,
          product.description,
          product.priceMinor,
          'USD',
          product.badge,
          product.categoryId,
        ],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  config({ quiet: true });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error('DATABASE_URL is required to seed the catalog.');
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await seedCatalog(client);
    console.log('Catalog seed complete. Existing records were preserved.');
  } finally {
    await client.end();
  }
}
