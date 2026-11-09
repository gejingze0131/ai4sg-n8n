# Handoff：AI4SG 管理系统（全栈网站，下一个 session）

> 写于 2026-10-16。上一个 session 已完成：管线 v18（整理+挑选）、四个领域的专家复现、对外汇报 slides。
> 下一个 session 的任务：交付一个**完善的全栈系统**（前端页面 + 后端 + 账号与权限），取代现在由 n8n 直接提供的
> 单文件审计页和运行表单。n8n 退到幕后，只做“处理引擎”；本 session 的数据、规则和流程全部被新系统继承。

---

## 0. 一句话目标

在仓库里新建独立文件夹 `web/`，用成熟的全栈框架（推荐 Next.js）做一个网站：
**注册/登录**，三种角色（**访客 / 专家 / 管理员**）；dashboard（含项目地图）、筛选与查询、项目/工具/来源详情；
专家审核（Pass/Fail + comment）和申请分析；管理员发起运行、重新初筛、重新整理、撤下运行、管理用户。
**网站拥有用户、权限、请求记录和审计日志；n8n 只接受网站后端带密钥的调用，按请求跑流程、把结果写进数据库。**

**已定**：Next.js + Better Auth；首个管理员 `gejingze0131@gmail.com`（写进 `.env` 的 `ADMIN_EMAIL`，不进 git）；简单邮箱注册、注册时自选访客或专家、暂不做邮箱验证（预留接口）、分析不设额度、地图用外网瓦片。
**项目结构与施工位置见第 14 节。**

---

## 1. 必须遵守的协作约束

- **用中文回复用户。**
- **绝不打印、回显或写入任何密钥**：`.env` 里有 `OPENAI_API_KEY`、`OPENALEX_API_KEY`、数据库密码等。只能用 `grep -c` 之类确认“有没有值”，不能读出值。不要替用户输入密码。
- **运行中不要重启 Docker**。用户自己执行 `./setup.sh --reimport`（会重建/重启容器）；改完工作流后请用户执行。
- `docs/USER_GUIDE.md` 末尾有用户自己的笔记（导师意见），**只能原地编辑**，改前先核对 md5；项目文档版（Project 里的 `claude/ai4sg-expert-user-guide.md`）是去掉笔记的版本。
- 用户电脑上的文件夹**不允许删除文件**；不要往用户文件夹写临时/辅助文件。
- 访问用户 Mac 的方式（cloud session）：
  - `mcp__remote-devices__device_bash`：一个 Linux VM，仓库挂在 `~/mnt/Projects/ai4sg-n8n`。**这里没有 docker，也连不到 Mac 的 localhost**，外网大多也不通。
  - 内置浏览器（`mcp__remote-devices__Claude_Browser__*`）**可以访问 `http://localhost:5678`**（n8n、审计页、JSON 接口）。查数据就用它在页面里 `fetch('/webhook/ai4sg-audit?format=json')`。
  - 往 Mac 同步文件：先放到 cloud 容器的 `/mnt/user-data/outputs/<dir>/`，再用 `mcp__remote-devices__device_commit_files`，最后在 device_bash 里 `md5sum` 核对。
- 公网地址（Tailscale Funnel，`./share.sh on` 时有效）：`https://gemacbook-air.tail2851f0.ts.net/webhook/ai4sg-audit`。当前审计页和写操作 webhook **都没有登录保护**，任何拿到链接的人都能用。

---

## 2. 系统现状（新系统需要继承的部分）

### 2.1 服务（`docker-compose.yml`）
| 服务 | 作用 | 端口 |
|---|---|---|
| `postgres` (18) | 两个库：`n8n`（n8n 自身）和 `ai4sg`（业务数据） | 不对宿主暴露 |
| `n8n` | 工作流引擎；审计页和所有 webhook 都由它提供 | `127.0.0.1:5678` |
| `codex-runner` | 搜索 agent（Codex CLI）、下载器、来源资料库 `library/<source id>/` | 只在 compose 网络内（`http://codex-runner:8787`） |
| `metabase`（profile `bi`） | 可选 BI | `127.0.0.1:3000` |

新前端建议作为 compose 里的新服务（如 `web`，`127.0.0.1:3001`），通过 compose 网络直连 `postgres` 和 `n8n`。

### 2.2 一次运行的流程（供网站“关于/方法”页参考）
Run page → B 搜索（Codex + OpenAlex/Europe PMC/ERIC/World Bank/AEA）→ 下载到 library → C1 初筛（GPT-6 Luna，每条来源一次，写卡片）
→ ② 整理+挑选（GPT-6 Sol，每次运行一次：来源→部署(项目 P-xxxxx)→工具(T-xxxxx)，标重复，按预算挑选）
→ C2 提取（GPT-6 Sol，逐条，引文由代码核对）→ ③ C3 项目汇总 → ④ 统计。详见 `README.md`。

