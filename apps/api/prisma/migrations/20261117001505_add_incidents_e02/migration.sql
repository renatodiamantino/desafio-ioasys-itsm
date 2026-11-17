-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "category_id" UUID,
ADD COLUMN     "hold_reason_id" UUID,
ADD COLUMN     "resolution_code_id" UUID,
ADD COLUMN     "subcategory_id" UUID;

-- CreateTable
CREATE TABLE "task_comments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "source" VARCHAR(20) NOT NULL DEFAULT 'WEB',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resolution_codes" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "resolution_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hold_reasons" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "hold_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_comments_task_id_created_at_idx" ON "task_comments"("task_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "resolution_codes_name_key" ON "resolution_codes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "hold_reasons_name_key" ON "hold_reasons"("name");

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_hold_reason_id_fkey" FOREIGN KEY ("hold_reason_id") REFERENCES "hold_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_resolution_code_id_fkey" FOREIGN KEY ("resolution_code_id") REFERENCES "resolution_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
