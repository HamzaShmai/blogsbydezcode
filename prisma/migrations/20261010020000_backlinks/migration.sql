-- CreateEnum
CREATE TYPE "BacklinkStatus" AS ENUM ('NEW', 'SHORTLISTED', 'OUTREACH', 'WON', 'SKIPPED');

-- CreateEnum
CREATE TYPE "BacklinkKind" AS ENUM ('GUEST_POST', 'RESOURCE_PAGE', 'DIRECTORY', 'PARTNER', 'MENTION', 'FORUM', 'OTHER');

-- CreateTable
CREATE TABLE "BacklinkProspect" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "BacklinkKind" NOT NULL DEFAULT 'OTHER',
    "status" "BacklinkStatus" NOT NULL DEFAULT 'NEW',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nicheFit" TEXT,
    "outreachAngle" TEXT,
    "contactHint" TEXT,
    "evidenceJson" TEXT NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL DEFAULT 'ai_agent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BacklinkProspect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BacklinkProspect_websiteId_status_score_idx" ON "BacklinkProspect"("websiteId", "status", "score");

-- CreateIndex
CREATE UNIQUE INDEX "BacklinkProspect_websiteId_url_key" ON "BacklinkProspect"("websiteId", "url");

-- AddForeignKey
ALTER TABLE "BacklinkProspect" ADD CONSTRAINT "BacklinkProspect_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