### 2.3 现在的审计页
- 单个 HTML：`n8n/audit/audit.html`（约 1000 行原生 JS），由工作流 `D-audit-page.json` 的 webhook 渲染：把数据 JSON 直接注入页面。
- 结构：顶部领域按钮、KPI、Runs 表、5 个条形图；左侧项目列表 → 右侧项目页（工具、部署、汇总、来源表、合并事实、outcomes）→ 来源页（字段+引文核对、相关性分数、SVG 地图、成本、outcomes、本地副本、Pass/Fail）；底部 “Not analysed yet”（排队/重复/筛掉/下载失败，可勾选 Analyse）。
- 这些功能新网站都要覆盖或链接回去；审计页本身先保留（专家正在用）。

### 2.4 数据接口（都在 n8n，`http://localhost:5678/webhook/...`）
| 接口 | 方法 | 说明 |
|---|---|---|
| `ai4sg-audit?format=json` | GET | `{projects, rows, runs}` 全量。**约 4.3 MB、1.7 s**（651 条来源时），`rows` 在 SQL 里 `LIMIT 1500` |
| `ai4sg-audit?format=geo` | GET | `n8n/audit/geo.json`：Natural Earth 简化边界，**只含 Search Skill 里的 13 个国家**，含 admin1 |
| `ai4sg-file?id=<source>&name=<file|text>` | GET | 来源资料库里的本地副本 / 抽出的文字 |
| `ai4sg-review` | POST | `{extraction_id, decision: approved|rejected, comment, reviewer}`（旧的 `project_id` 形式仍兼容） |
| `ai4sg-project` | POST | `{action: detach|move|merge, source_id | project, target: "P-00012", reviewer}` |
| `ai4sg-analyse` | POST | `{source_ids: [..≤30], reviewer}`：没正文的先下载，再 C2 + ③ |
| `ai4sg-rescreen` | POST | `{domain, limit, min_relevance}` |
| `ai4sg-select` | POST | `{domain, max, analyse}`：重新跑整理/挑选（`analyse:false` 只记录） |

`rows` 每项的键：`id`(extraction id) `source_id` `fields`(完整提取 JSON) `flags` `relevance_score` `screen_relevance` `source_screen`(初筛结果，含 `card`) `status` `created_at` `url` `title` `title_en` `country` `language` `source_type` `run_domain` `domain_tags` `pick` `run_id` `database` `doi` `files` `text_chars` `text_level` `duplicate_of` `via_*` `project_code` `project_name` `project_method` `project_reason` `tool_code` `tool_name` `review_*`。
`projects` 每项：`id code name aliases implementing_org countries domain synthesis deployment tool_code tool_name tool_developer tool_aliases source_ids created_at updated_at review_*(旧的项目级审核)`。
`runs` 每项：`id started_at finished_at domain counts engine countries max_sources`。

### 2.5 数据库（`ai4sg` 库，定义在 `db/pipeline-schema.sql`）
- `sources`：一条候选来源一行。`status`：`candidate`→`collected`|`collect_failed`→`passed`(=排队)|`filtered_out`→`extracted`；另有 `duplicate`（`duplicate_of` 指向保留的那条）。`domain`=找到它的运行的领域；`domain_tags TEXT[]`=它实际属于的领域（可多个，**筛选用这个**）。`screen JSONB`（初筛：`is_ai4sg in_domain relevance reason evidence_type domains card{title_en authors organisation published source_kind deployment ai_method primary_source key_figures summary}`）；`pick JSONB`（整理/挑选的决定与理由）。
- `extractions`：每次深度分析一行（一条来源可多次，取最新）。`fields JSONB` 是 Extraction Skill 的完整输出；`status`：`pending_review` | `filtered_out`（判为非 AI4SG）。
- `reviews`：专家对 extraction 的 Pass/Fail（**现在按来源审核**）。`project_reviews` 是 v11–v17 的旧项目级审核，只读展示。
- `ai_projects`：一个项目 = 一次部署，`code` 形如 `P-00012`；`tool_id`→`ai_tools`；`deployment JSONB {place, phase, org, country}`；`synthesis JSONB`（C3 合并记录，见下）。
- `ai_tools`：工具，`code` 形如 `T-00003`，`name aliases developer`。
- `source_projects`：来源→项目（`method`：`organised` 整理步骤 | `duplicate` | `manual` 评审人 | `merged` | `llm`/`new` C2 自动关联）。
- `runs`、`search_runs`：每次运行和每个搜索任务的统计（`runs.counts` 是漏斗数字）。
- 注意：库里还有一张 v1 遗留的 `projects` 表，**与本系统无关**，别用。
- 新前端连库建议建一个**只读角色**（只授 `SELECT`），写操作一律走 n8n webhook，保证业务逻辑只有一份。

