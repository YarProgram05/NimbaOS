# Graph Report - Nimba_digitization  (2026-09-02)

## Corpus Check
- 322 files · ~197,725 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2922 nodes · 7793 edges · 177 communities (126 shown, 34 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 130 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Analytics UI Pages
- Shared Report UI
- UI Form Components
- FBS Client Workspace
- FBS Sync State
- Database Schema Migrations
- Dashboard Summary Freshness
- FBS Sheet Planning
- Automation Server Actions
- Automation Detail Interfaces
- FBS Authorization Actions
- FBS Sheet Workflow
- Admin Automation Interfaces
- Automation Processing History
- Stock and Reference UI
- Morning Report Workflow
- Automation Workflow Registry
- Advertising Server Actions
- Flexible Schedule Logic
- Dashboard Problem Center
- User Session Shell
- Stock Analytics Services
- Dashboard Report Export
- WB Account Management
- Advertising Campaign Sync
- Dashboard Overview Page
- Runtime Dependencies
- TypeScript Compiler Configuration
- Sync Schedule Persistence
- Sync Schedule UI
- Sync Queue and Coverage
- Encrypted API Synchronization
- Cabinet Factor Analysis
- Manual Sync Actions
- Marketplace Guidance Memory
- Database and Authentication
- Advertising Reference UI
- FBS KIZ Workspace
- WB API Client Layer
- KPI Reporting Rules
- Advertising Stats Sync
- Campaign Analytics UI
- Sales Plan Detail
- FBS History Queries
- Product Catalog Sync
- Development Dependencies
- Sales Plan and Orders
- Audited FBS Operations
- Margin Response Report
- Sync Queue Contracts
- Sales Plan Actions
- Report Calculation Engine
- Account Security
- Sync Job History
- Feedback API Types
- Advertising Metric Grids
- Reference Write Actions
- Review Management UI
- Feedback Query Services
- Dashboard Data Types
- Development Tasks and Incidents
- Project Script Commands
- Sales Plan Calculation
- UI Component Configuration
- Dashboard Period Export
- Dashboard Chart Components
- Reference Read Layer
- Advertising Spend Attribution
- FBS Data Freshness
- Automation Catalog Templates
- Finance API Contracts
- Financial Report Calculation
- Cancellation Analysis Script
- Product Cards UI
- Feedback Synchronization
- Product Server Actions
- Financial Report UI
- Report Actions and Pages
- Review Page Types
- Sync Control UI
- Feedback Write Operations
- Production Runtime Infrastructure
- Product Advertising Stats
- Campaign Detail Control
- Stock Synchronization
- Deployment and Project State
- Advertising Cluster UI
- Report Column Definitions
- Feedback Server Actions
- Plan Detail Metrics
- WB API Documentation
- Commission Shift Analysis
- Realization Report Sync
- Reference Write Models
- Review List Controller
- FBS Analytics
- Paid Storage API
- Cost Price Management
- Core Architecture Documentation
- Open Architecture Questions
- App Layout Providers
- Report Data Aggregation
- SPP Calculator
- Automation Dashboard
- Product Card Controller
- Article Version Writes
- Paid Storage Sync
- Safety and Write Guards
- Dashboard Server Actions
- Stock Client Controls
- Moscow Schedule Utilities
- Agent Documentation Navigation
- Cloudflare Proxy
- Reply Template Tab
- Schedule Editor
- Scheduled Job Policy
- Financial Group Calculations
- Workflow Scheduling Documentation
- Margin Analysis Script
- User Invitation Dialog
- Reply Template Groups
- Windows Deployment Script
- ESLint Configuration
- Database Seed
- Report Verification Script
- Article Override Dialog
- Development Memory Log
- PostCSS Configuration
- Health Check Endpoint
- User Profile
- Clsx Dependency
- Date Fns Dependency
- Google APIs Dependency
- Hookform Resolvers Dependency
- IORedis Dependency
- Lucide React Dependency
- NextAuth Dependency
- Nextjs Configuration
- Next Themes Dependency
- Pino Dependency
- Prisma CLI Dependency
- Prisma Postgres Adapter
- Prisma Client Dependency
- Radix Avatar Dependency
- Radix Dialog Dependency
- Radix Label Dependency
- Radix Slot Dependency
- Radix Tabs Dependency
- Radix Tooltip Dependency
- React Dependency
- React Day Picker
- React DOM Dependency
- Recharts Dependency
- Shadcn Dependency
- Tailwind PostCSS Dependency
- Tanstack Table Dependency
- Tailwind Animation Dependency
- Bcrypt Type Definitions
- XLSX Library Dependency
- Zod Validation Dependency

## God Nodes (most connected - your core abstractions)
1. `cn()` - 88 edges
2. `WbApiClient` - 66 edges
3. `prisma` - 63 edges
4. `calculateReport()` - 62 edges
5. `decrypt()` - 54 edges
6. `Button` - 48 edges
7. `FbsClient()` - 43 edges
8. `runFbsMovementSheetWorkflow()` - 37 edges
9. `authOptions` - 34 edges
10. `getDashboardSummary()` - 33 edges

## Surprising Connections (you probably didn't know these)
- `Coverage, Run History, and Domain Freshness Signals` --implemented_by--> `getSyncCoverage()`  [INFERRED]
  docs/core/DATA_FRESHNESS_POLICY.md → src/lib/sync/coverage.ts
- `Report Freshness Gate` --implemented_by--> `getSyncCoverage()`  [INFERRED]
  docs/marketplace/REPORTS_GUIDE.md → src/lib/sync/coverage.ts
- `DB-First Idempotent FBS Movement Sheet Workflow` --implemented_by--> `runFbsMovementSheetWorkflow()`  [INFERRED]
  docs/core/SCHEDULED_AUTOMATION.md → src/lib/services/fbs-movement-sheet-workflow.ts
- `Morning Report` --implemented_by--> `runMorningWbReportWorkflow()`  [EXTRACTED]
  docs/marketplace/REPORTS_GUIDE.md → src/lib/services/morning-wb-report-workflow.ts
- `Finance Detailed Sales Reports API Migration` --implemented_by--> `syncRealizationReport()`  [INFERRED]
  docs/core/WB_API_MAP.md → src/lib/services/sync-reports.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Live Advertising Cost Branch with Persisted Statistics Fallback** — graphify_out_memory_query_20260902_151556_report_options, graphify_out_memory_query_20260902_151556_buildadspendbynm, graphify_out_memory_query_20260902_151556_wbapiclient, graphify_out_memory_query_20260902_151556_live_ad_cost, graphify_out_memory_query_20260902_151556_ad_stats_fallback [EXTRACTED 1.00]
- **Local Database Through Calculation Services to Financial Report KPIs** — graphify_out_memory_query_20260902_151556_local_tables, graphify_out_memory_query_20260902_151556_calculatereport, graphify_out_memory_query_20260902_151556_getreportdata, docs_marketplace_reports_guide_financial_report, graphify_out_memory_query_20260902_151556_ordered_rub, graphify_out_memory_query_20260902_151556_buyout_percent, graphify_out_memory_query_20260902_151556_drr, graphify_out_memory_query_20260902_151556_romi [EXTRACTED 1.00]
- **Permanent Graphify Workflow Contract** — agents_graphify_memory_workflow, graphify_out_memory_query_20260902_154125_verify_the_permanent_graphify_first_project_workfl_canonical_source_of_truth_precedence, graphify_out_memory_query_20260902_154125_verify_the_permanent_graphify_first_project_workfl_source_and_graph_synchronization_completion_rule [EXTRACTED 1.00]
- **Implemented Platform Capabilities** — docs_core_project_state_financial_reports, docs_core_project_state_dashboard_and_analytics, docs_core_project_state_background_processing, docs_core_project_state_fbs_stage_1, docs_core_project_state_google_sheets_workflows, docs_core_project_state_production_operations [EXTRACTED 1.00]
- **Verified and Owner-Controlled Production Release** — _github_workflows_ci_verification_pipeline, _github_workflows_deploy_production_production_deployment, decisions_owner_confirmed_release, docs_core_commands_confirmed_release_procedure, docs_core_mini_pc_runbook_controlled_release_workflow [INFERRED 0.95]
- **DB-First Analytics and Reporting Pipeline** — decisions_database_analytics_truth, docs_core_architecture_db_first_data_flow, docs_core_database_access_guide_preferred_service_entrypoints, docs_core_data_freshness_policy_incremental_sync_policy, docs_core_wb_api_map_sync_services, docs_core_scheduled_automation_morning_report [INFERRED 0.95]
- **DB-First Freshness-Gated Reporting Flow** — docs_marketplace_marketplace_agent_marketplace_agent, docs_marketplace_analytics_playbook_db_first_analytics, docs_marketplace_analytics_playbook_report_freshness_check, docs_marketplace_daily_checklist_daily_operating_review [INFERRED 0.95]
- **FBS Operational Integrity** — docs_core_project_state_fbs_stage_1, docs_core_project_state_google_sheets_workflows, docs_core_project_state_fbs_operator_reconciliation, docs_core_project_state_stable_fbs_tuple_identity [INFERRED 0.95]
- **FBS Physical Inventory Control** — docs_marketplace_marketplace_handoff_fbs_identity_by_stable_tuple, docs_marketplace_marketplace_handoff_human_reviewed_replenishment, docs_marketplace_marketplace_current_tasks_mkt_fbs_replenishment_review, docs_marketplace_kpi_definitions_fbs_available_stock, docs_marketplace_kpi_definitions_fbs_stock_mismatch, docs_marketplace_reports_guide_fbs_operations_report [INFERRED 0.95]
- **Canonical Source to Graphify Update and Verification Lifecycle** — agents_graphify_memory_workflow, agents_source_of_truth_precedence, agents_graph_sync_completion, docs_development_dev_log_permanent_graphify_workflow [INFERRED 0.95]
- **Guarded FBS Inventory, KIZ, Sync, and Mutation System** — specification_fbs_kiz_domain, decisions_fbs_operational_boundary, docs_core_architecture_fbs_write_flow, docs_core_data_model_fbs_data_model, docs_core_safety_rules_fbs_write_safety, docs_core_scheduled_automation_fbs_movement_sheet, docs_core_wb_api_map_fbs_operational_sync, docs_core_wb_api_map_fbs_write_wrappers [INFERRED 0.95]
- **Owner-Approved Change Control** — docs_development_development_agent_explicit_confirmation_gate, docs_development_dev_handoff_controlled_production_rollout, docs_marketplace_marketplace_agent_marketplace_agent, docs_marketplace_decision_rules_recommend_price_decrease, docs_marketplace_decision_rules_recommend_ads_change [INFERRED 0.95]
- **Production Access and Rollout Controls** — docs_core_project_state_mini_pc_production, docs_core_project_state_trusted_tailscale_path, docs_core_project_state_public_cloudflare_limitation, docs_core_project_state_local_release_delta, docs_core_project_state_explicit_approval_gate [INFERRED 0.95]

## Communities (177 total, 34 thin omitted)

### Community 0 - "Analytics UI Pages"
Cohesion: 0.06
Nodes (76): ActiveCampaignList(), AnalyticsAdvertisingPage(), campaignHref(), formatDateShort(), AnalyticsEmptyState(), AnalyticsOverviewCards(), AnalyticsPageProps, analyticsQuery() (+68 more)

### Community 1 - "Shared Report UI"
Cohesion: 0.05
Nodes (73): OverrideDialog(), onSubmit(), ArticleVersionDialog(), handleClose(), onSubmit(), CostPriceTab(), handleExportTemplate(), handleImportFile() (+65 more)

### Community 2 - "UI Form Components"
Cohesion: 0.08
Nodes (56): ArticleOverrideTab(), handleDelete(), ArticleOverrideTabProps, FormValues, OverrideDialogProps, schema, ArticleVersionDialogProps, ArticleVersionTab() (+48 more)

### Community 3 - "FBS Client Workspace"
Cohesion: 0.05
Nodes (48): analyticsSortValue(), ASSORTMENT_SORT_OPTIONS, assortmentSortValue(), CIRCULATION_LABELS, compareSortValues(), downloadBase64(), FbsClient(), confirmComplianceBatch() (+40 more)

### Community 4 - "FBS Sync State"
Cohesion: 0.07
Nodes (49): CardsClient(), buildUrl(), handleBrandChange(), handleCategoryChange(), handleMobileSort(), handleSearchClear(), handleSearchSubmit(), handleSortingChange() (+41 more)

### Community 5 - "Database Schema Migrations"
Cohesion: 0.08
Nodes (61): actionCategoryRank(), actionSeverityRank(), addDays(), buildActionRecommendations(), buildDashboardForecasts(), buildFinancialBreakdown(), buildOverviewBuckets(), buildOverviewCharts() (+53 more)

### Community 6 - "Dashboard Summary Freshness"
Cohesion: 0.08
Nodes (53): assertInventoryBalance(), deriveFbsTransition(), FbsOrderState, FbsTransitionAction, isFbsOrderCanceledBeforeHandoff(), isFbsPostHandoffReturnStatus(), POST_HANDOFF_RETURN_STATUSES, PRE_HANDOFF_CANCELLATIONS (+45 more)

### Community 7 - "FBS Sheet Planning"
Cohesion: 0.10
Nodes (37): FormData, LoginPage(), schema, ClustersTab(), handleSync(), ClustersTabProps, formatDecimal(), formatNumber() (+29 more)

### Community 8 - "Automation Server Actions"
Cohesion: 0.11
Nodes (44): CampaignDetailPage(), CampaignDetailPageProps, handleExport(), CampaignWithAccount, depositBudgetAction(), displayCartAdds(), emptyNmAggregate(), exportAdStatsXlsxAction() (+36 more)

### Community 9 - "Automation Detail Interfaces"
Cohesion: 0.08
Nodes (44): addAdSpend(), addDays(), AdNmStatRow, AdSpendByNm, ADVERT_NM_ALLOCATION_OVERRIDES, applyAdBalanceTotalByAll(), applyAdvertNmAllocationOverrides(), ArticleVersionMeta (+36 more)

### Community 10 - "FBS Authorization Actions"
Cohesion: 0.12
Nodes (33): ROLE_CONFIG, RUN_HISTORY_COLUMN_WIDTHS, RUN_SORT_OPTIONS, STATUS_LABELS, STATUS_VARIANTS, AccountRow, JOB_LABELS, JOB_SORT_OPTIONS (+25 more)

### Community 11 - "FBS Sheet Workflow"
Cohesion: 0.09
Nodes (34): ROLES, DateRangePickerProps, PRESETS, Avatar, AvatarFallback, AvatarImage, CardFooter, DialogOverlay (+26 more)

### Community 12 - "Admin Automation Interfaces"
Cohesion: 0.10
Nodes (28): handler, ROLE_LABELS, RegisterForm(), onSubmit(), AdvertisingPage(), AdvertisingPageProps, FbsPageProps, SecurityForms() (+20 more)

### Community 13 - "Automation Processing History"
Cohesion: 0.11
Nodes (38): buildFbsWbStockSnapshots(), FBS_SHEET_SOURCE, FBS_WB_STOCK_HEADERS, FbsSheetAccountIdentity, FbsSheetDesiredEvent, FbsWbStockSnapshot, fbsWbStockSnapshotKey(), moscowDateString() (+30 more)

### Community 14 - "Stock and Reference UI"
Cohesion: 0.16
Nodes (37): runSync(), addFbsAssortmentItemAction(), adjustFbsInventoryAction(), assignKizToOrderAction(), attachAssignedKizToWbAction(), closeFbsSupplyInWbAction(), configureFbsAssortmentAction(), confirmKizComplianceBatchAction() (+29 more)

### Community 15 - "Morning Report Workflow"
Cohesion: 0.09
Nodes (35): buildFbsDesiredEvents(), comparableCell(), eventRowMatches(), eventStatus(), eventValues(), FBS_CONTROL_HEADERS, FBS_OPERATIONS_FIRST_DATA_ROW, FBS_OPERATIONS_HEADER_ROW (+27 more)

### Community 16 - "Automation Workflow Registry"
Cohesion: 0.14
Nodes (33): automationScheduleMatchesMoscowDate(), AutomationScheduleRule, buildAutomationScheduleRules(), defaultAutomationSchedule(), expandAutomationScheduleTimes(), formatAutomationSchedule(), getNextAutomationRunAt(), addCalendarDays() (+25 more)

### Community 17 - "Advertising Server Actions"
Cohesion: 0.09
Nodes (23): isDateKey(), ReviewsPage(), ReviewsPageProps, VALID_ANSWER_FILTERS, VALID_RATINGS, VALID_SORT_BY, VALID_TABS, ANSWER_LABELS (+15 more)

### Community 18 - "Flexible Schedule Logic"
Cohesion: 0.09
Nodes (27): ArticleDetailGrid(), ArticleDetailGridProps, formatMetricValue(), METRIC_ROWS, MetricFormatter, MetricRowDef, SalesPlanClientProps, syncFunnel() (+19 more)

### Community 19 - "Dashboard Problem Center"
Cohesion: 0.12
Nodes (32): advertisingHref(), buildAdvertisingIssues(), buildDashboardInsights(), buildDashboardProblemCenter(), BuildDashboardProblemCenterInput, buildFeedbackIssues(), buildFreshnessIssues(), buildProductIssues() (+24 more)

### Community 20 - "User Session Shell"
Cohesion: 0.10
Nodes (23): Props, AccountSelector(), DashboardShell(), Header(), HeaderProps, ADMIN_NAV_ITEMS, NAV_ITEMS, NavContent() (+15 more)

### Community 21 - "Stock Analytics Services"
Cohesion: 0.10
Nodes (29): AdvertisingClientProps, CampaignDetailClientProps, syncAdCampaigns(), ALL_AD_STATUSES, fetchAdvertList(), fetchCampaignBudget(), AD_STATUS_LABELS, AdActionLogRow (+21 more)

### Community 22 - "Dashboard Report Export"
Cohesion: 0.14
Nodes (29): getMorningReportData(), addDays(), buildDailyValues(), daysInMonth(), ensureReportSources(), firstDayOfMonth(), firstDayOfYear(), formatDate() (+21 more)

### Community 23 - "WB Account Management"
Cohesion: 0.14
Nodes (31): addDays(), aggregateNmStats(), buildDateChunks(), clampNumber(), DaySourceMetrics, formatDate(), getCampaignDays(), mergeMetrics() (+23 more)

### Community 24 - "Advertising Campaign Sync"
Cohesion: 0.13
Nodes (25): campaignRows(), compactRow(), DashboardPage(), DashboardPageProps, formatDate(), formatDateTime(), formatMetricValue(), formatNumber() (+17 more)

### Community 25 - "Dashboard Overview Page"
Cohesion: 0.13
Nodes (28): upsertDefaultSyncSchedule(), automationScheduleFingerprint(), shouldSkipScheduledJob(), flexibleScheduleFingerprint(), getSyncScheduleDefinition(), applyAllSyncSchedules(), applySyncSchedule(), buildJobData() (+20 more)

### Community 26 - "Runtime Dependencies"
Cohesion: 0.18
Nodes (28): exportReportXlsx(), appendContextSheet(), appendDashboardSummarySheets(), appendFeedbackRowsSheet(), appendFeedbackWorkloadSheets(), appendFreshnessSheet(), appendProductRiskSheets(), appendProductRowsSheet() (+20 more)

### Community 27 - "TypeScript Compiler Configuration"
Cohesion: 0.07
Nodes (29): @base-ui/react, bcryptjs, class-variance-authority, dependencies, @base-ui/react, bcryptjs, bullmq, class-variance-authority (+21 more)

### Community 28 - "Sync Schedule Persistence"
Cohesion: 0.13
Nodes (26): "ad_action_logs", "ad_campaign_clusters", "ad_campaign_nm_stats", "ad_campaign_stats", "ad_campaigns", "article_overrides", "cost_prices", "external_ads" (+18 more)

### Community 29 - "Sync Schedule UI"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, output, outputs (+20 more)

### Community 30 - "Sync Queue and Coverage"
Cohesion: 0.19
Nodes (28): inspectAutomationSpreadsheetAction(), primaryAutomationTime(), validateAutomationSchedule(), applyAllAutomationSchedules(), applyFbsMovementSheetSchedule(), applyMorningWbReportSchedule(), buildScheduledJobData(), defaultFbsAccountEnabled() (+20 more)

### Community 31 - "Encrypted API Synchronization"
Cohesion: 0.13
Nodes (17): SyncOrdersOptions, isNetworkFetchError(), lastRequestTime, sleep(), throttle(), WbApiClient, WbApiError, WbRateLimitError (+9 more)

### Community 32 - "Cabinet Factor Analysis"
Cohesion: 0.15
Nodes (26): AccountAnalysis, addDays(), addSheet(), aggregateBy(), analyzeAccount(), buildComparison(), buildFindings(), buildProductFactor() (+18 more)

### Community 33 - "Manual Sync Actions"
Cohesion: 0.20
Nodes (25): requireSession(), syncStocksAction(), deleteSyncJobRunAction(), enqueueAdCampaignsSyncAction(), enqueueAdClustersSyncAction(), enqueueAdStatsSyncAction(), enqueueManualSyncAction(), enqueuePlanSyncAction() (+17 more)

### Community 34 - "Marketplace Guidance Memory"
Cohesion: 0.15
Nodes (23): getKizComplianceExportDefinition(), KIZ_COMPLIANCE_EXPORTS, KizComplianceExportKind, toCrptUnitPriceRub(), isOrderMetadataReady(), adjustFbsInventory(), CirculationInput, closeFbsSupplyInWb() (+15 more)

### Community 35 - "Database and Authentication"
Cohesion: 0.12
Nodes (24): AutomationsClientProps, AutomationAccountRow, AutomationCatalogItem, AutomationGoogleSheetConfig, AutomationRunQuery, AutomationRunRow, AutomationRunSortKey, AutomationRunStatus (+16 more)

### Community 36 - "Advertising Reference UI"
Cohesion: 0.10
Nodes (15): ColMeta, ColumnMeta, reportColumns, @tanstack/react-table, DEFAULT_ORDER, formatMobileRub(), IDENTITY_COLUMNS, MOBILE_PRIMARY_METRICS (+7 more)

### Community 37 - "FBS KIZ Workspace"
Cohesion: 0.16
Nodes (23): PlanDetailPage(), PlanDetailPageProps, EditField, PlanDetailClientProps, SortCol, addItemsFromStockAction(), addPlanItemsAction(), createPlanAction() (+15 more)

### Community 38 - "WB API Client Layer"
Cohesion: 0.15
Nodes (21): AccountRow(), handleDeactivate(), handleKeyOpenChange(), handleSaveApiKey(), TaxRateCell(), save(), addWbAccount(), encryptedTokenExpirationIso() (+13 more)

### Community 39 - "KPI Reporting Rules"
Cohesion: 0.18
Nodes (21): startSyncWorker(), addDays(), assertNoInternalErrors(), collectInternalErrors(), formatDate(), KIND_TO_PRISMA, maxDate(), minDate() (+13 more)

### Community 40 - "Advertising Stats Sync"
Cohesion: 0.11
Nodes (19): FormData, Props, schema, COST_SORT_OPTIONS, SortCol, FormValues, ProfileForm(), onSubmit() (+11 more)

### Community 41 - "Campaign Analytics UI"
Cohesion: 0.09
Nodes (22): AnalyticsPeriodPicker(), AnalyticsPeriodPickerProps, ActionRecommendationCategory, DashboardAccount, DashboardComputeMode, DashboardFinancialBreakdown, DashboardForecastConfidence, DashboardForecastMetric (+14 more)

### Community 42 - "Sales Plan Detail"
Cohesion: 0.09
Nodes (19): AutomationDetailsClient(), refresh(), runWorkflow(), saveWorkflow(), formatNextRun(), FbsMovementSheetDetailsClient(), refresh(), runWorkflow() (+11 more)

### Community 43 - "FBS History Queries"
Cohesion: 0.14
Nodes (19): columnGroups, ReportsPage(), ReportsPageProps, GROUP_LABELS, GroupBy, ReportsClient(), handleDateRangeChange(), handleExport() (+11 more)

### Community 44 - "Product Catalog Sync"
Cohesion: 0.18
Nodes (21): aggregateRowsByCurrentUniqueKey(), formatDate(), mapRowToPrisma(), normalizeNullable(), parseDate(), splitPaidStoragePeriod(), syncPaidStorage(), createPaidStorageTask() (+13 more)

### Community 45 - "Development Dependencies"
Cohesion: 0.11
Nodes (20): Buyout Percent, Ordered Rub, "realization_reports", "wb_orders", "article_versions", main(), n(), pct() (+12 more)

### Community 46 - "Sales Plan and Orders"
Cohesion: 0.09
Nodes (22): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, postcss, tailwindcss, tsx (+14 more)

### Community 47 - "Audited FBS Operations"
Cohesion: 0.16
Nodes (20): argument(), runFbsBackfill(), getReportDate(), mapEnrichment(), mapRowToPrisma(), reconcileFinanceKiz(), safePrepareKiz(), syncRealizationReport() (+12 more)

### Community 48 - "Margin Response Report"
Cohesion: 0.11
Nodes (21): Analysis, Article, chartRows, data, esc(), inputPath, keep, maxLoss (+13 more)

### Community 49 - "Sync Queue Contracts"
Cohesion: 0.13
Nodes (19): SyncClientProps, FlexibleScheduleValidationOptions, BY_KIND, exact(), interval(), SYNC_ALLOWED_TIME_MODES, SYNC_SCHEDULE_CATEGORIES, SYNC_SCHEDULE_DEFINITIONS (+11 more)

### Community 50 - "Sales Plan Actions"
Cohesion: 0.14
Nodes (16): CANCELED_WB_STATUSES, FbsAnalyticsFinanceRow, FbsAnalyticsOrder, isFbsCanceledOrder(), isFbsFinanceRow(), NumberLike, summarizeFbsAnalytics(), vendorCodeKey() (+8 more)

### Community 51 - "Report Calculation Engine"
Cohesion: 0.14
Nodes (20): assertWbEnvelope(), buildParams(), FetchFeedbackListParams, fetchWbFeedbackById(), fetchWbFeedbacks(), fetchWbQuestionById(), fetchWbQuestions(), FeedbackSummary (+12 more)

### Community 52 - "Account Security"
Cohesion: 0.11
Nodes (21): Type-check, Test, Lint, and Build Quality Gate, CI Verification Pipeline, Self-Hosted Windows Mini-PC Runner, Owner-Confirmed Production Deployment, Production Release Verification, Owner-Confirmed Recoverable Production Release, Local PostgreSQL and Redis Runtime, Development PostgreSQL Service (+13 more)

### Community 53 - "Sync Job History"
Cohesion: 0.13
Nodes (21): Recommend Advertising Change Rule, CPO, DRR, FBS Available Stock, FBS Compliance Backlog, FBS Finance, FBS Financial Attribution by Account-Scoped Order ID, FBS Stock Mismatch (+13 more)

### Community 54 - "Feedback API Types"
Cohesion: 0.16
Nodes (18): DashboardExportButtons(), handleExport(), DashboardExportButtonsProps, EXPORT_OPTIONS, DashboardPeriodControls(), handlePresetChange(), handleRangeChange(), navigate() (+10 more)

### Community 55 - "Advertising Metric Grids"
Cohesion: 0.23
Nodes (20): AdvertisingCampaignsJobData, AdvertisingClustersJobData, AdvertisingStatsJobData, createSyncWorker(), FbsMarkingReportJobData, FbsOperationalJobData, FbsStocksCurrentJobData, getRedisConnection() (+12 more)

### Community 56 - "Reference Write Actions"
Cohesion: 0.13
Nodes (20): Explicit Confirmation Gate for Destructive and WB Writes, Service-First Database Access, Analytics Playbook, DB-First Marketplace Analytics, Report Freshness Check, Service-First Reporting, Daily Checklist, Daily Marketplace Operating Review (+12 more)

### Community 57 - "Review Management UI"
Cohesion: 0.21
Nodes (15): AdBreakdownGrid(), AdBreakdownGridProps, BREAKDOWN_METRIC_ROWS, BreakdownCell(), BreakdownMetricRow, shareText(), toNumber(), AD_METRIC_ROWS (+7 more)

### Community 58 - "Feedback Query Services"
Cohesion: 0.18
Nodes (18): getAutomationName(), fromPrismaAutomationKind(), KIND_TO_PRISMA, parseAutomationSource(), parseTargetDate(), PRISMA_TO_KIND, PrismaAutomationWorkflowKind, AUTOMATION_RUN_SOURCE_VALUES (+10 more)

### Community 59 - "Dashboard Data Types"
Cohesion: 0.24
Nodes (19): addDays(), defaultDateFrom(), formatDateKey(), getFeedbackSummary(), getPaginatedFeedback(), getUnansweredReviewTargetsByFilter(), mapQuestionRow(), mapReviewRow() (+11 more)

### Community 60 - "Development Tasks and Incidents"
Cohesion: 0.13
Nodes (19): Active Bugs and Incidents, BUG-001: WB Advertising API Long 429 Retry, BUG-002: Next Dev May Hang at Starting, BUG-004: Phase 7/8 Sync Smoke Matrix Incomplete, BUG-005: Product Prices Can Remain Blank, BUG-030 / BUG-026: Public Cloudflare Path Is Unreliable, Dev Current Tasks, TASK-AGNIA-SYNC-STATUS-VERIFY (+11 more)

### Community 61 - "Project Script Commands"
Cohesion: 0.11
Nodes (19): scripts, audit:fbs-sheet-mappings, automation:schedule, backfill:fbs, build, db:migrate, db:push, db:seed (+11 more)

### Community 62 - "Sales Plan Calculation"
Cohesion: 0.13
Nodes (15): InviteDialog(), handleGenerate(), AdminUsersPage(), UserRowActions(), handleDelete(), handleRoleChange(), handleToggleActive(), FbsPage() (+7 more)

### Community 63 - "UI Component Configuration"
Cohesion: 0.20
Nodes (14): average(), buildCampaignMetrics(), createEmptyDailyMetrics(), toDateString(), BreakdownTab(), BreakdownTabProps, initialRange(), parseDateKey() (+6 more)

### Community 64 - "Dashboard Period Export"
Cohesion: 0.15
Nodes (9): formatNumber(), formatRub(), formatTurnover(), MobileStockCard(), RISK_LABELS, STOCK_SORT_OPTIONS, StockRow(), WbArticleLink() (+1 more)

### Community 65 - "Dashboard Chart Components"
Cohesion: 0.23
Nodes (16): enqueueFbsMovementSheetAction(), toPrismaAutomationKind(), createAutomationRunForBullJob(), enqueueAutomationRun(), toAutomationPayloadJson(), normalizeAutomationSchedule(), enrichedPayload(), getAccountErrors() (+8 more)

### Community 66 - "Reference Read Layer"
Cohesion: 0.16
Nodes (17): DEFAULT_SYNC_JOB_OPTIONS, SyncJobData, createRunForBullJob(), getPeriodFromPayload(), getSourceFromPayload(), getSyncRunOrderBy(), getSyncRunWhere(), KIND_TO_PRISMA (+9 more)

### Community 67 - "Advertising Spend Attribution"
Cohesion: 0.26
Nodes (18): boundedPage(), compareHistoryValues(), displayCode(), FbsHistoryPage, getComplianceTasks(), getFbsHistoryPage(), getKizUnits(), getOrders() (+10 more)

### Community 68 - "FBS Data Freshness"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 69 - "Automation Catalog Templates"
Cohesion: 0.16
Nodes (14): DashboardOverviewChartsPanel(), DashboardOverviewChartsProps, DistributionChart(), formatCompact(), formatNumber(), formatRub(), formatTooltipValue(), shortRub() (+6 more)

### Community 70 - "Finance API Contracts"
Cohesion: 0.23
Nodes (16): articleVersionGroupKey(), ArticleVersionMeta, ArticleVersionRaw, buildArticleVersionMap(), d(), findArticleVersionsForPeriod(), resolveArticleVersion(), startOfUtcDay() (+8 more)

### Community 71 - "Financial Report Calculation"
Cohesion: 0.16
Nodes (14): AdvertisingClient(), handleSort(), handleSync(), renderSortableHeader(), FilterTab, formatBidType(), formatMoney(), formatPlacement() (+6 more)

### Community 72 - "Cancellation Analysis Script"
Cohesion: 0.23
Nodes (16): StocksPage(), addDays(), aggregateRowsByArticle(), buildStocksData(), calculateRisk(), compareNullableNumber(), emptySummary(), formatSizedVendorCode() (+8 more)

### Community 73 - "Product Cards UI"
Cohesion: 0.34
Nodes (14): "product_sizes", "users", "user_preferences", "fbs_action_logs", "fbs_assortment_items", "fbs_inventory_movements", "fbs_order_events", "fbs_orders" (+6 more)

### Community 74 - "Feedback Synchronization"
Cohesion: 0.18
Nodes (14): addSheet(), CategorySummary, classify(), date(), displayVendorCode(), main(), n(), OUT_DIR (+6 more)

### Community 75 - "Product Server Actions"
Cohesion: 0.15
Nodes (12): formatDateTime(), formatDuration(), formatNextRun(), formatSyncScheduleSummary(), SyncClient(), changeJobDateRange(), deleteJob(), enqueue() (+4 more)

### Community 76 - "Financial Report UI"
Cohesion: 0.21
Nodes (13): formatRun(), schedulesCanShareDay(), SyncScheduleDrawer(), syncScheduleOptions(), SheetContent, SheetContentProps, SheetDescription, SheetFooter() (+5 more)

### Community 77 - "Report Actions and Pages"
Cohesion: 0.33
Nodes (15): addDays(), answerText(), emptyResult(), formatDateKey(), jsonOrNull(), loadProductMap(), mediaPresent(), normalizeText() (+7 more)

### Community 78 - "Review Page Types"
Cohesion: 0.16
Nodes (15): NimbaOS Agent Operating Rules, DB-First Data Priority, Graph-First Scoped Navigation, Finance Detailed Sales Reports API Migration, Table-to-Service and KPI Formula Audit, Financial Report, Buyout Percent KPI, calculateReport Service (+7 more)

### Community 79 - "Sync Control UI"
Cohesion: 0.31
Nodes (13): containsKizSensitiveData(), extractFbsSgtinCodes(), findCryptoBlockStart(), getWbKizGtinValidationStatus(), GROUP_SEPARATOR, hashKizCode(), maskKizCode(), maskSerial() (+5 more)

### Community 80 - "Feedback Write Operations"
Cohesion: 0.15
Nodes (14): Dated Article Versions Preserve Historical Identity, Compact Current and Archive Memory Model, Service-Level Report Aggregation, Dated Article Version Data Model, WB Account, Article, Combined Card, and Size Keys, NimbaOS Prisma and PostgreSQL Data Model, Sync and Automation State Tables, Account- and Period-Bounded Query Rule (+6 more)

### Community 81 - "Production Runtime Infrastructure"
Cohesion: 0.18
Nodes (14): Safe Command Classification, Data Freshness Policy, FBS Operational and Finance Coverage Completeness Rule, Incremental Missing-Range Sync Policy, Explicit Confirmation Gate for Dangerous Operations, Role, Warehouse Gate, and Audit Requirements for FBS Writes, NimbaOS Safety Rules, Secret and Decrypted KIZ Protection (+6 more)

### Community 82 - "Product Advertising Stats"
Cohesion: 0.18
Nodes (11): AutomationsClient(), changeRunDateRange(), patchRunFilters(), refresh(), formatDateTime(), formatDuration(), formatNextRun(), AutomationsPage() (+3 more)

### Community 83 - "Campaign Detail Control"
Cohesion: 0.30
Nodes (10): ApiExpiration(), countdownText(), WbTokenExpiryNotifier(), daysUntilWbTokenExpiration(), decodeBase64Url(), extractWbTokenExpiration(), getMoscowDateKey(), moscowCalendarDay() (+2 more)

### Community 84 - "Stock Synchronization"
Cohesion: 0.24
Nodes (13): accountLastWriteAt, accountQueues, executeWrite(), FeedbackWriteTarget, getKind(), runForAccount(), throttleAccount(), toLogRow() (+5 more)

### Community 85 - "Deployment and Project State"
Cohesion: 0.17
Nodes (13): Unified Flexible Schedule Model, Trusted Tailscale Employee Ingress, Coverage, Run History, and Domain Freshness Signals, Private Tailscale Application and Administration Path, FBS Stage 2 True API Decisions, Freshness SLA and Failure Alerting Policy, Non-Cloudflare Public Ingress Choice, Unresolved Owner and Product Questions (+5 more)

### Community 86 - "Advertising Cluster UI"
Cohesion: 0.24
Nodes (9): AdNmStatsGrid(), AdNmStatsGridProps, formatMoney(), formatNumber(), formatPercent(), MONEY_FORMAT, NUMBER_FORMAT, parseMoney() (+1 more)

### Community 87 - "Report Column Definitions"
Cohesion: 0.21
Nodes (11): SortBy, StocksPageProps, VALID_RISKS, VALID_SORT_BY, StocksClientProps, MORNING_REPORT_CALCULATION_OPTIONS, MorningReportData, PaginatedStocks (+3 more)

### Community 88 - "Feedback Server Actions"
Cohesion: 0.26
Nodes (10): chunk(), syncStocksCurrent(), FetchWarehouseStocksParams, fetchWbWarehouseStocks(), GetStocksOptions, StockSummaryItem, StockSyncResult, StockWarehouseSummary (+2 more)

### Community 89 - "Plan Detail Metrics"
Cohesion: 0.20
Nodes (12): Current Phase, Explicit Approval Gate, FBS Operator Reconciliation Requirement, FBS Stage 1, Google Sheets Workflows, Local Changes Awaiting Production Rollout, Mini-PC Docker Production, Implemented MVP and Extensions (+4 more)

### Community 90 - "WB API Documentation"
Cohesion: 0.23
Nodes (8): main(), main(), AUTOMATION_QUEUE_NAME, AutomationJobData, createAutomationWorker(), DEFAULT_AUTOMATION_JOB_OPTIONS, getAutomationRedisConnection(), AutomationRunSource

### Community 91 - "Commission Shift Analysis"
Cohesion: 0.30
Nodes (11): AnswerDialog(), submit(), BulkAnswerDialog(), submit(), handleSync(), answerFeedbackItemAction(), bulkAnswerReviewsAction(), requireSession() (+3 more)

### Community 92 - "Realization Report Sync"
Cohesion: 0.23
Nodes (7): PlanDetailClient(), handleAddFromStock(), handleRemoveItem(), handleSaveHeader(), handleSaveItem(), refreshPlan(), syncPlanDataAction()

### Community 93 - "Reference Write Models"
Cohesion: 0.20
Nodes (10): Database as Analytics Source of Truth, FBS Operational Boundary and Guarded Writes, WB API Sync Database Service UI Data Flow, Role-Gated Idempotent FBS Write Flow, Layered Next.js Monolith, NimbaOS Codebase Map, Actions, Services, WB API, Queue, Sync, and Automation Layers, WB API to Database to Calculation Services Pipeline (+2 more)

### Community 94 - "Review List Controller"
Cohesion: 0.18
Nodes (11): Ask for Clarification Rule, Decision Rules, Recommend Price Decrease Rule, Recommend Supply Rule, Conversion, MKT-AUTO-OWNER-SUMMARY, Marketplace Manager Playbook, Owner Recommendations (+3 more)

### Community 95 - "FBS Analytics"
Cohesion: 0.27
Nodes (9): analyzePeriod(), date(), dayKey(), LOCAL_REPORT_OPTIONS, main(), num(), pct(), PERIODS (+1 more)

### Community 96 - "Paid Storage API"
Cohesion: 0.25
Nodes (8): formatNumber(), formatOptionalRating(), ReviewsClient(), buildUrl(), handleDateRangeChange(), submitFilters(), switchTab(), toggleSort()

### Community 97 - "Cost Price Management"
Cohesion: 0.36
Nodes (9): FBS_DEFAULT_SHEET_TABS, FBS_LEGACY_TAB_FIELDS, FBS_SHEET_ROLE_DEFINITIONS, FBS_SHEET_ROLES, getRequiredSheetTab(), normalizeFbsSheetTabs(), normalizeSheetTabs(), validateSheetTabs() (+1 more)

### Community 98 - "Core Architecture Documentation"
Cohesion: 0.35
Nodes (10): addDays(), buildDateChunks(), ClusterAccumulator, formatDate(), parseDate(), syncAdClusters(), toNumber(), chunk() (+2 more)

### Community 99 - "Open Architecture Questions"
Cohesion: 0.38
Nodes (9): main(), moscowBounds(), quoteSheetName(), rowsFromValues(), buildFbsProductNameMap(), fbsProductTupleKey(), normalizeProductName(), productMatchTokens() (+1 more)

### Community 100 - "App Layout Providers"
Cohesion: 0.33
Nodes (8): daysAgo(), formatDate(), loadDotEnv(), main(), ModuleWithDefault, pickAdvertId(), unwrapModule(), getKey()

### Community 101 - "Report Data Aggregation"
Cohesion: 0.31
Nodes (8): AutomationDetailsPage(), dynamic, AUTOMATION_DEFINITIONS, AutomationDefinition, DEFINITIONS_BY_KIND, getAutomationDefinition(), isAutomationWorkflowKind(), AutomationWorkflowKind

### Community 102 - "SPP Calculator"
Cohesion: 0.24
Nodes (9): AccountRowProps, AccountsSectionProps, TaxRateCellProps, SettingsPage(), AccountContext, AccountContextValue, AccountProvider(), getWbAccounts() (+1 more)

### Community 103 - "Automation Dashboard"
Cohesion: 0.31
Nodes (9): Persisted Materialized Aggregate Layer Gap, Analytics Coverage and Freshness Gate, PostgreSQL and BullMQ Background Processing, Dashboard and Analytics, DB-First Financial Report Navigation Audit, Compact Canonical Documentation Memory, Financial Reports, Graphify Deep Knowledge Graph (+1 more)

### Community 104 - "Product Card Controller"
Cohesion: 0.36
Nodes (9): CampaignDetailClient(), handleDeposit(), handlePause(), handleSetBid(), handleStart(), handleStop(), refreshCampaign(), formatBidType() (+1 more)

### Community 105 - "Article Version Writes"
Cohesion: 0.28
Nodes (6): SalesPlanPage(), SalesPlanPageProps, formatDate(), SalesPlanClient(), handleConfirmDelete(), getPlansAction()

### Community 106 - "Paid Storage Sync"
Cohesion: 0.28
Nodes (5): inter, metadata, Providers(), Toaster(), ToasterProps

### Community 107 - "Safety and Write Guards"
Cohesion: 0.31
Nodes (9): accountKeyFromEventKey(), eventKindFromKey(), normalize(), parseSheetDate(), reconcileFbsDay(), validateHeaderRow(), countSheetEvents(), planControlWrites() (+1 more)

### Community 108 - "Dashboard Server Actions"
Cohesion: 0.42
Nodes (8): aggregateReportRows(), AggregateReportRowsOptions, fmt(), safeDivide(), safeDivideMinZero(), safeMarginality(), sumNum(), sumStr()

### Community 109 - "Stock Client Controls"
Cohesion: 0.33
Nodes (8): AggEntry, aggregateRows(), AutoFillData, fetchStatRows(), getAutoFillByNmId(), getLast3MonthsRange(), getPreviousMonthRange(), StatRow

### Community 110 - "Moscow Schedule Utilities"
Cohesion: 0.36
Nodes (7): formatDateTime(), StocksClient(), buildUrl(), handleSync(), submitSearch(), toggleCategory(), toggleSort()

### Community 111 - "Agent Documentation Navigation"
Cohesion: 0.46
Nodes (7): batchUpdateSheetValues(), clearSheetValues(), copySheetRowPresentation(), getGoogleSheetsClient(), getSheetValues(), getSpreadsheetMetadata(), readServiceAccountJson()

### Community 112 - "Cloudflare Proxy"
Cohesion: 0.39
Nodes (7): minutesSinceScheduledTime(), minutesSinceScheduledTime(), addMoscowCalendarDays(), getNextMoscowRunAt(), minutesSinceMoscowScheduledTime(), MoscowDateParts, moscowWallTimeToUtc()

### Community 113 - "Reply Template Tab"
Cohesion: 0.52
Nodes (7): Source and Graph Synchronization Completion Rule, Permanent Graphify Memory Workflow, Canonical Source-of-Truth Precedence, Graph Vocabulary Expansion for Workflow Verification, Incremental Graph Update, Source and Graph Synchronization Completion Rule, Permanent Graphify-First Workflow Verification

### Community 114 - "Schedule Editor"
Cohesion: 0.33
Nodes (7): Canonical Source-of-Truth Precedence, Compact Current and Archive Documentation Memory, Canonical Development History, Project-Scoped Graphify Installation, Initial Deep Graphify Build, Permanent Automatic Graphify Workflow Change, Evidence-Backed Documentation-to-Service Bridges

### Community 115 - "Scheduled Job Policy"
Cohesion: 0.29
Nodes (7): FBS Inventory, Orders, KIZ, and Audit Data Model, Advertising Analytics and Guarded Campaign Control, FBS Operations and Serialized KIZ Domain, NimbaOS Product Specification, ADMIN, MANAGER, and VIEWER Access Model, Sales Plan and Plan-Fact Module, ROLE_HIERARCHY

### Community 116 - "Financial Group Calculations"
Cohesion: 0.33
Nodes (6): Persisted Advertising Statistics Fallback, buildAdSpendByNm Service, Live Advertising Cost Branch, REPORT_CALCULATION_OPTIONS, ROMI KPI, WbApiClient

### Community 117 - "Workflow Scheduling Documentation"
Cohesion: 0.60
Nodes (5): addStaticAssetHeaders(), fetch(), getStaticCacheKey(), removeBodySpecificHeaders(), rewriteNextAssetUrls()

### Community 118 - "Margin Analysis Script"
Cohesion: 0.60
Nodes (6): FlexibleScheduleEditor(), addTime(), patch(), toggleMonthDay(), toggleWeekday(), updateTime()

### Community 119 - "User Invitation Dialog"
Cohesion: 0.50
Nodes (3): main(), num(), SOURCE_SQL

### Community 120 - "Reply Template Groups"
Cohesion: 0.40
Nodes (3): AddArticleDialog(), handleAdd(), handleSearch()

### Community 122 - "Windows Deployment Script"
Cohesion: 0.50
Nodes (3): extends, next/core-web-vitals, next/typescript

### Community 123 - "ESLint Configuration"
Cohesion: 0.83
Nodes (3): "stock_items", "stock_snapshots", "warehouses"

### Community 124 - "Database Seed"
Cohesion: 0.83
Nodes (3): "automation_runs", "automation_workflow_accounts", "automation_workflow_settings"

### Community 126 - "Article Override Dialog"
Cohesion: 0.67
Nodes (3): assertClose(), EXPECTED, main()

### Community 129 - "Health Check Endpoint"
Cohesion: 1.00
Nodes (3): CreatePlanDialog(), handleSubmit(), resetForm()

## DB-First Navigation Audit

- Verified direct `read_by` links from the 12 local tables used by `calculateReport()` or its article-version loader, including `realization_reports`, `paid_storage`, `ad_campaign_nm_stats`, `wb_orders` and `article_versions`.
- Verified `calculateReport()` → `getReportData()`/`ReportsPage()` navigation and extracted formula links for `Ordered Rub`, `Buyout Percent`, `DRR` and `ROMI`.
- Important implementation exception: the standard financial-report options enable live advertising cost totals, giving the extracted path `Financial Report` → `getReportData()` → `REPORT_CALCULATION_OPTIONS` → `buildAdSpendByNm()` → `WbApiClient`. Persisted ad statistics remain the fallback.

## Knowledge Gaps
- **487 isolated node(s):** `AnalyticsSection`, `ArticleComparisonChartProps`, `MetricChart`, `MetricDef`, `MetricKey` (+482 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 667 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `Admin Automation Interfaces` to `Shared Report UI`, `FBS Sync State`, `Database Schema Migrations`, `Dashboard Summary Freshness`, `Automation Server Actions`, `Automation Detail Interfaces`, `FBS Authorization Actions`, `Automation Processing History`, `Stock and Reference UI`, `Advertising Server Actions`, `Flexible Schedule Logic`, `Stock Analytics Services`, `Dashboard Report Export`, `WB Account Management`, `Dashboard Overview Page`, `Sync Queue and Coverage`, `Encrypted API Synchronization`, `Cabinet Factor Analysis`, `Manual Sync Actions`, `Marketplace Guidance Memory`, `FBS KIZ Workspace`, `WB API Client Layer`, `KPI Reporting Rules`, `FBS History Queries`, `Product Catalog Sync`, `Development Dependencies`, `Audited FBS Operations`, `Sales Plan Actions`, `Feedback Query Services`, `Dashboard Data Types`, `Sales Plan Calculation`, `Dashboard Chart Components`, `Reference Read Layer`, `Advertising Spend Attribution`, `Finance API Contracts`, `Cancellation Analysis Script`, `Feedback Synchronization`, `Report Actions and Pages`, `Stock Synchronization`, `Report Column Definitions`, `Feedback Server Actions`, `Commission Shift Analysis`, `FBS Analytics`, `Core Architecture Documentation`, `Open Architecture Questions`, `Article Version Writes`, `Stock Client Controls`, `User Invitation Dialog`?**
  _High betweenness centrality (0.154) - this node is a cross-community bridge._
- **Why does `calculateReport()` connect `Development Dependencies` to `Cabinet Factor Analysis`, `Analytics UI Pages`, `Database Schema Migrations`, `Automation Detail Interfaces`, `Feedback Synchronization`, `FBS History Queries`, `Dashboard Server Actions`, `Review Page Types`, `Feedback Write Operations`, `Sync Job History`, `Report Column Definitions`, `User Invitation Dialog`, `Dashboard Report Export`, `Runtime Dependencies`, `Sync Schedule Persistence`, `Reference Write Models`, `FBS Analytics`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `"wb_accounts"` connect `Sync Schedule Persistence` to `Product Cards UI`, `ESLint Configuration`, `Database Seed`, `Development Dependencies`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **What connects `AnalyticsSection`, `ArticleComparisonChartProps`, `MetricChart` to the rest of the system?**
  _487 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Analytics UI Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.06382978723404255 - nodes in this community are weakly interconnected._
- **Should `Shared Report UI` be split into smaller, more focused modules?**
  _Cohesion score 0.05450165612767239 - nodes in this community are weakly interconnected._
- **Should `UI Form Components` be split into smaller, more focused modules?**
  _Cohesion score 0.08404294705664568 - nodes in this community are weakly interconnected._
