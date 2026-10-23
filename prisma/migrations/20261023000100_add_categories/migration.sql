CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

INSERT INTO "categories" ("id", "name", "slug") VALUES
    ('peripherals', 'Периферия', 'peripherals'),
    ('monitors', 'Мониторы', 'monitors'),
    ('other', 'Прочее', 'other');

-- Keep all existing products, IDs, prices and carts; classify custom products as other.
ALTER TABLE "products" ADD COLUMN "category_id" TEXT NOT NULL DEFAULT 'other';
UPDATE "products" SET "category_id" = 'peripherals', "updated_at" = CURRENT_TIMESTAMP
WHERE "id" IN ('keyboard', 'dock');
UPDATE "products" SET "category_id" = 'monitors', "updated_at" = CURRENT_TIMESTAMP
WHERE "id" = 'monitor';
CREATE INDEX "products_category_id_idx" ON "products"("category_id");
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