### 2.6 地图与规模相关的字段（项目地图要用）
- 来源级：`extractions.fields.location = {scope, places:[{name, name_original, level: country|admin1|admin2|city|site, admin1, country, lat, lon}], stated}`。坐标由模型给出，是近似值。
- 项目级：`ai_projects.synthesis.places`（合并后、每个地点带 `sids` 来源列表）、`synthesis.scope`、`synthesis.countries`。
- 规模：`fields.reach = {number, unit, is_target, stated}`；项目级 `synthesis.reach[]`（按数值降序，第一条最大）。**单位不统一**（farmers / students / schools / users …），做圆点大小时要按单位归类或只用“人”类单位，并在图例里说清。
- 领域：来源的 `domain_tags`；项目的领域取其来源标签的并集（审计页就是这么算的）。
- 现状（2026-10-16）：651 条来源，56 条分析为 AI4SG（50 个项目有已分析来源；共 231 个项目、167 个工具，多数项目只有排队来源）。56 条里 **52 条有坐标**，43 条有 reach 数字；47 个项目的 synthesis 有带坐标的地点。

---

## 3. 用户提出的需求（原话与拆解）

10-16 的原话：
- “接下来下一个 session 的工作是完成一个更完善的前端页面的开发……最好是个独立文件夹的使用成熟框架（比如 React，或是你认为比较新的成熟的方案）的前端页面，包括 dashboard，更好的 filter 和查询机制，以及更好的 project map（就在 dashboard 页面上）。”
- “以后数据多了，全部一股脑把所有 case 信息都加载也不是什么好方案吧？”
- “n8n 的某次全量 Overview 运行只有管理员可以动，但是申请 analysis 势必要跑 Extraction 流程，且给出的意见 pass 或是 fail 以及 comment 也得进入库。”
- “我希望可以有登录，注册，但是角色不同（三种：访客，专家，管理员）；我希望新交付的项目，应当是一个完善的全栈系统，与 n8n 的角色能够有效解耦合（让本 session 的工作能够在新的系统里被继承，升级的是管理系统，后端与前端页面）。”
- 11-09 用户确认的三项决定：
  1. “现阶段可以不加邮箱验证，就是简单的邮箱注册。注册页面可选是专家还是访客。但是留好后续可邮箱验证的接口。”
  2. 分析额度：“不设限”。
  3. 地图底图用外网瓦片：“可以用”。
- 11-09 第二次确认：“用 Next.js，认证库用 Better Auth。第一个管理员先用我的邮箱，gejingze0131@gmail.com。”

导师意见（slides 第 9 页、用户笔记）：dashboard 更详细，查询更方便，像完整的项目网站而不是单独一个 html；项目地图在地球上显示项目，可视化规模、领域等。

拆解：
1. **Dashboard（首页）**：关键数字（来源 / 已分析 / 项目 / 工具 / 国家 / 领域）、按领域 / 国家 / AI 技术 / 阶段 / 证据强度的分布、运行漏斗与时间趋势、待审数量；**项目地图放在 dashboard 上**：每个部署一个点（缩小时按省/州聚合），大小 = 规模（reach），颜色 = 领域，点击弹出项目卡片，随筛选联动，可切换地球（globe）与平面。
2. **筛选与查询**：全站搜索（项目名、别名、工具、机构、地点、来源标题，多语言）；多维筛选（领域、国家、AI 技术、阶段、证据强度、审核状态、来源类型、是否有 outcome / 成本、运行）；排序；筛选状态写进 URL；**一律服务端分页与按需查询，不再一次加载全部数据**。
3. **完整网站**：项目详情、工具详情（列出全部部署）、来源详情（字段与引文核对、本地副本）、运行页、关于 / 方法页、“未分析”列表。
4. **账号与权限**：注册、登录、三种角色；专家审核与申请分析；管理员的运行管理与用户管理。
5. **与 n8n 解耦**：见第 4 节。

---

## 4. 目标架构与解耦原则

```
浏览器 ──页面 + /api/*──> web（Next.js：页面、后端 API、登录、权限、任务记录、审计日志）
                            ├─ 读：只读角色直连 Postgres（ai4sg 库的视图），服务端筛选 + 分页
                            ├─ 写（网站自己的数据：用户、审核、任务、日志）：直接写 Postgres 的 web 模式 / reviews 表
                            └─ 需要“处理”的写（运行、分析、初筛、整理、项目汇总）：
                                 PipelineAdapter ──带密钥 POST──> n8n webhook ──跑流程──> 写 Postgres
                                                  <──完成回调（带密钥）── n8n（或网站轮询数据库）
```

