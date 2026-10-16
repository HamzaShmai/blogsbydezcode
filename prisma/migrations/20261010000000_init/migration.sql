-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('AGENCY', 'CLIENT');
CREATE TYPE "Role" AS ENUM ('AGENCY_ADMIN', 'AGENCY_MEMBER', 'CLIENT_ADMIN', 'CLIENT_VIEWER');
CREATE TYPE "CmsType" AS ENUM ('WORDPRESS', 'SHOPIFY', 'CUSTOM_WEBHOOK', 'GIT_CONTENT');
CREATE TYPE "PublishMode" AS ENUM ('DRAFT_ONLY', 'APPROVAL_REQUIRED', 'FULL_AUTOPILOT');
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PENDING_APPROVAL', 'PUBLISHED', 'FAILED', 'REJECTED');
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'STALE');
CREATE TYPE "JobType" AS ENUM ('SYNC_GSC', 'CRAWL_SEO_AUDIT', 'DISCOVER_TOPICS', 'RESEARCH_TOPIC', 'GENERATE_ARTICLE', 'GENERATE_IMAGE', 'QUALITY_CHECK', 'PUBLISH_ARTICLE', 'VERIFY_PUBLICATION', 'MONITOR_GSC_FEEDBACK', 'MONTHLY_REPORT', 'STALE_JOB_RECOVERY', 'AUTOPILOT_PIPELINE');
CREATE TYPE "IssueSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');
CREATE TYPE "OpportunityType" AS ENUM ('DECLINING_PAGE', 'CONTENT_GAP', 'NEW_TOPIC', 'QUERY_OPPORTUNITY');
CREATE TYPE "DataKind" AS ENUM ('MEASURED', 'ESTIMATE', 'RECOMMENDATION');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "OrgType" NOT NULL,
    "agencyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Website" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "cmsType" "CmsType" NOT NULL,
    "credentialsEnc" TEXT,
    "gscProperty" TEXT,
    "gscTokensEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Website_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsiteSettings" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "autopilotEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publishMode" "PublishMode" NOT NULL DEFAULT 'APPROVAL_REQUIRED',
    "dailyPublishLimit" INTEGER NOT NULL DEFAULT 1,
    "weeklyPublishLimit" INTEGER NOT NULL DEFAULT 5,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "publishTimes" TEXT[] DEFAULT ARRAY['09:00']::TEXT[],
    "categoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiProvider" TEXT NOT NULL DEFAULT 'openai',
    "imageProvider" TEXT NOT NULL DEFAULT 'openai',
    "maxUsageBudgetUsd" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "minQualityThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "automaticTechnicalFixes" BOOLEAN NOT NULL DEFAULT false,
    "notifyOnPublish" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnFailure" BOOLEAN NOT NULL DEFAULT true,
    "gscSyncCron" TEXT NOT NULL DEFAULT '0 6 * * *',
    "auditCron" TEXT NOT NULL DEFAULT '0 7 * * 1',
    "topicDiscoveryCron" TEXT NOT NULL DEFAULT '0 8 * * 1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebsiteSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "contentHtml" TEXT NOT NULL DEFAULT '',
    "contentMarkdown" TEXT NOT NULL DEFAULT '',
    "excerpt" TEXT,
    "seoTitle" TEXT,
    "metaDescription" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featuredImageUrl" TEXT,
    "featuredImageAlt" TEXT,
    "contentHash" TEXT,
    "cmsPostId" TEXT,
    "publishedUrl" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "manuallyEditedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "qualityScore" DOUBLE PRECISION,
    "topicId" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArticleVersion" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "contentMarkdown" TEXT NOT NULL,
    "seoTitle" TEXT,
    "metaDescription" TEXT,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArticleVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArticleAsset" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'featured',
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArticleAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchBrief" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sourcesJson" TEXT NOT NULL DEFAULT '[]',
    "hasLiveResearch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResearchBrief_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Outline" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "headings" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Outline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InternalLinkSuggestion" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "anchorText" TEXT NOT NULL,
    "reason" TEXT,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InternalLinkSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicationAttempt" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "cmsPostId" TEXT,
    "publishedUrl" TEXT,
    "errorLog" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GscSnapshot" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kind" "DataKind" NOT NULL DEFAULT 'MEASURED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GscSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GscQuery" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "kind" "DataKind" NOT NULL DEFAULT 'MEASURED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GscQuery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GscPage" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "kind" "DataKind" NOT NULL DEFAULT 'MEASURED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GscPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoAudit" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "healthScore" DOUBLE PRECISION,
    "pagesCrawled" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SeoAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoIssue" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "IssueSeverity" NOT NULL DEFAULT 'WARNING',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeoIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentOpportunity" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "type" "OpportunityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidenceJson" TEXT NOT NULL DEFAULT '{}',
    "kind" "DataKind" NOT NULL DEFAULT 'RECOMMENDATION',
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TopicRecommendation" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "searchIntent" TEXT,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feedbackScore" DOUBLE PRECISION,
    "rationale" TEXT,
    "evidenceJson" TEXT NOT NULL DEFAULT '{}',
    "kind" "DataKind" NOT NULL DEFAULT 'RECOMMENDATION',
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TopicRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "payloadHash" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockUntil" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "resultJson" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "metaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobLock" (
    "id" TEXT NOT NULL,
    "lockKey" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobLock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "units" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmergencyStop" (
    "id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "activatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmergencyStop_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthlyReport" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "summaryJson" TEXT NOT NULL,
    "kind" "DataKind" NOT NULL DEFAULT 'MEASURED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonthlyReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");
