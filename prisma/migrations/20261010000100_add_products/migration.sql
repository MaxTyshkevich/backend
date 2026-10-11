CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "price_minor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "badge" VARCHAR(80),
    "rating" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "products_price_nonnegative" CHECK ("price_minor" >= 0),
    CONSTRAINT "products_rating_range" CHECK ("rating" >= 0 AND "rating" <= 5),
    CONSTRAINT "products_currency_usd" CHECK ("currency" = 'USD')
);

-- Preserve IDs and prices so existing saved carts remain valid.
-- Ratings stay NULL until real ratings are available.
INSERT INTO "products" ("id", "title", "description", "price_minor", "currency", "badge") VALUES
    ('keyboard', 'Split keyboard', 'A split keyboard for a comfortable desktop workspace.', 14900, 'USD', 'new'),
    ('monitor', 'Portable monitor', 'A portable monitor for an additional screen at home or on the move.', 22900, 'USD', NULL),
    ('dock', 'USB-C dock', 'A USB-C dock for connecting desktop peripherals.', 11900, 'USD', 'team pick');