解耦原则：
1. **n8n = 处理引擎，不是网站。** 它不再对外提供页面（审计页、运行表单逐步退役），不认识用户，也不做权限判断；只接受带共享密钥的请求（n8n webhook 的 Header Auth 凭据），按参数跑流程，把结果写进数据库，并把任务完成情况回报给网站。
2. **网站 = 管理系统。** 用户、角色、会话、审核意见、处理请求（任务）、操作日志都归网站；所有权限判断只在网站后端做一次。
3. **一个适配层隔开 n8n。** 网站后端写一个 `PipelineAdapter` 接口：`startRun(settings)`、`analyse(sourceIds)`、`rescreen(domain, limit)`、`organise(domain, max, analyse)`、`resummarise(projectIds)`、`forgetRun(runId)`。现在用 n8n webhook 实现；以后换成别的队列或服务，只改这一层。
4. **业务逻辑只有一份。** 提取、核对引文、归组、挑选等都留在 n8n 和 skills 里，网站不复制。纯数据操作（审核、移动 / 合并项目的 SQL）写成 **Postgres 函数**（像现有的 `ai4sg_apply_organisation`），网站和 n8n 都调用同一个函数。
5. **数据库分模式。** 现有表（`public`，由管线写）保持不动；网站自己的表放在新模式 `web`；给网站读的东西做成视图（可放 `api` 模式），网站只读视图，管线改表结构时只需同步改视图。
6. **继承本 session 的成果**：同一个数据库（来源、提取、项目、工具、复现结果）、同一套 skills 与工作流；审计页的全部功能移植到新站；`forget-run.sh` 的逻辑改成数据库函数，由管理员在网站里操作。

---

## 5. 角色与权限

| 角色 | 怎么获得 | 能做什么 |
|---|---|---|
| 访客 Visitor | 未登录即为访客；**注册时选择“访客”** | 看 dashboard、地图、项目 / 工具 / 来源（已分析部分）、运行概况、关于页 |
| 专家 Expert | **注册时选择“专家”**（用户决定：现阶段自选即生效）；管理员也可改任何人的角色 | 访客的全部 + 看“未分析”列表（排队、重复、筛掉、下载失败）和原文副本；**Pass / Fail + comment**（记在来源上）；**申请分析**（每次 ≤30 条，**不设每日额度**）；移动 / 拆出 / 合并项目；看自己的审核和申请记录 |
| 管理员 Admin | 首个管理员由部署时的环境变量（如 `ADMIN_EMAIL`）创建；之后可由管理员授予 | 专家的全部 + **发起运行**（原运行表单的所有设置）；重新初筛；重新整理 / 挑选；撤下运行（先归档）；管理用户与角色；看全部审计日志和任务状态 |

规则：
- 权限在网站后端每个 API 里检查（中间件 + 每个路由声明所需角色），前端只是隐藏按钮。
- **注册（已定）**：邮箱 + 密码 + 显示名 + 角色（访客 / 专家二选一），**不做邮箱验证**；管理员不能自选。
- **预留邮箱验证接口（已定）**：`web.users` 保留 `email_verified`（现在注册即记为未验证，但不拦截任何操作）；配置项 `AUTH_REQUIRE_EMAIL_VERIFICATION=false`、`SMTP_*` 先留空；认证库的“发送验证邮件 / 校验链接”钩子写成空实现或开关，打开开关并配置 SMTP 后即可启用，不需要改数据结构。密码重置邮件同理。
- **预留专家审批开关**：配置项 `EXPERT_SIGNUP=open|approval`，默认 `open`（用户的决定：自选即生效）。若以后要收紧，改成 `approval` 时注册为专家的人先是“待审批”，由管理员在用户管理页批准。（提醒：在 `open` 下，任何能打开网站的人都能注册成专家并申请分析，而分析不设额度、每条都花 OpenAI 的钱；网站对公网开放时请留意。）
- 审核人、申请人都记 `user_id`，不再是手填的名字；旧的手填名字保留为历史。
- 分析**不设额度**（用户决定）；但每次申请仍 ≤30 条，同一来源正在分析时不重复提交；全站同时只跑 1 个运行（防止两个运行抢同一批来源）。每条申请都记在 `web.jobs` 和审计日志里，花费可追溯。

---

## 6. 数据所有权与新增表（`web` 模式，由网站的迁移工具管理，如 Drizzle migrations）

| 表 | 作用 |
|---|---|
| `web.users`、`web.sessions`、`web.accounts` | 账号与会话（由认证库生成，如 Better Auth） |
| `web.user_roles`（或 users 上的 `role` 字段） | 访客 / 专家 / 管理员 |
| `web.jobs` | 每一次需要 n8n 处理的请求：`id, type(run/analyse/rescreen/organise/resummarise/forget_run), params, requested_by, status(queued/running/done/failed), n8n_execution_id, created_at, started_at, finished_at, result, error` |
| `web.audit_log` | 每一个写操作：谁、何时、做了什么、对象、前后值摘要 |
| `web.invites`（可选，现阶段不用） | 专家邀请码，留给以后收紧注册时用 |