CREATE INDEX "Membership_organizationId_idx" ON "Membership"("organizationId");
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");
CREATE INDEX "Invite_email_idx" ON "Invite"("email");
CREATE INDEX "Website_organizationId_idx" ON "Website"("organizationId");
CREATE UNIQUE INDEX "Website_organizationId_domain_key" ON "Website"("organizationId", "domain");
CREATE UNIQUE INDEX "WebsiteSettings_websiteId_key" ON "WebsiteSettings"("websiteId");
CREATE UNIQUE INDEX "Category_websiteId_slug_key" ON "Category"("websiteId", "slug");
CREATE UNIQUE INDEX "Article_websiteId_slug_key" ON "Article"("websiteId", "slug");
CREATE INDEX "Article_websiteId_status_idx" ON "Article"("websiteId", "status");
CREATE INDEX "Article_scheduledAt_idx" ON "Article"("scheduledAt");
CREATE UNIQUE INDEX "ArticleVersion_articleId_version_key" ON "ArticleVersion"("articleId", "version");
CREATE UNIQUE INDEX "ResearchBrief_articleId_key" ON "ResearchBrief"("articleId");
CREATE UNIQUE INDEX "Outline_articleId_key" ON "Outline"("articleId");
CREATE UNIQUE INDEX "PublicationAttempt_articleId_idempotencyKey_key" ON "PublicationAttempt"("articleId", "idempotencyKey");
CREATE INDEX "PublicationAttempt_articleId_idx" ON "PublicationAttempt"("articleId");
CREATE UNIQUE INDEX "GscSnapshot_websiteId_date_key" ON "GscSnapshot"("websiteId", "date");
CREATE INDEX "GscQuery_websiteId_query_idx" ON "GscQuery"("websiteId", "query");
CREATE INDEX "GscPage_websiteId_pageUrl_idx" ON "GscPage"("websiteId", "pageUrl");
CREATE INDEX "SeoIssue_auditId_resolved_idx" ON "SeoIssue"("auditId", "resolved");
CREATE INDEX "ContentOpportunity_websiteId_dismissed_idx" ON "ContentOpportunity"("websiteId", "dismissed");
CREATE INDEX "TopicRecommendation_websiteId_score_idx" ON "TopicRecommendation"("websiteId", "score");
CREATE UNIQUE INDEX "Job_idempotencyKey_key" ON "Job"("idempotencyKey");
CREATE INDEX "Job_status_scheduledFor_idx" ON "Job"("status", "scheduledFor");
CREATE INDEX "Job_websiteId_type_idx" ON "Job"("websiteId", "type");
CREATE INDEX "Job_payloadHash_idx" ON "Job"("payloadHash");
CREATE INDEX "JobLog_jobId_idx" ON "JobLog"("jobId");
CREATE UNIQUE INDEX "JobLock_lockKey_key" ON "JobLock"("lockKey");
CREATE INDEX "UsageRecord_websiteId_createdAt_idx" ON "UsageRecord"("websiteId", "createdAt");
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
CREATE UNIQUE INDEX "MonthlyReport_websiteId_year_month_key" ON "MonthlyReport"("websiteId", "year", "month");

ALTER TABLE "Organization" ADD CONSTRAINT "Organization_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Website" ADD CONSTRAINT "Website_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebsiteSettings" ADD CONSTRAINT "WebsiteSettings_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "TopicRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ArticleVersion" ADD CONSTRAINT "ArticleVersion_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleAsset" ADD CONSTRAINT "ArticleAsset_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchBrief" ADD CONSTRAINT "ResearchBrief_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Outline" ADD CONSTRAINT "Outline_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLinkSuggestion" ADD CONSTRAINT "InternalLinkSuggestion_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationAttempt" ADD CONSTRAINT "PublicationAttempt_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GscSnapshot" ADD CONSTRAINT "GscSnapshot_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GscQuery" ADD CONSTRAINT "GscQuery_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GscPage" ADD CONSTRAINT "GscPage_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoAudit" ADD CONSTRAINT "SeoAudit_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoIssue" ADD CONSTRAINT "SeoIssue_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "SeoAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentOpportunity" ADD CONSTRAINT "ContentOpportunity_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TopicRecommendation" ADD CONSTRAINT "TopicRecommendation_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobLog" ADD CONSTRAINT "JobLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MonthlyReport" ADD CONSTRAINT "MonthlyReport_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
