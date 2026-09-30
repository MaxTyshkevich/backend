-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "password_hash" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "token_hash" VARCHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("token_hash")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "quantities" JSONB NOT NULL DEFAULT '{}',
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_claims" (
    "cart_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "guest_claims_pkey" PRIMARY KEY ("cart_id")
);

-- CreateTable
CREATE TABLE "auth_attempts" (
    "bucket" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "resets_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auth_attempts_pkey" PRIMARY KEY ("bucket")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "guest_claims_user_id_idx" ON "guest_claims"("user_id");

-- CreateIndex
CREATE INDEX "auth_attempts_resets_at_idx" ON "auth_attempts"("resets_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_claims" ADD CONSTRAINT "guest_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
