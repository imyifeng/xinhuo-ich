/*
  Warnings:

  - You are about to drop the column `category` on the `craft_item` table. All the data in the column will be lost.
  - Added the required column `batch` to the `craft_item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `craft_item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `features` to the `craft_item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `history` to the `craft_item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subcategory` to the `craft_item` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CraftItemStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "BehaviorEventType" AS ENUM ('VIEW_ITEM', 'START_COURSE', 'COMPLETE_STEP', 'CREATE_POST', 'CREATE_COMMENT');

-- AlterTable
ALTER TABLE "craft_item" DROP COLUMN "category",
ADD COLUMN     "batch" TEXT NOT NULL,
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "features" TEXT NOT NULL,
ADD COLUMN     "history" TEXT NOT NULL,
ADD COLUMN     "images" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "status" "CraftItemStatus" NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN     "subcategory" TEXT NOT NULL,
ADD COLUMN     "video_url" TEXT;

-- CreateTable
CREATE TABLE "inheritor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "craft_item_id" TEXT NOT NULL,

    CONSTRAINT "inheritor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "craft_item_tag" (
    "craft_item_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "craft_item_tag_pkey" PRIMARY KEY ("craft_item_id","tag_id")
);

-- CreateTable
CREATE TABLE "behavior_event" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER,
    "type" "BehaviorEventType" NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "behavior_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inheritor_craft_item_id_name_key" ON "inheritor"("craft_item_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tag_name_key" ON "tag"("name");

-- CreateIndex
CREATE INDEX "behavior_event_user_id_type_idx" ON "behavior_event"("user_id", "type");

-- CreateIndex
CREATE INDEX "behavior_event_type_target_id_idx" ON "behavior_event"("type", "target_id");

-- CreateIndex
CREATE INDEX "craft_item_status_subcategory_idx" ON "craft_item"("status", "subcategory");

-- AddForeignKey
ALTER TABLE "inheritor" ADD CONSTRAINT "inheritor_craft_item_id_fkey" FOREIGN KEY ("craft_item_id") REFERENCES "craft_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "craft_item_tag" ADD CONSTRAINT "craft_item_tag_craft_item_id_fkey" FOREIGN KEY ("craft_item_id") REFERENCES "craft_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "craft_item_tag" ADD CONSTRAINT "craft_item_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "behavior_event" ADD CONSTRAINT "behavior_event_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
