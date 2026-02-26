-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "theme" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "themes" TEXT NOT NULL DEFAULT '';