管线表的小改动（写进 `db/pipeline-schema.sql`，保持 `setup.sh` 幂等）：
- `reviews` 加 `reviewer_id`（指向 `web.users`）；
- 移动 / 拆出 / 合并项目的 SQL 从 `D-audit-page.json` 里搬成函数 `ai4sg_move_source`、`ai4sg_detach_source`、`ai4sg_merge_projects`；
- `forget-run.sh` 的 SQL 搬成函数 `ai4sg_forget_run(run_id)`（资料文件夹的移动交给 codex-runner 或 n8n 做）；
- 给网站读的视图：`api.project_cards`（列表卡片）、`api.map_points`（地图点）、`api.dashboard_stats`（或物化视图，每次运行结束刷新）、`api.source_cards` 等；搜索用 `pg_trgm` 索引。

---

## 7. 全部接口（Next.js 的 `/api/*`）

读（网站后端直连只读视图，全部带筛选与分页）：

| 接口 | 用途 | 角色 |
|---|---|---|
| `GET /api/me` | 当前用户与角色 | 全部 |
| `GET /api/stats?domain=&country=…` | Dashboard 关键数字 | 访客 |
| `GET /api/stats/breakdown?by=domain\|country\|tech\|stage\|evidence` | 图表分组计数 | 访客 |
| `GET /api/map?…筛选&zoom=` | 地图点位（缩小时按省/州聚合） | 访客 |
| `GET /api/search?q=` | 全站搜索 | 访客 |
| `GET /api/projects?q=&domain=&country=&tech=&stage=&evidence=&review=&has_outcomes=&sort=&page=` | 项目列表 | 访客 |
| `GET /api/projects/{code}` | 项目详情 | 访客 |
| `GET /api/tools?q=&page=`、`GET /api/tools/{code}` | 工具列表、工具详情 | 访客 |
| `GET /api/sources?status=&domain=&q=&page=` | 来源列表（`analysed` 对访客开放；`queued/duplicate/filtered/failed` 给专家） | 访客 / 专家 |
| `GET /api/sources/{id}` | 来源详情（提取、引文核对、初筛卡片、挑选理由、文件清单） | 访客 |
| `GET /api/sources/{id}/files/{name}` | 本地副本（后端转发 `http://codex-runner:8787/library/...`） | 专家 |
| `GET /api/runs`、`GET /api/runs/{id}` | 运行列表、单次运行明细（搜索任务、学术库日志） | 访客 / 管理员 |
| `GET /api/jobs?mine=1`、`GET /api/jobs/{id}` | 处理请求的状态（申请分析后轮询） | 专家（自己的）/ 管理员（全部） |
| `GET /api/admin/users?q=&role=&page=` | 用户列表 | 管理员 |
| `GET /api/admin/audit-log?…` | 操作日志 | 管理员 |

写：

| 接口 | 实现 | 角色 |
|---|---|---|
| `POST /api/auth/register` `{email, password, name, role: visitor\|expert}`、`/login`、`/logout` | 认证库；`role=admin` 一律拒绝；`EXPERT_SIGNUP=approval` 时专家先记为待审批 | 全部 |
| `POST /api/auth/verify-email/send`、`GET /api/auth/verify-email?token=`、`POST /api/auth/password-reset/*` | **预留**：开关关闭时返回 501 / 不显示入口；配置 SMTP 后启用 | 全部 |
| `POST /api/reviews` `{source_id, decision, comment}` | 网站直接写 `reviews`（取该来源最新的 extraction），记 `reviewer_id` 与审计日志 | 专家 |
| `POST /api/analyse` `{source_ids}`（≤30 条） | 建 `web.jobs`（type=analyse）→ `PipelineAdapter.analyse` → n8n `ai4sg-analyse`（C2 + ③） | 专家（不设额度） |
| `POST /api/projects/move`、`/detach`、`/merge` | 调数据库函数 → 建 `resummarise` 任务 → n8n C3 | 专家 |
| `POST /api/admin/runs` `{domain, countries, languages, source_types, max_searches, results_per_search, max_analyse, screen_level, engine}` | 建 `run` 任务 → n8n **新增**的运行 webhook（与运行表单同一逻辑） | 管理员 |
| `POST /api/admin/rescreen` `{domain, limit}` | → n8n `ai4sg-rescreen` | 管理员 |
| `POST /api/admin/organise` `{domain, max, analyse}` | → n8n `ai4sg-select` | 管理员 |
| `POST /api/admin/runs/{id}/forget` | 调 `ai4sg_forget_run` + 让 codex-runner 移走资料文件夹 | 管理员 |
| `PATCH /api/admin/users/{id}` `{role, approved}`、`POST /api/admin/invites`（以后） | 改角色、批准待审批的专家、发邀请 | 管理员 |
| `POST /api/internal/jobs/{id}` | **只给 n8n 用**：带密钥回报任务开始 / 完成 / 失败 | n8n |

