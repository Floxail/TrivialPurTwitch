# Graph Report - .  (2026-06-07)

## Corpus Check
- 87 files · ~217,971 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 497 nodes · 747 edges · 43 communities (40 shown, 3 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.8)
- Token cost: 7,500 input · 2,910 output

## Community Hubs (Navigation)
- [[_COMMUNITY_UI Pages and Admin Views|UI Pages and Admin Views]]
- [[_COMMUNITY_Serverless API Endpoints|Serverless API Endpoints]]
- [[_COMMUNITY_Frontend Dependencies|Frontend Dependencies]]
- [[_COMMUNITY_API Client Services|API Client Services]]
- [[_COMMUNITY_Build Configuration|Build Configuration]]
- [[_COMMUNITY_Game Results UI|Game Results UI]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Help and Onboarding|Help and Onboarding]]
- [[_COMMUNITY_Twitch Integration and Validation|Twitch Integration and Validation]]
- [[_COMMUNITY_Core Concepts and Architecture|Core Concepts and Architecture]]
- [[_COMMUNITY_Statistics and Analytics|Statistics and Analytics]]
- [[_COMMUNITY_QCM Conversion Scripts|QCM Conversion Scripts]]
- [[_COMMUNITY_API TypeScript Config|API TypeScript Config]]
- [[_COMMUNITY_Reports Service|Reports Service]]
- [[_COMMUNITY_Scores Service|Scores Service]]
- [[_COMMUNITY_Twitch API Integration|Twitch API Integration]]
- [[_COMMUNITY_Terminal UI Container|Terminal UI Container]]
- [[_COMMUNITY_Database Seeding Scripts|Database Seeding Scripts]]
- [[_COMMUNITY_Terminal Button Component|Terminal Button Component]]
- [[_COMMUNITY_Box Order Fix Scripts|Box Order Fix Scripts]]
- [[_COMMUNITY_Admin Moderation Service|Admin Moderation Service]]
- [[_COMMUNITY_Terminal Badge Component|Terminal Badge Component]]
- [[_COMMUNITY_Terminal Tabs Component|Terminal Tabs Component]]
- [[_COMMUNITY_Question Format Converter|Question Format Converter]]
- [[_COMMUNITY_Podium Award Assets|Podium Award Assets]]
- [[_COMMUNITY_Pending Questions Table Setup|Pending Questions Table Setup]]
- [[_COMMUNITY_AJV Keywords Patch|AJV Keywords Patch]]
- [[_COMMUNITY_History Service|History Service]]
- [[_COMMUNITY_Terminal Alert Component|Terminal Alert Component]]
- [[_COMMUNITY_Stats API Endpoint|Stats API Endpoint]]
- [[_COMMUNITY_Question Submit Service|Question Submit Service]]
- [[_COMMUNITY_Terminal Input Component|Terminal Input Component]]
- [[_COMMUNITY_Terminal Modal Component|Terminal Modal Component]]
- [[_COMMUNITY_Terminal Table Component|Terminal Table Component]]
- [[_COMMUNITY_Terminal Textarea Component|Terminal Textarea Component]]
- [[_COMMUNITY_App Brand and Logo|App Brand and Logo]]
- [[_COMMUNITY_Vercel Deployment Config|Vercel Deployment Config]]
- [[_COMMUNITY_Avatar Component|Avatar Component]]
- [[_COMMUNITY_API Package Config|API Package Config]]
- [[_COMMUNITY_App Favicon and Brand|App Favicon and Brand]]
- [[_COMMUNITY_Yarn Config|Yarn Config]]

## God Nodes (most connected - your core abstractions)
1. `useAuthStore` - 18 edges
2. `useGlobalStore` - 18 edges
3. `compilerOptions` - 18 edges
4. `requireAdminAuth()` - 15 edges
5. `useQuestionsStore` - 14 edges
6. `useSettingsStore` - 12 edges
7. `authHeaders()` - 12 edges
8. `compilerOptions` - 11 edges
9. `scripts` - 9 edges
10. `Quiz()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Single Page App GitHub Pages Redirect Pattern` --semantically_similar_to--> `Vercel Hosting and Serverless Deployment`  [INFERRED] [semantically similar]
  public/404.html → README.md
- `Silver Medal Award Icon` --USED_BY--> `Leaderboard`  [EXTRACTED]
  public/silver.svg → src/components/leaderboard.tsx
- `Silver Medal Award Icon` --USED_BY--> `Podium()`  [EXTRACTED]
  public/silver.svg → src/components/podium.tsx
- `GitHub Actions Deploy Workflow` --references--> `TrivialPurTwitch README`  [INFERRED]
  .github/workflows/deploy.yml → README.md
