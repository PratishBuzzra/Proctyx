/*
  Warnings:

  - You are about to drop the `StudentExamSession` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "StudentExamSession" DROP CONSTRAINT "StudentExamSession_examId_fkey";

-- DropForeignKey
ALTER TABLE "StudentExamSession" DROP CONSTRAINT "StudentExamSession_studentId_fkey";

-- DropTable
DROP TABLE "StudentExamSession";

-- CreateTable
CREATE TABLE "Violation" (
    "id" SERIAL NOT NULL,
    "examId" INTEGER NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Violation_pkey" PRIMARY KEY ("id")
);