---

## 8. n8n 一侧需要的改动

1. 所有 webhook 加 **Header Auth**（新凭据，密钥由 `setup.sh` 生成写进 `.env`，网站和 n8n 共用）；没有密钥的请求一律拒绝。
2. 新增“开始运行”的 webhook：A Overview 现在只有表单触发器，加一个 webhook 触发器，把 JSON 参数映射成表单字段后走同一条链。表单只在本机给管理员备用，或退役。
3. 每个 webhook 接收可选的 `job_id`，流程开始和结束时回调 `POST {WEB_URL}/api/internal/jobs/{job_id}`（带密钥）；回调失败不影响流程本身，网站可以轮询数据库兜底。
4. 移动 / 合并项目、撤下运行改为调用第 6 节的数据库函数。
5. 审计页 `ai4sg-audit` 在新站上线后保留一段时间作为备用，之后只允许内网访问。
6. 对外分享只暴露网站：`share.sh` 改为转发网站端口（如 3001），n8n 的 5678 不再出现在公网。
7. 工作流 JSON（`n8n/pipeline/*.json`）就是唯一来源（生成器已随上一个 cloud 容器丢失，见第 12 节）。直接改 JSON：用脚本按节点名定位节点、改参数和连线，改完在本地 n8n 里导入验证。

---

## 9. 技术栈建议（下一个 session 先和用户确认）

- **Next.js（App Router）+ TypeScript**（**已定**），放 `web/`，作为 docker-compose 新服务 `web`（`127.0.0.1:3001`，经 compose 网络访问 `postgres`、`n8n`、`codex-runner`）。页面与 API 在一个项目里；服务端组件直接取数，筛选参数放 URL。
- **认证**：**Better Auth（已定）**（邮箱 + 密码、会话、角色 / admin 插件，支持 Drizzle）；首个管理员由 `ADMIN_EMAIL` 指定：该邮箱注册或首次启动时创建的账号自动成为管理员；密码哈希、CSRF、会话 cookie 交给库处理，不自己实现。
- **数据库访问**：Drizzle ORM（`web` 模式的迁移 + 类型安全查询）；读管线数据只走视图，使用只读数据库角色；写网站自己的表用单独的读写角色。
- **UI**：Tailwind CSS + shadcn/ui；列表用 TanStack Table；表单用 react-hook-form + zod（前后端共用校验）。
- **图表**：Apache ECharts（`echarts-for-react`）。
- **地图**：MapLibre GL JS（v5 支持 globe 投影）+ `react-map-gl`，数据多时加 deck.gl；底图**用外网的免费矢量瓦片**（用户已同意，如 OpenFreeMap，无需 key）；瓦片地址做成配置项 `MAP_STYLE_URL`，以后可换；加载失败时退回用现有 `geo.json` 画国家 / 省界，页面不至于空白。
- **测试**：Vitest（后端逻辑、权限）、Playwright（页面与三种角色的端到端流程）。

---

## 10. 实施步骤（建议的里程碑）

1. **确认唯一剩下的决定**：站点语言（建议英文，面向外部；回复用户用中文）。**已定**：Next.js、Better Auth、首个管理员 `gejingze0131@gmail.com`、简单邮箱注册、注册时自选访客或专家、不做邮箱验证但预留接口、分析不设额度、地图用外网瓦片（见第 0、3 节）。
2. **开发环境**：在 cloud 容器里起 Postgres，用 `db/pipeline-schema.sql` 建表，导入数据快照（请用户 `pg_dump --data-only` 导出 `ai4sg`，或用浏览器取 `?format=json` 做 fixture）；n8n 用 mock（上一个 session 的 mock 服务器不会保留，需要重写一个简单的 webhook 桩）。
3. **骨架**：`web/` 项目、Drizzle、认证（注册 / 登录 / 角色）、中间件权限、`web` 模式迁移、审计日志。
4. **只读部分**：视图、Dashboard + 地图、项目 / 工具 / 来源列表与详情、搜索；全部服务端分页。
5. **专家功能**：审核、申请分析（jobs + 轮询 / 回调）、移动 / 合并项目、未分析列表。
6. **管理员功能**：发起运行（移植运行表单）、重新初筛、重新整理、撤下运行、用户管理、任务与日志页。
7. **n8n 改造**（第 8 节）与 `docker-compose.yml`、`setup.sh`、`share.sh` 更新；README、USER_GUIDE 更新（USER_GUIDE 末尾用户笔记只能原地改）。
8. **交付**：同步到 Mac，请用户 `./setup.sh --reimport`；在内置浏览器里用三种角色分别走一遍。

---

## 11. 验收标准