- `TwitchAvatar Component` --FALLBACK_TO--> `Default User Avatar Image`  [EXTRACTED]
  src/components/twitch-avatar.tsx → public/avatar.png

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **SPA Routing Strategy: 404 redirect + index.html handler + Vercel rewrites** — public_404_spa_redirect, public_index_html, concept_vercel_deployment [INFERRED 0.75]
- **SEO Metadata Stack: meta tags, Open Graph, Schema.org** — concept_seo_meta, concept_open_graph, concept_schema_org [EXTRACTED 0.95]
- **Deployment Pipeline: CI workflow, Yarn config, Vercel hosting** — workflows_deploy_ci_pipeline, yarnrc_node_linker, concept_vercel_deployment [INFERRED 0.75]
- **Podium Award Icon Set** —  [INFERRED 0.85]

## Communities (43 total, 3 thin omitted)

### Community 0 - "UI Pages and Admin Views"
Cohesion: 0.06
Nodes (50): AdminDashboard(), QCM_LABELS, ContributionPage(), ParsedBulkQuestion, QCM_LABELS, GlobalMenu(), LoginCallback(), Login() (+42 more)

### Community 1 - "Serverless API Endpoints"
Cohesion: 0.08
Nodes (36): CORS_HEADERS, getDb(), handler(), getDb(), handler(), CORS_HEADERS, ensureMigration(), getDb() (+28 more)

### Community 2 - "Frontend Dependencies"
Cohesion: 0.07
Nodes (30): dependencies, autoprefixer, axios, bootstrap, class-transformer, @fortawesome/fontawesome-svg-core, @fortawesome/free-brands-svg-icons, @fortawesome/free-regular-svg-icons (+22 more)

### Community 3 - "API Client Services"
Cohesion: 0.14
Nodes (27): apiBulkAddQuestions(), apiCreateBox(), apiCreateQuestion(), apiDeleteBox(), apiDeleteQuestion(), apiImportQuestions(), apiRenameBox(), apiReorderBox() (+19 more)

### Community 4 - "Build Configuration"
Cohesion: 0.07
Nodes (27): browserslist, development, production, devDependencies, dotenv, gh-pages, sass, ts-node (+19 more)

### Community 5 - "Game Results UI"
Cohesion: 0.11
Nodes (17): Leaderboard, LeaderboardMode, LeaderboardRow, Podium(), Bronze Medal SVG Icon, Crown SVG Icon (Podium Award Asset), Gold Medal SVG Icon, Second Place Ranking (2nd) (+9 more)

### Community 6 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, allowSyntheticDefaultImports, baseUrl, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, isolatedModules (+11 more)

### Community 7 - "Help and Onboarding"
Cohesion: 0.12
Nodes (11): Help(), shouldShowWelcome(), WelcomeContent(), AdminDashboard, ContributionPage, Convertisseur, QuestionManager, QuestionManagerTerminal (+3 more)

### Community 8 - "Twitch Integration and Validation"
Cohesion: 0.18
Nodes (13): checkMatch(), QCM_LABELS, ValidationResult, verifyAnswer(), verifyFreeTextAnswer(), verifyQcmAnswer(), cleanValueLight(), colors (+5 more)

### Community 9 - "Core Concepts and Architecture"
Cohesion: 0.17
Nodes (17): GPL-3.0 License, OAuth PKCE Authentication Flow, Open Graph Social Sharing Metadata, Turso DB Question Synchronisation Strategy, API and Admin Route Crawl Restriction, Schema.org WebApplication Structured Data, SEO Meta Tags and Structured Data, Single Page App GitHub Pages Redirect Pattern (+9 more)

### Community 10 - "Statistics and Analytics"
Cohesion: 0.20
Nodes (11): formatDate(), formatDateTime(), formatMs(), PlayerStatsView(), StatsTab, apiGetGlobalStats(), apiGetPlayerFullStats(), ChannelStats (+3 more)

### Community 11 - "QCM Conversion Scripts"
Cohesion: 0.21
Nodes (13): convertToQcm(), data, findBestPool(), fs, getExtraOption(), optionBanks, parseFourOptions(), parseInlineOptions() (+5 more)

### Community 12 - "API TypeScript Config"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, resolveJsonModule (+4 more)

### Community 13 - "Reports Service"
Cohesion: 0.33
Nodes (8): apiCreateReport(), apiDeleteReport(), apiGetReports(), apiResolveReport(), getAdminHeaders(), getAuthHeaders(), QuestionReport, ReportReason

### Community 14 - "Scores Service"
Cohesion: 0.25
Nodes (5): apiRecordScores(), authHeaders(), LeaderboardEntry, PlayerHistory, SessionSummary

### Community 15 - "Twitch API Integration"
Cohesion: 0.25
Nodes (4): findVodForDate(), instance, parseDuration(), TwitchVideo

