-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "fixedTheme" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "fixedThemes" TEXT NOT NULL DEFAULT '';