- 未登录可浏览 dashboard、地图、已分析的项目与来源；注册页可选访客或专家，选访客的不能审核或申请分析，选专家的立即可以；注册时无法选管理员（直接调接口传 `role=admin` 也被拒绝）。
- 邮箱验证开关打开前，注册无需验证；把 `AUTH_REQUIRE_EMAIL_VERIFICATION` 设为 `true` 并配置 SMTP 后，未验证的用户被要求先验证（可在开发环境用假 SMTP 测一次）。
- 专家能审核（写入 `reviews`，带 `reviewer_id`）、申请分析（任务状态从 queued → running → done，结果出现在来源页）、移动 / 合并项目（项目汇总随后更新）。
- 访客调用任何写接口返回 403；直接调用 n8n webhook（不带密钥）被拒绝。
- 管理员能从网站发起一次运行、看到进度和漏斗数字；能撤下一次运行且有归档。
- 任何列表接口在数据量 10 倍时响应仍在 1 秒内（只取一页，走索引）；首页传输量不随数据量线性增长。
- 审计页现有的功能（引文核对显示、相关性分数、outcomes、本地副本、未分析列表、重复来源）在新站都能找到。
- 手机宽度可用；多语言标题（孟加拉文、印地文、泰文、印尼文）显示正常。

---

## 12. 已知的坑

- `?format=json` 全量 4.3 MB 且 `Load Results` 有 `LIMIT 1500`：数据再多会被截断——新站不要依赖它做主数据源。
- 一个项目可能**只有排队来源**（整理步骤提前建了项目），还没有分析结果；dashboard 统计“项目”时要区分“有已分析来源的项目”（现在 50 个）和全部项目（231 个）。
- `extractions` 一条来源可能有多次，取 `created_at` 最新的一条；`fields.is_ai4sg === false` 的要当作“判为非 AI4SG”排除。
- 领域筛选用 `domain_tags`，不是 `sources.domain`。
- 多语言标题（孟加拉文、印地文、泰文、印尼文）：字体要覆盖 Noto Sans Bengali / Devanagari / Thai。
- reach 单位杂、坐标是模型近似值、`level=country` 的点只有国家中心：地图图例和弹窗里要说明。
- `geo.json` 只有 13 个国家的边界。
- n8n webhook 无 CORS 设置：浏览器端直接跨源调用会被拦，写操作建议走 Next.js 的服务端代理（route handler）。
- 工作流 JSON（`n8n/pipeline/*.json`）原本由上一个 session 的 Python 生成器生成，**生成器已随那个 cloud 容器丢失**（只剩几个不完整的分段文件，主程序 `build_v11.py` 不在了），所以 **JSON 就是唯一来源**。改工作流（加密钥校验、加运行 webhook、加回调）时直接改 JSON，改完用 `./setup.sh --reimport` 导入验证。

---

## 13. 其他未决事项（与新系统无关，供参考）

- 教育复现（第 7 轮）结果：专家 10 篇原文找到 7 篇（漏 I05、I07、I08，都是孟加拉/印尼课堂 ChatGPT 小研究）；Sol 自己挑中 3 篇专家原文（I01、I02、I04），专家 9 行结果全对上（7 行数值相同，I01 两行差 0.01 SD，原因未核实）。I09：同一作者两篇论文（p233 专家用、p245 我们分析），整理步骤没归为同一部署。
- 审计页上 56 条已分析来源全部待专家审核（按来源审核后还没有任何决定）。
- Slides（汇报用，9 页）是 claude.ai 上的 artifact “AI for Social Good · Project Update”，封面有 `[Presenter name, affiliation]` 占位待填。
- 文件索引：`README.md`（中文，技术细节与版本说明）、`docs/USER_GUIDE.md`（英文，专家用）、`skills/`（专家规则）、`db/pipeline-schema.sql`、`n8n/audit/audit.html`、`forget-run.sh`（撤下一次运行）、`setup.sh`、`share.sh`。

---

## 14. 项目结构与施工位置（2026-11-09 整理后）

仓库：用户 Mac 上的 `~/Projects/ai4sg-n8n`（Git 远端 `https://github.com/gejingze0131/ai4sg-n8n.git`，目前只有一个提交 “init repo”，之后的改动都还没提交）。
11-09 的整理只做了**移动**，没有删除任何文件；正在运行的系统引用的路径一个都没动。

