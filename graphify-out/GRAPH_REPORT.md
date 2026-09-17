# Graph Report - .  (2026-09-02)

## Corpus Check
- 89 files · ~217,661 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 695 nodes · 1176 edges · 94 communities (29 shown, 65 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.85)
- Token cost: 70,742 input · 0 output

## Community Hubs (Navigation)
- App Shell & Leaderboard
- Contribution & Bulk Import
- Terminal UI Question Manager
- Serverless API & Turso DB
- Routing & Convertisseur
- Quiz Engine & Twitch Chat
- Build Tooling & Dev Deps
- Moderation & DB Scripts
- Frontend TS Config
- Quiz Session & Score Recording
- Answer Validation Helpers
- API TS Config
- QCM Conversion Script
- Terminal UI Primitives
- Auth, Settings & Stats Stores
- React Runtime Deps
- SEO & SPA Redirect
- Database Seeding Script
- Box Order Repair Script
- Pending Table Migration
- Ajv Keywords Patch
- Question Deletion Flow
- Box Creation & Import Flow
- Logo & Branding Art
- Vercel Deploy Config
- Duplicate Detection Flow
- Bulk Move & Edit Flow
- Api Package
- Autoprefixer
- Axios
- Bootstrap
- Class Transformer
- Components Question Manager V2 Handlecon
- Components Welcome Welcome
- Fortawesome Fontawesome Svg Core
- Fortawesome Free Brands Svg Icons
- Fortawesome Free Regular Svg Icons
- Fortawesome Free Solid Svg Icons
- Fortawesome React Fontawesome
- Framer Motion
- Libsql Client
- Lucide React
- Package Dependencies Popperjs Core
- Package Dependencies React Bootstrap
- Package Dependencies React Router Dom
- Package Dependencies React Scripts
- Package Dependencies Tailwindcss
- Package Dependencies Tmi Js
- Package Dependencies Types React
- Package Dependencies Types React Dom
- Package Dependencies Types Tmi Js
- Package Dependencies Typescript
- Package Dependencies Vercel Analytics
- Package Dependencies Vercel Speed Insigh
- Package Dependencies Zustand
- Services Api Stats Service Apigetglobals
- Services Github Data Service Loadquestio
- Api Package Config
- Api Tsconfig Config
- Components Leaderboard Leaderboard
- Components Podium
- Components Podium Component
- Components Podium Podium
- Components Question Manager V2 Handleexp
- Components Quiz Renderwithemojiboost
- Public Avatar Default Avatar
- Public Avatar Placeholder Icon
- Public Avatar Twitch Avatar Component
- Public Bronze Bronze Icon
- Public Bronze Bronze Medal
- Public Bronze Podium
- Public Crown Crown Icon
- Public Favicon App Favicon
- Public Gold Gold Icon
- Public Gold Gold Medal Svg
- Public Gold Podium Ranking
- Public Silver Second Place Rank
- Public Silver Silver Icon
- Public Silver Silver Medal
- Services Api Admin Service Apieditpendin
- Services Api Admin Service Apigetpending
- Services Api Admin Service Apirejectques
- Services Api Submit Service Apisubmitque
- Src Icons Icons
- Src Index Appentry
- Src React App Env
- Store Player Store Getdeepcopy
- Store Player Store Restoreplayers
- Store Player Store Useplayerstore
- Trivialpurtwitch App Brand
- Vercel Build Command
- Yarnrc Node Linker

