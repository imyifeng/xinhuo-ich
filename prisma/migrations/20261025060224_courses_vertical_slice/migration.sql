-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED');

-- CreateTable
CREATE TABLE "course" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "craft_item_id" TEXT NOT NULL,
    "author_id" INTEGER NOT NULL,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "image_url" TEXT,

    CONSTRAINT "step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_record" (
    "user_id" INTEGER NOT NULL,
    "step_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_record_pkey" PRIMARY KEY ("user_id","step_id")
);

-- CreateIndex
CREATE INDEX "course_craft_item_id_status_idx" ON "course"("craft_item_id", "status");

-- CreateIndex
CREATE INDEX "course_author_id_idx" ON "course"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "step_course_id_order_key" ON "step"("course_id", "order");

-- CreateIndex
CREATE INDEX "learning_record_step_id_idx" ON "learning_record"("step_id");

-- AddForeignKey
ALTER TABLE "course" ADD CONSTRAINT "course_craft_item_id_fkey" FOREIGN KEY ("craft_item_id") REFERENCES "craft_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course" ADD CONSTRAINT "course_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step" ADD CONSTRAINT "step_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_record" ADD CONSTRAINT "learning_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_record" ADD CONSTRAINT "learning_record_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "step"("id") ON DELETE CASCADE ON UPDATE CASCADE;