```
ai4sg-n8n/
├── handoff.md                 本文件：下一阶段的任务说明
├── README.md                  中文技术说明（管线、各版本改动、运维命令）
├── docker-compose.yml         服务：postgres, n8n, n8n-runner, codex-runner, metabase（可选，profile bi）   ← 施工：加 web 服务
├── setup.sh                   一键安装 / --reimport 重新导入工作流                       ← 施工：生成新密钥、构建 web
├── share.sh                   Tailscale Funnel 对外分享（现在分享整个 n8n）              ← 施工：改为只分享 web
├── forget-run.sh              撤下一次运行（归档后删除）                                 ← 施工：逻辑改成数据库函数
├── .env / .env.example        密钥与配置（.env 不进 git，绝不读出）                      ← 施工：加 web 相关配置
├── web/                       【新】全栈网站：Next.js + Better Auth                       ← 主要施工位置
│   └── README.md              计划的目录结构
├── db/
│   ├── init-data.sh           首次启动建库
│   ├── schema.sql             v1 遗留的 projects 表（setup.sh 仍会执行，无害）
│   └── pipeline-schema.sql    管线全部表、函数（v18）                                   ← 施工：web 模式、视图、函数
├── n8n/
│   ├── pipeline/              9 个工作流 JSON（A, A1, A2, B, C1, C, C3, D, E），唯一来源 ← 施工：密钥校验、运行 webhook、回调
│   ├── audit/                 现在的审计页 audit.html + 地图边界 geo.json（新站上线后退役）
│   ├── credentials/           凭据模板
│   └── .render/               setup.sh 的临时目录（不进 git）
├── codex-runner/              搜索 agent 与下载器容器：Dockerfile, server.mjs, tools/scholar.py, tools/html2text.py
├── skills/                    专家规则（每次运行实时读取）：search/, extraction/（含 examples/）, domains/（4 个领域模块）
├── expert-input/              专家原始文件（Word/Excel/PDF + 文本版），按领域；各领域 _old_2026-10-09/ 是旧版
├── docs/
│   ├── USER_GUIDE.md          专家使用指南（英文；末尾有用户笔记，只能原地改）
│   └── img/                   指南里的截图
├── library/                   来源资料库：每条来源一个文件夹（约 650 个，783 MB，不进 git）
├── library-archive/run4/      forget-run.sh 撤下的第 4 轮的资料（不进 git）
├── codex-runs/                每个搜索任务的完整记录（约 100 个，2.8 GB，不进 git）
└── archive/                   【新】旧材料（不进 git），见 archive/README.md
    ├── n8n-workflows-legacy/  v1（最早的 collect + dashboard 原型）与 v2–v5 旧工作流
    ├── library-old-20261012/  10-12 重置数据库前的资料库
    └── backups/               10-12 的数据库全量备份
```

`.gitignore` 已补上：`.DS_Store`、`.share-caffeinate.pid`、`archive/`、`web/node_modules/`、`web/.next/`、`web/.env*`。

### 接手后在哪里施工

- **主要施工位置**：`web/`（新建的全栈网站）。
- **需要同步修改的现有文件**：`db/pipeline-schema.sql`（`web` 模式、只读视图、移动 / 合并 / 撤下运行的函数、`reviews.reviewer_id`）；`n8n/pipeline/*.json`（Header Auth、开始运行的 webhook、任务回调）；`docker-compose.yml`（`web` 服务）；`setup.sh`（生成 `BETTER_AUTH_SECRET`、`N8N_WEBHOOK_SECRET`，写入 `ADMIN_EMAIL`，构建并启动 web）；`share.sh`（只分享 web）；`.env.example`；`README.md`、`docs/USER_GUIDE.md`。
- **不要动**：`library/`、`codex-runs/`、`library-archive/`、`archive/`（数据）；`skills/`、`expert-input/`（专家的规则与原件，除非用户要求）。

### 代码怎么在 cloud session 和 Mac 之间流转（二选一，开工前和用户确认）

1. **推荐：走 GitHub。** 用户先在 Mac 上把现状提交并推送（命令见下），确认仓库是 **private**（里面有专家材料和系统说明）。下一个 session 若连接了 GitHub，就克隆仓库，在分支 `feature/web` 上开发，推送后开 PR；用户在 Mac 上 `git pull` 后执行 `./setup.sh --reimport`。
2. **备选：走桥接。** 在 cloud 容器里开发和测试，再用 `device_commit_files` 把文件写进 Mac 的 `~/Projects/ai4sg-n8n/web/` 等位置。限制：桥接的 shell 不能删文件，所以**不能在那里跑 `git commit`**（git 要删锁文件），也没有 docker；提交和重启都由用户在 Mac 上做。

用户在 Mac 上提交现状的命令（第一次）：

```bash
cd ~/Projects/ai4sg-n8n
git rm --cached .share-caffeinate.pid          # 这个运行时文件以前被误加进了 git
git status                                     # 确认没有 .env、library/、codex-runs/、archive/
git add -A
git commit -m "Pipeline v18, four-domain replication, project tidy-up, handoff for the web app"
git push
```

`expert-input/`（约 9 MB，含专家的 Word/PDF）目前会被提交。若仓库是公开的，或用户不想把专家原件放进 GitHub，先把它加进 `.gitignore` 再提交。