## God Nodes (most connected - your core abstractions)
1. `useQuestionsStore` - 31 edges
2. `useAuthStore` - 30 edges
3. `getDb()` - 28 edges
4. `applyCors()` - 24 edges
5. `requireAdminAuth()` - 19 edges
6. `useGlobalStore` - 19 edges
7. `compilerOptions` - 18 edges
8. `AdminDashboard()` - 17 edges
9. `runMigrations()` - 16 edges
10. `requireAnyTwitchAuth()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `API Submit Service` --calls--> `handler()`  [INFERRED]
  C:/Users/Floxa/Documents/dev/TrivialPurTwitch/src/services/api-submit-service.ts → api/submit-question.ts
- `SPA rewrites (/api passthrough puis catch-all index.html)` --references--> `handler()`  [INFERRED]
  vercel.json → api/scores.ts
- `SPA rewrites (/api passthrough puis catch-all index.html)` --references--> `handler()`  [INFERRED]
  vercel.json → api/stats.ts
- `Changelog()` --references--> `Community Contribution Moderation Workflow`  [INFERRED]
  src/components/changelog.tsx → C:/Users/Floxa/Documents/dev/TrivialPurTwitch/src/components/admin-dashboard.tsx
- `ContributionPage()` --references--> `Community Contribution Moderation Workflow`  [INFERRED]
  src/components/contribution-page.tsx → C:/Users/Floxa/Documents/dev/TrivialPurTwitch/src/components/admin-dashboard.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Turso DB Lazy Migration Init Pattern** — api_db_getdb, api_db_runmigrations, api_questions_handler, api_boxes_handler, api_history_handler, api_scores_handler, api_stats_handler [EXTRACTED 1.00]
- **Admin Twitch Auth Protected Endpoint Pattern** — api_utils_requireadminauth, admin_questionsreview_handler, api_questions_handler, api_questionsbulk_handler, api_questionsimport_handler, api_reorderbox_handler, api_boxes_handler [EXTRACTED 1.00]
- **Community Question Submission Pipeline** — src_components_contribution_page_contributionpage, services_api_submit_service, api_submit_question_handler, concept_pending_questions_table, src_components_admin_dashboard_admindashboard, concept_moderation_workflow [EXTRACTED 1.00]
- **Database Maintenance Scripts (Turso)** — scripts_create_pending_table_script, scripts_seed_database_script, scripts_reset_question_stats_script, scripts_fix_box_order_script, concept_turso_db [EXTRACTED 1.00]
- **App Routing with Lazy-Loaded Components** — src_app_appcomponent, src_components_admin_dashboard_admindashboard, src_components_contribution_page_contributionpage, src_components_convertisseur_convertisseur, src_components_question_manager_terminal_qmterminal, concept_lazy_code_splitting [EXTRACTED 1.00]
- **Zustand State Management Stores** — src_components_store_questions_store, store_auth_store, store_global_store, src_components_store_player_store, store_settings_store, src_components_store_game_store [INFERRED 0.95]
- **Twitch OAuth Implicit Flow** — src_components_login_login, src_components_login_callback_logincallback, store_auth_store, concept_twitch_oauth_implicit [EXTRACTED 1.00]
- **QCM Multi-Choice Support** — concept_qcm_question_type, src_components_question_manager_modals_questionmodal, src_components_contribution_page_contributionpage, api_submit_question_handler, scripts_convert_to_qcm_script [INFERRED 0.90]
- **Admin Box Lifecycle (edit/create/delete)** — components_question_manager_v2_editboxmodal, components_question_manager_v2_handleconfirmeditbox, components_question_manager_v2_handledeletebox, store_questions_store_updatebox, store_questions_store_removebox [INFERRED 0.85]
- **Twitch Chat Command Handling (!quiz/!score/answers)** — components_quiz_onproposition, components_quiz_handlescorecommand, components_quiz_handlestartquiz, components_quiz_twitchconnection [INFERRED 0.85]
- **Token Obfuscation System (XOR + Base64, transparent migration)** — store_auth_store_useauthstore, store_auth_store_obfuscatetoken, store_auth_store_deobfuscatetoken, store_auth_store_migratelegacytoken [EXTRACTED 1.00]
- **Score Computation Flow (answers -> points -> ranks)** — store_player_store_recordanswers, store_player_store_addpoints, store_player_store_recomputeranks, components_quiz_handletimeup [INFERRED 0.85]
- **Lumon Terminal Design System (Severance-themed UI Component Library)** — terminal_ui_index, terminal_ui_terminalalert_terminalalert, terminal_ui_terminalbutton_terminalbutton, terminal_ui_terminalcontainer_terminalcontainer, terminal_ui_terminalbadge_terminalbadge, terminal_ui_terminalinput_terminalinput, terminal_ui_terminalmodal_terminalmodal, terminal_ui_terminalselect_terminalselect, terminal_ui_terminaltable_terminaltable, terminal_ui_terminaltabs_terminaltabs, terminal_ui_terminaltextarea_terminaltextarea [EXTRACTED 1.00]
- **Shared Twitch Bearer Token Auth Pattern** — services_api_admin_service_apigetpendingquestions, services_api_history_service_fetchhistory, services_api_reports_service_apicreatereport, services_api_scores_service_apirecordscores, src_services_api_service_apicreatequestion, services_api_submit_service_apisubmitquestion [EXTRACTED 1.00]
- **Questions Data Loading Pipeline (API → merge → local)** — services_github_data_service_loadquestionsfromapi, services_github_data_service_mergequestionsfromdb [EXTRACTED 1.00]
- **Deployment Pipeline: CI workflow, Yarn config, Vercel hosting** — workflows_deploy_ci_pipeline, yarnrc_node_linker [INFERRED 0.75]
- **SPA Routing Strategy: 404 redirect + index.html handler + Vercel rewrites** — public_404_spa_redirect, public_index_html [INFERRED 0.75]
- **SEO Metadata Stack: meta tags, Open Graph, Schema.org** — concept_seo_meta, concept_open_graph, concept_schema_org [EXTRACTED 0.95]
- **Flux de persistance de fin de quiz (scores + stats de questions)** — services_answer_validator_verifyanswer, api_scores_handler, api_stats_handler, api_scores_scores_table, api_stats_question_stats_upsert [INFERRED 0.85]
- **Identite joueur portee par le nick (et non par twitch_id)** — api_scores_scores_table, api_stats_case_insensitive_nick_lookup, api_scores_channelid_ownership_check, api_scores_handler [INFERRED 0.85]
- **Contrat de validation de reponse (valid vs isCorrect)** — services_answer_validator_validationresult, services_answer_validator_verifyanswer, services_answer_validator_verifyqcmanswer, services_answer_validator_verifyfreetextanswer, services_answer_validator_checkmatch [EXTRACTED 1.00]

## Communities (94 total, 65 thin omitted)

### Community 0 - "App Shell & Leaderboard"
Cohesion: 0.05
Nodes (62): Terminal UI Components Library, Welcome Component, Lazy Code Splitting / React.lazy Routes, Scoring System (Base+First+Seul+Combo), App(), App Root Component, Changelog(), GlobalMenu() (+54 more)

### Community 1 - "Contribution & Bulk Import"
Cohesion: 0.08
Nodes (51): Bulk Question Parse Format (Q:/R:/ALT:), QCM Question Type (Multiple Choice), apiApproveQuestion, API Submit Service, QuestionManager, ContributionPage(), parseBulkQuestions(), ParsedBulkQuestion (+43 more)

### Community 2 - "Terminal UI Question Manager"
Cohesion: 0.05
Nodes (40): QuestionManagerTerminal, QuestionManagerTerminal(), AlertVariant, TerminalAlert(), TerminalAlertProps, variantStyles, BadgeVariant, glowStyles (+32 more)

### Community 3 - "Serverless API & Turso DB"
Cohesion: 0.12
Nodes (40): Admin Questions Review Handler, handler(), rowToPendingQuestion(), handler(), handler(), getDb(), API Database Module (_db), runMigrations() (+32 more)

### Community 4 - "Routing & Convertisseur"
Cohesion: 0.06
Nodes (40): Twitch OAuth Implicit Flow, AdminDashboard, ContributionPage, Convertisseur, Settings, Stats, CardMode, Convertisseur() (+32 more)

### Community 5 - "Quiz Engine & Twitch Chat"
Cohesion: 0.05
Nodes (47): BlindTesTwitch (inspiration project by neumann__), handleOpenReorder, handleReorderSave, handleSyncFromDB, flushScoreCommands, handleScoreCommand, handleTimeUp, onProposition (chat message handler) (+39 more)

### Community 6 - "Build Tooling & Dev Deps"
Cohesion: 0.05
Nodes (40): dotenv, gh-pages, browserslist, development, production, devDependencies, dotenv, gh-pages (+32 more)

### Community 7 - "Moderation & DB Scripts"
Cohesion: 0.12
Nodes (29): Community Contribution Moderation Workflow, Pending Questions DB Table, Question Stats DB Table, Turso LibSQL Database, TrivialPurTwitch Package Manifest, Questions Fallback JSON Data, Convert Free-Text to QCM Script, Create Pending Questions Table Script (+21 more)

### Community 8 - "Frontend TS Config"
Cohesion: 0.08
Nodes (23): dom, dom.iterable, esnext, src, compilerOptions, allowJs, allowSyntheticDefaultImports, baseUrl (+15 more)

### Community 9 - "Quiz Session & Score Recording"
Cohesion: 0.11
Nodes (20): EditBoxModal Component, handleDeleteBox, QuestionManager Component, handleEndSession, handleNextQuestion, handleRevealAnswer, handleStartQuiz, recordQuestionStats (+12 more)

### Community 10 - "Answer Validation Helpers"
Cohesion: 0.24
Nodes (14): LoginCallback(), cleanValueLight(), colors, getHashParam(), getParam(), getQueryParam(), removeArticles(), sorensenDiceScore() (+6 more)

### Community 11 - "API TS Config"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, resolveJsonModule (+6 more)

### Community 12 - "QCM Conversion Script"
Cohesion: 0.22
Nodes (13): convertToQcm(), data, findBestPool(), fs, getExtraOption(), optionBanks, parseFourOptions(), parseInlineOptions() (+5 more)

### Community 13 - "Terminal UI Primitives"
Cohesion: 0.20
Nodes (12): Terminal UI Barrel (index.ts), TerminalAlert, TerminalBadge, TerminalButton, TerminalContainer, TerminalInput, TerminalModal, TerminalSelect (+4 more)

### Community 14 - "Auth, Settings & Stats Stores"
Cohesion: 0.25
Nodes (11): Settings, GlobalStatsView, PlayerStatsView, StatCard, Stats, deobfuscateToken, migrateLegacyToken (one-time migration), obfuscateToken (XOR+Base64) (+3 more)

### Community 15 - "React Runtime Deps"
Cohesion: 0.22
Nodes (9): dependencies, postcss, react, react-dom, reflect-metadata, postcss, react, react-dom (+1 more)

### Community 16 - "SEO & SPA Redirect"
Cohesion: 0.36
Nodes (8): Open Graph Social Sharing Metadata, API and Admin Route Crawl Restriction, Schema.org WebApplication Structured Data, SEO Meta Tags and Structured Data, Single Page App GitHub Pages Redirect Pattern, SPA 404 Redirect Handler (GitHub Pages), App Entry Point (index.html), Robots.txt SEO Crawler Rules

### Community 17 - "Database Seeding Script"
Cohesion: 0.25
Nodes (6): BoxJSON, db, __dirname, __filename, QuestionJSON, QuestionsFile

### Community 18 - "Box Order Repair Script"
Cohesion: 0.48
Nodes (6): fetchQuestions(), main(), matchQuestion(), normalize(), PILOTES_ORDER, reorderBox()

### Community 19 - "Pending Table Migration"
Cohesion: 0.40
Nodes (3): db, __dirname, __filename

### Community 20 - "Ajv Keywords Patch"
Cohesion: 0.40
Nodes (4): content, fs, path, target

### Community 21 - "Question Deletion Flow"
Cohesion: 0.50
Nodes (4): getBoxQuestions, handleBulkDelete, handleDeleteQuestion, deleteQuestion action

### Community 22 - "Box Creation & Import Flow"
Cohesion: 0.50
Nodes (4): handleCreateEmptyBox, handleImport, addBox action, bulkAddQuestions action

### Community 23 - "Logo & Branding Art"
Cohesion: 0.83
Nodes (4): TrivialPurTwitch Application Branding, Cyberpunk / Neon Aesthetic Design, TrivialPurTwitch Logo Image, Trivial Pursuit Pie Piece Visual Motif

### Community 24 - "Vercel Deploy Config"
Cohesion: 0.50
Nodes (3): buildCommand, headers, rewrites

### Community 25 - "Duplicate Detection Flow"
Cohesion: 0.67
Nodes (3): findDuplicates, handleCheckDuplicates, removeDuplicates action

### Community 26 - "Bulk Move & Edit Flow"
Cohesion: 0.67
Nodes (3): handleBulkMove, handleQuestionSubmit, updateQuestion action

## Knowledge Gaps
- **279 isolated node(s):** `CORS_HEADERS`, `rateLimitMap`, `type`, `target`, `module` (+274 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **65 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useQuestionsStore` connect `Contribution & Bulk Import` to `App Shell & Leaderboard`, `Terminal UI Question Manager`, `Routing & Convertisseur`, `Moderation & DB Scripts`, `Auth, Settings & Stats Stores`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `Settings` connect `Auth, Settings & Stats Stores` to `Contribution & Bulk Import`, `Quiz Engine & Twitch Chat`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `handler()` connect `Serverless API & Turso DB` to `Contribution & Bulk Import`, `Moderation & DB Scripts`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **What connects `CORS_HEADERS`, `rateLimitMap`, `type` to the rest of the system?**
  _279 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Shell & Leaderboard` be split into smaller, more focused modules?**
  _Cohesion score 0.052947052947052944 - nodes in this community are weakly interconnected._
- **Should `Contribution & Bulk Import` be split into smaller, more focused modules?**
  _Cohesion score 0.07864488808227466 - nodes in this community are weakly interconnected._
- **Should `Terminal UI Question Manager` be split into smaller, more focused modules?**
  _Cohesion score 0.05064935064935065 - nodes in this community are weakly interconnected._