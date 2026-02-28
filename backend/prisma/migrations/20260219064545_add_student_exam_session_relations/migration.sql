-- CreateTable
CREATE TABLE "StudentExamSession" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "examId" INTEGER NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "systemChecked" BOOLEAN NOT NULL DEFAULT false,
    "rulesAccepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentExamSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentExamSession_studentId_examId_key" ON "StudentExamSession"("studentId", "examId");

-- AddForeignKey
ALTER TABLE "StudentExamSession" ADD CONSTRAINT "StudentExamSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExamSession" ADD CONSTRAINT "StudentExamSession_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
