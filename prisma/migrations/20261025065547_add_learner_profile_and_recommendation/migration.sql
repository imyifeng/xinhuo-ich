-- CreateTable
CREATE TABLE "learner_profile" (
    "user_id" INTEGER NOT NULL,
    "cluster_label" TEXT NOT NULL,
    "cluster_index" INTEGER NOT NULL,
    "feature_vector" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_profile_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "recommendation" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "craft_item_id" TEXT,
    "course_id" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learner_profile_cluster_index_idx" ON "learner_profile"("cluster_index");

-- CreateIndex
CREATE INDEX "recommendation_user_id_score_idx" ON "recommendation"("user_id", "score");

-- AddForeignKey
ALTER TABLE "learner_profile" ADD CONSTRAINT "learner_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
