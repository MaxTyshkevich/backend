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
