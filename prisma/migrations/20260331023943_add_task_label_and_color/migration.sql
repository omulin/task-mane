/*
  Warnings:

  - A unique constraint covering the columns `[teamId,name]` on the table `subTeams` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `teams` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "color" TEXT NOT NULL DEFAULT '#4a90e2',
ADD COLUMN     "label" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "subTeams_teamId_name_key" ON "subTeams"("teamId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "teams_name_key" ON "teams"("name");
