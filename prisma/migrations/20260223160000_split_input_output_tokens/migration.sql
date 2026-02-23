-- AlterTable: split totalTokens into inputTokens + outputTokens
ALTER TABLE "Photo" ADD COLUMN "inputTokens" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Photo" ADD COLUMN "outputTokens" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Photo" DROP COLUMN "totalTokens";