### Community 16 - "Terminal UI Container"
Cohesion: 0.31
Nodes (6): TerminalContainer(), TerminalContainerProps, TerminalPanel(), TerminalPanelProps, TerminalSelect, TerminalSelectProps

### Community 17 - "Database Seeding Scripts"
Cohesion: 0.25
Nodes (6): BoxJSON, db, __dirname, __filename, QuestionJSON, QuestionsFile

### Community 18 - "Terminal Button Component"
Cohesion: 0.25
Nodes (6): ButtonSize, ButtonVariant, sizeStyles, TerminalButton, TerminalButtonProps, variantStyles

### Community 19 - "Box Order Fix Scripts"
Cohesion: 0.48
Nodes (6): fetchQuestions(), main(), matchQuestion(), normalize(), PILOTES_ORDER, reorderBox()

### Community 20 - "Admin Moderation Service"
Cohesion: 0.48
Nodes (6): apiApproveQuestion(), apiEditPendingQuestion(), apiGetPendingQuestions(), apiRejectQuestion(), getAuthHeaders(), PendingQuestion

### Community 21 - "Terminal Badge Component"
Cohesion: 0.33
Nodes (5): BadgeVariant, glowStyles, TerminalBadge(), TerminalBadgeProps, variantStyles

### Community 22 - "Terminal Tabs Component"
Cohesion: 0.33
Nodes (5): Tab, TerminalTabPanel(), TerminalTabPanelProps, TerminalTabs(), TerminalTabsProps

### Community 23 - "Question Format Converter"
Cohesion: 0.40
Nodes (3): CardMode, ParsedQuestion, QuestionField

### Community 24 - "Podium Award Assets"
Cohesion: 0.40
Nodes (5): Podium Component, Bronze Medal SVG Icon, Podium Ranking System, Gold Medal SVG, Podium Ranking System (1st/2nd/3rd Place)

### Community 25 - "Pending Questions Table Setup"
Cohesion: 0.40
Nodes (3): db, __dirname, __filename

### Community 26 - "AJV Keywords Patch"
Cohesion: 0.40
Nodes (4): content, fs, path, target

### Community 27 - "History Service"
Cohesion: 0.70
Nodes (4): fetchHistory(), getAuthHeaders(), recordHistory(), resetHistory()

### Community 28 - "Terminal Alert Component"
Cohesion: 0.40
Nodes (4): AlertVariant, TerminalAlert(), TerminalAlertProps, variantStyles

### Community 29 - "Stats API Endpoint"
Cohesion: 1.00
Nodes (3): ensureTables(), getDb(), handler()

### Community 30 - "Question Submit Service"
Cohesion: 0.67
Nodes (3): apiSubmitQuestion(), getAuthHeaders(), SubmitQuestionPayload

### Community 31 - "Terminal Input Component"
Cohesion: 0.50
Nodes (3): InputVariant, TerminalInput, TerminalInputProps

### Community 32 - "Terminal Modal Component"
Cohesion: 0.50
Nodes (3): sizeStyles, TerminalModal(), TerminalModalProps

### Community 33 - "Terminal Table Component"
Cohesion: 0.50
Nodes (3): Column, TerminalTable(), TerminalTableProps

### Community 34 - "Terminal Textarea Component"
Cohesion: 0.50
Nodes (3): TerminalTextarea, TerminalTextareaProps, TextareaVariant

### Community 35 - "App Brand and Logo"
Cohesion: 0.83
Nodes (4): TrivialPurTwitch Application Branding, Cyberpunk / Neon Aesthetic Design, TrivialPurTwitch Logo Image, Trivial Pursuit Pie Piece Visual Motif

### Community 36 - "Vercel Deployment Config"
Cohesion: 0.50
Nodes (3): buildCommand, headers, rewrites

### Community 37 - "Avatar Component"
Cohesion: 0.67
Nodes (3): Default User Avatar Image, Generic Person Placeholder Icon, TwitchAvatar Component

## Knowledge Gaps
- **204 isolated node(s):** `rateLimitMap`, `CORS_HEADERS`, `CORS_HEADERS`, `type`, `CORS_HEADERS` (+199 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAuthStore` connect `UI Pages and Admin Views` to `Statistics and Analytics`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `useGlobalStore` connect `UI Pages and Admin Views` to `Statistics and Analytics`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Frontend Dependencies` to `Build Configuration`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `rateLimitMap`, `CORS_HEADERS`, `CORS_HEADERS` to the rest of the system?**
  _204 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UI Pages and Admin Views` be split into smaller, more focused modules?**
  _Cohesion score 0.0578386605783866 - nodes in this community are weakly interconnected._
- **Should `Serverless API Endpoints` be split into smaller, more focused modules?**
  _Cohesion score 0.07993197278911565 - nodes in this community are weakly interconnected._
- **Should `Frontend Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._