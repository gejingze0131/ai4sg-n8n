# AI for Social Good · 专家 Skill 驱动的采集与解读管线（MVP）

两位专家交付两个 Skill 文件，n8n 按它们去全网搜索、提取与解读，结果在网站（`web/`）上供专家核对。

**系统分两层**：网站（Next.js + Better Auth，端口 3001）拥有用户、权限、处理请求和操作日志，是所有人使用的入口；n8n 退到幕后做处理引擎，只接受网站带共享密钥的调用，把结果写进数据库并回报任务情况。网站的结构、开发和测试见 [web/README.md](web/README.md)。

```
skills/search/SKILL.md ──► B · Search：英文任务先查领域的固定库（OpenAlex / Europe PMC / ERIC / World Bank / AEA RCT Registry），
  + skills/domains/<领域>.md        再由 Codex 逐条初筛、补充网页搜索、顺着引用和新闻提到的报告级联一层
                                  │ 全部候选入库（sources 表，一条不截断；同 URL 或同 DOI 视为已知）
                         codex-runner /collect：下载读者和审计者需要的资料（网页/PDF、全文 PDF、附录、相关报告；
                                  │ 不下载数据集和代码）到 library/<来源 id>/，并抽出文字
                         C1 · Screen（Luna）：每条新来源都初筛 → passed（排队）或 filtered_out
                         整理（GPT-6 Sol，每次运行一次）：读全部排队来源的卡片，把来源归到部署（项目 P-…）、部署归到工具（T-…），
                                  │ 标出重复来源；有分析预算（Max sources）时选出最值得分析的 N 条，不填则全部分析
skills/extraction/SKILL.md ─► C2 · Extract & Interpretation（Sol，读本地文字 + 所属部署作背景 → 提取+解读 → 核对引文）
  + skills/extraction/examples/     │
                         C3 · Project Synthesis：把同一项目的所有来源合并成一条项目记录（每个数字注明出处 S12）
                         ③ Project Summaries：运行结束时重新汇总有变化的项目
                                  ▼
                     网站 http://localhost:3001：Dashboard 与项目地图 → 项目 → 来源；专家按来源审核
A · Overview 负责把以上串起来：管理员在网站上发起运行（也保留本机的运行页），选领域、国家、语言、来源类型、深度解析多少条等。
搜索之后是一条直线上的四个阶段，每个阶段是一个子工作流，前一个跑完才开始下一个（没事可做也会往下传）：
① Collect & Screen（下载 + Luna 初筛）→ ② Organise & Extract（Sol 整理与挑选 + C2）→ ③ Project Summaries（汇总）→ ④ Finish Run（统计）。
D · Audit Page 提供各个 webhook（分析、初筛、整理、项目汇总等），常驻运行；旧审计页作为只读备份保留，只能在本机打开。
```

## 1. 运行前需要准备

| 项 | 说明 |
|---|---|
| Docker | Mac 上装 Docker Desktop 或 OrbStack，并启动 |
| OpenAI API key | 必须是 OpenAI 的 key（联网搜索是 OpenAI 自带工具，其他兼容接口没有）；账号需能用 `gpt-6-luna`（搜索）和 `gpt-6-sol`（提取与解读） |
| 两个 Skill | 仓库里已有初稿，专家可直接改 |

## 2. 启动

```bash
cd ~/Projects/ai4sg-n8n
cp .env.example .env
open -e .env
chmod +x setup.sh && ./setup.sh
```

`open -e .env` 会用文本编辑器打开配置文件：在 `OPENAI_API_KEY=` 后面粘贴 key，在 `ADMIN_EMAIL=` 后面填第一个管理员的邮箱，保存，再运行最后一行。`setup.sh` 会生成其余密钥，并在第一次启动时建好管理员账号；初始密码在 `.env` 的 `ADMIN_INITIAL_PASSWORD`，登录后到 **My account** 改掉。这个邮箱别人注册不了。

然后打开 http://localhost:3001 登录，**Admin → Start a run** 发起运行，进度和漏斗数字在 **Admin** 页看。n8n 编辑器 http://localhost:5678 只在本机可用（第一次打开时建 n8n 的 owner 账号），Executions 里能看到每一步的细节。

**从旧版本升级**：执行 `./setup.sh --reimport`（会重建并重启容器，**不要在运行进行中做**）。之后 n8n 的 webhook 都需要密钥，旧审计页变成只读备份。如果之前开着分享，再执行一次 `./share.sh on`，公网地址就会转到网站。

运行设置：

| 设置 | 含义 |
|---|---|
| Countries / Other countries | 勾选重点国家；其他国家直接填名字（在 Search Skill 国家表里的会用当地语言搜，不在的只用英语搜） |
| Search languages | 当地语言、英语，可都选 |
| Source types | 新闻、政府报告、政府网站、期刊论文、会议报告、开源代码与数据 |
| Topic focus | 可选，例如 health, agriculture |
| Published from (year) | 可选，只要这一年及之后发表的 |
| Max web searches | 最多几次联网搜索（每次 = 一个国家 × 一种语言 × 一类来源），控制费用 |
| Results per search (target) | 每次搜索的目标条数：找到更多符合条件的也全部保留，不截断 |
| Max sources to analyse in depth | 分析预算：本次深度解析（Sol）的条数。所有新来源都会下载和初筛；超出预算时由 Sol 从整个排队中选出这么多条，其余排队、下次重新选。**不填（或 0）= 通过初筛的全部分析** |
| Relevance screen | 相关性筛选的松紧：Broad 0.4 / Balanced 0.6 / Strict 0.8 |

改了 `.env` 里的 key 之后运行 `./setup.sh --reimport`。

## 搜索 agent（B · Search）

默认用 **Codex agent**：每个搜索任务（国家 × 语言 × 来源类型）在 `codex-runner` 容器里跑一次 Codex CLI（`codex exec`），
Search Skill 作为 Codex 的 `AGENTS.md`。Codex 可以多轮搜索、用 curl 打开网页、下载 PDF 用 pdftotext 读、翻政府网站的出版物列表，
确认后才列出候选。最多同时跑 3 个，每个最多 20 分钟（`.env` 里的 `CODEX_MAX_PARALLEL`、`CODEX_TIMEOUT_MIN` 可改）。
运行页上可以改选 **Single API call**（之前的一次 API 调用方式），方便对比。

- 每次搜索的完整过程在 `codex-runs/<时间-国家-语言-类型>/`：`TASK.md`（任务）、`events.jsonl`（每一步）、`candidates.md`（Codex 的笔记）、`downloads/`、`result.json`。
- 每个搜索任务记一行到 `search_runs` 表。对比两种方式：

```bash
docker compose exec -T postgres psql -U n8n -d ai4sg -c "SELECT engine, count(*) AS searches, round(avg(duration_s)) AS avg_s, sum(candidates) AS candidates, sum(input_tokens) AS in_tok, sum(output_tokens) AS out_tok, count(error) AS failed FROM search_runs GROUP BY engine"
docker compose exec -T postgres psql -U n8n -d ai4sg -c "SELECT s.search_engine, count(*) AS sources, count(*) FILTER (WHERE e.status='pending_review') AS passed_screen, round(avg(e.relevance_score)) AS avg_score FROM sources s JOIN extractions e ON e.source_id=s.id GROUP BY 1"
```
- 看 runner 日志：`docker compose logs -f codex-runner`。

### 固定学术库、级联、资料库、项目（v9）
- **固定学术库**（v10 改）：英文的 Journal / Conference 任务，runner 按 `skills` 里 ```json academic``` 块（通用块 + 领域块，领域块覆盖同名设置）
  **每个国家查一次**，同一次运行里该国的期刊任务和会议任务共用结果：
  - **Europe PMC**（PubMed、PMC、medRxiv；免费不限量，健康领域用）：AI 词、主题词、证据词都在标题或摘要里，国家在标题、摘要**或作者单位**里
    （很多试验只在单位里写国家，例如 Abramoff 2023），排除综述，**全部取回**（上限 `max_hits`，默认 3000）。
  - **OpenAlex**（全学科；每次搜索扣每日额度，不带 key 约每天 100 次）：只在 `venues` 列出的 AI4SG 会议里查一次（AAAI、CHI、COMPASS、
    KDD、IJCAI、ICTD、arXiv），会议论文很少进 Europe PMC；块里没有 `europepmc` 时（教育、农业、公共服务）再加一次通用标题摘要查询。
  - **ERIC**（教育）。
  - **World Bank Documents & Reports**（v14，免费；服务 Government report 和 Journal 任务）：按国家标签取 Publications & Research
    （工作论文、报告、简报），每个 AI 词单独查全文，再要求 AI 词出现在标题或摘要里（全文检索噪音大）。结果缓存一天。
  - **AEA RCT Registry**（v14，免费；服务 Journal 任务）：整个注册库 CSV（约 80 MB、1.3 万条试验）每周下载一次缓存在
    `codex-runs/_cache/`，本地查 AI 词 + 国家（标题、摘要、干预、国家列；很多试验国家列写 “Private”，所以也看摘要）。
    注册条目带 `papers`（登记的结果论文），Codex 据此去找工作论文、J-PAL/IPA 摘要。
  每个库服务哪些任务类型可在领域块里用 `"task_types"` 改；同一次运行里相同查询只发一次，各任务共用（v14 起按查询缓存）。
  目前只有 Public service 列了 `worldbank` 和 `aearct`；Healthcare 仍是 Europe PMC + OpenAlex，不受影响。
  所有结果在本地打分排序（标题里有 AI、真实使用或部署的迹象、标题摘要里出现国家；纯技术论文和综述往后），写到
  `codex-runs/<任务>/academic_hits.jsonl` 和 `academic_titles.tsv`。Codex 先逐条读 6 分以上的摘要，再把其余全部标题过一遍。
  **建议在 `.env` 里填 `OPENALEX_API_KEY`**（免费注册 OpenAlex 账号即得）：不带 key 每天只有 0.1 美元的额度（约 100 次检索），
  用完后返回 HTTP 429；免费 key 额度是 10 倍。不带 key 时 OpenAlex 也不允许用 cursor 翻到第 2 页（HTTP 401，v17 及以前的
  “通用查询”因此整条失败），v18 起改用页码翻页，有没有 key 都能取到前 400 条。出错时 Runs 表和 `academic_log.json` 里写明
  OpenAlex 给的原因。`SCHOLAR_MAILTO` 可选。没有接口的库
  （Google Scholar、Scopus、AGRIS、3ie、区域期刊）仍由 Codex 网页搜索。单次 API 模式不查固定学术库。
- **级联一层**：Codex 读候选时，若参考文献、引用它的论文、新闻提到的评估报告也符合条件，就列为新候选，记录 `found_via`（来自哪条）
  和关系（cites / cited_by / mentioned_in）；不从级联来的条目再级联；每个任务最多 10 条（`CASCADE_MAX_PER_TASK`）。
  Codex 在容器里可用 `scholar refs <DOI>`、`scholar citedby <DOI>` 查引用关系。
- **资料库**：`library/<来源 id>/` 里有下载的网页、PDF 或全文 XML，`text.txt`（AI 读的就是这份文字，引文也按它核对）和 `manifest.json`。
  论文（有 DOI 或 PubMed/PMC 链接）先问 Europe PMC 和 OpenAlex 哪里有开放全文：优先 Europe PMC 全文 XML，其次开放 PDF；出版社页面常对程序返回
  验证码或跳转页，这类页面会被识别并丢弃，不算正文。拿不到全文时保底存摘要（`text_level` = `abstract`）。
  数据集、表格、代码、压缩包一律不下载，只记链接。审计页 “Local copies” 可直接打开本地副本。
- **重新下载**：下载失败、或旧版本下载器只存到验证码页的来源，下次运行自动再试一次（每次最多 40 条）；如果之前因为没有正文被抽取判成
  不相关（且没人审过），拿到正文后删掉那次抽取、重新筛选和解析。
- **解析的挑选**：没有正文（少于 300 字）的不解析；有全文的排在只有摘要的前面；只有摘要的解析结果带 `abstract_only` 标记。
- **工具和部署（v18）**：项目（`ai_projects`，P-00012）是一次**部署/干预**（专家的分析单位），命名为“工具 — 地点/阶段”；
  每个项目挂在一个**工具**下（`ai_tools`，T-00003：产品、应用或模型本身，带开发方），同一工具的不同部署在审计页上互相链接。
  分组由 ② 的整理步骤在分析之前完成（见下）；整理失败或审计页手动送去分析的来源，C2 按名称、机构、国家、产品找相近的已知项目，
  有相近的再让 Luna 判断是否同一个，不是就新建（工具取提取出的产品名）。审计页上可以“Not this project”或“Move to P-…”。
- **每次运行的数字**：`runs` 表和审计页顶部 “Runs”：Found（所有候选）→ Unique（本次去重）→ New（没见过的）→ Cascaded → Downloaded
  （其中 full_text 全文、abstract_only 只有摘要）→ Passed screen → Analysed（其中来自排队）→ Queued → New projects；retried / retried_ok
  是本次重新下载的旧来源。
- **去重（v14）**：同一次运行里，同 URL、同 DOI、**或同标题**（规范化后超过 25 个字符；同一论文的期刊页、预印本、仓储副本）只保留第一条，
  其他版本的链接挂在它的 `files` 里作为备用全文下载；和库里已有来源同标题的新候选也视为已知。`runs.counts.versions_merged` 记合并了几条。
- **挑选的公平性（v14）**：排队来源分数相同时（常见的是初筛相关度都是 1.0），不再按 id 顺序（会全部偏向最先搜索的国家和类型），
  而是在国家 × 来源类型之间轮流挑。
- **按证据强弱挑选（v15）**：初筛（C1）同时给出这条来源本身报告的证据类型 `evidence_type`（rct / quasi_experimental / observational /
  pilot_report / anecdotal / none）。挑选时仍是新项目优先、每个新项目先挑一条（挑它证据最强的那条），之后按证据强弱 → 全文优先 →
  本次运行优先 → 初筛相关度 → 国家 × 类型轮流。v15 之前初筛过的来源没有证据类型，按来源类型估计（期刊/会议 > 政府/NGO 报告 > 新闻和网页）。
- **整理与挑选（v18，替代 v17 的“分析选择”和原来的 E · Project Clean-up）**：初筛（Luna）为每条来源写一张“卡片”：英文标题、作者、
  机构、发布时间、来源类型（期刊论文、工作论文、试验注册、政府报告、项目或开发方报告、新闻……）、讲的是哪个干预/部署、是否一手材料、
  最多 5 个来自真实使用的关键数字、2–3 句摘要，以及 **AI 方法**（`ai_method`：来源自己写明的 AI/ML 方法；只说“AI/智能”没写方法时为
  “not stated”；机理模型、统计指数、阈值或固定规则写“none: …”，这种系统不算 AI，初筛直接判为不是 AI4SG）。② 先把全部排队来源（最多 400 条）的卡片，连同已知的部署和工具、共享规则（Search Skill 3b）、
  领域定义和“什么算一个项目”（Extraction Skill 第 10 节），一次交给 GPT-6 Sol（**每次运行都调用，即使不设预算**），它返回：
  1. 每条来源属于哪个**部署**：已知的 P-编号，或它新定义的部署（“工具 — 地点/阶段”，带机构、国家、地点、阶段），每个部署挂在一个**工具**下；
     综述类、不针对某个部署的来源不归组。
  2. **重复来源**：同一份文档出现两次（同一论文两个网址、预印本和正式版、转载的同一份报告或新闻稿、译本）：状态 `duplicate`，
     `sources.duplicate_of` 指向保留的那份，留在部署下但不分析。转述报告的新闻不算重复。
  3. 已知部署里其实是同一个的，合并（老编号保留，另一个名字记为别名）；缺工具或工具错了的，补上。评审人手动放置过来源的部署不动。
  4. 有预算且排队多于预算时的**挑选**（AI 方法为 none 的不选；“not stated” 排在写明方法的后面，明显是 AI 工具的除外）：尽量覆盖不同部署（还没有分析过来源的部署优先）；同一部署选一手、可核查事实最多的那篇
     （项目或开发方自己的报告可以比小规模试验站论文更值得分析）；其他相近时按默认顺序（证据更强、全文优先）；兼顾国家；
     明显不符合规则的不选。不设预算时不挑选，除重复以外全部分析。
  分组在分析之前就写进数据库（`source_projects.method = organised`），排队的来源也已经挂在部署下；C2 分析时把所属部署和它的其他来源
  作为背景放进提示词，提取后若判定不是 AI4SG 就撤回分组。每条来源的分组理由、入选或落选理由存在 `sources.pick`，审计页显示。
  Sol 调用失败时退回规则排序（新项目优先、证据强弱、全文、本次运行、相关度、国家 × 类型轮流），不分组，由 C2 自己关联项目。
  `POST /webhook/ai4sg-select`（`{domain, max, analyse}`，`max: 0` 表示不设预算）可以对某领域的排队重新整理一次
  （`analyse: false` 只记录分组和挑选理由，不分析）。v17 之前初筛的来源没有卡片、v18 之前的卡片没有 AI 方法，可先用 `ai4sg-rescreen` 补上（重新初筛时，重复来源保持重复，
  被重新判为不相关的排队来源会撤回分组）。
- **初筛失败不再算“不相关”（v15）**：模型回答不合格式时自动重问（最多 3 次）；仍失败就不做决定，来源留在“已下载、未初筛”，
  下次同领域运行开头重新初筛（审计页 Not analysed yet 的 “Not screened yet” 里会写明）。升级时把以前因此被判 filtered_out 的来源放回去。
- **初筛参考同一项目的其他来源（v15）**：一篇新闻常常不写 AI 细节。初筛前先查已判为 AI4SG、同名项目的其他来源和已知项目，一起交给
  Luna：如果是同一个项目，就按项目整体判断是否 AI4SG，而不是因为这一篇没写 AI 就拒掉。
- **领域标签（v15）**：初筛给每条来源打上它实际所属的所有领域（healthcare / public_service / agriculture / education，可以多个，
  定义取自各领域模块第 1 节），存在 `sources.domain_tags`；`sources.domain` 仍记录是哪个领域的运行找到的。只属于别的领域的来源
  （例如公共服务运行搜到的 TB 筛查论文）也算通过初筛，进入那个领域的排队；各领域的挑选按标签取来源。审计页的领域标签和 Domain
  按钮也按标签：一个条目可以同时出现在几个领域里。
- **按领域设定挑选方式（v16，已取消）**：`"pick_by"` 不再使用；所有领域用同一套默认顺序，由 v18 的整理步骤在打平时参考。
- **实施要求（v16）**：提取的 `implementation` 多了 `requirements`（部署和运行需要什么），和 barriers、facilitators 并列；
  农业和教育专家的新规则要求这三项分开记录。
- **重新初筛**：`POST /webhook/ai4sg-rescreen`，body `{"domain": "public_service", "limit": 300}`：用当前的初筛重新判一遍该领域
  v15 之前初筛过的来源（补上证据类型和领域标签）；已经深度分析过的来源只更新标签，不改状态。
- **搜索超时**：任务在 runner 里排队（同时 3 个），n8n 等每个任务最多 3 小时（含排队时间），runner 里每个 Codex 会话仍是 20 分钟上限。

```bash
docker compose exec -T postgres psql -U n8n -d ai4sg -c "SELECT id, domain, counts FROM runs ORDER BY id DESC LIMIT 5"
docker compose exec -T postgres psql -U n8n -d ai4sg -c "SELECT p.code, p.name, count(*) AS sources FROM ai_projects p JOIN source_projects sp ON sp.project_id = p.id GROUP BY 1, 2 ORDER BY 3 DESC"
```

## 分享给其他人（用这台 Mac 当服务器）

通过 Tailscale Funnel 把这台 Mac 上的网站开放到公网（n8n 不对外），固定地址形如 `https://你的Mac名.xxxx.ts.net`，免费，不用改路由器。

第一次准备：从 https://tailscale.com/download/mac 安装 Tailscale，打开并登录（Google 账号即可）。

```bash
cd ~/Projects/ai4sg-n8n
./share.sh on
```

第一次运行时，Tailscale 可能会打印一个链接，让你在网页上允许 Funnel；打开、同意后再运行一次 `./share.sh on`。
成功后会打印公网地址，发给对方即可。演示结束运行 `./share.sh off`。

- 未登录也能看 Dashboard、地图和已分析的内容；注册时选“专家”可以审核和申请分析，选“访客”只能浏览。
- 分享期间 Mac 要开机、联网、Docker Desktop 在运行；`share.sh on` 会阻止 Mac 自动睡眠，但合上盖子仍会睡眠（外接显示器时除外）。
- 现在任何能打开网站的人都能注册成专家并申请分析，分析不设额度，每条都花 OpenAI 的钱。要收紧时在 `.env` 里设 `EXPERT_SIGNUP=approval`（专家由管理员批准），再 `docker compose up -d web`。不演示时运行 `./share.sh off`。
- 设置了 `PUBLIC_URL` 时登录 Cookie 带 Secure：Chrome 在 http://localhost:3001 上可用，Safari 只能走公网地址。

## 3. 专家怎么改 Skill

- `skills/search/SKILL.md`：什么算 AI4SG、各类来源怎么搜、本地语言关键词、推荐站点。文件里的 `json countries`
  代码块是国家表（ISO 代码 + 当地语言），要让新国家用当地语言搜索就加一行。每次搜哪些国家、多少条在运行页上选，不用改这个文件。
- `skills/extraction/SKILL.md`：提取哪些字段（项目、AI 技术、起止时间、地点、成本明细、收益等）、每个字段怎么判断、怎么写解读。新增或改名字段还要同步改 C 流程的输出格式（Extraction Schema 节点）和审计页。
- `skills/extraction/examples/`：专家亲手做的提取样例，一篇一个 `.md` 文件，会作为示范放进提示词。复制 `_TEMPLATE.md` 开始；以 `_` 开头的文件不会发给模型。
  文件名以领域开头（如 `healthcare-xxx.md`）的样例只在该领域的运行里使用。
- `skills/domains/`：四个领域模块 `healthcare.md`、`public_service.md`、`agriculture.md`、`education.md`，由专家的
  Word/Excel 规则（原件在 `expert-input/`）简化而来。每个模块包含：该领域什么算 AI4SG（要求真实测试或部署）、
  检索词和本地语言词、数据库与站点、4 个领域字段、结果（outcome）分类及特殊编码规则、专家已做的参考案例。
  格式、语言、引文、成本、评分等通用规则仍在两个 SKILL.md 里，所有领域共用。专家的 32–36 列如何合并到通用字段 +
  4 个领域字段，见 `skills/domains/README.md`。领域字段和 outcome 分类专家可以直接改，不用改流程；新增一个领域需要在运行页加一个选项。

### 领域模式下多了什么
- 运行页新增 **Domain**：All domains（不加模块，和以前一样）/ Healthcare / Public service / Agriculture / Education。
- 搜索：领域模块追加在 Search Skill 后面（Codex 的 `AGENTS.md`，或单次 API 的 instructions），任务里写明领域。
- 相关性初筛：额外判断 `in_domain`，不属于该领域、或没有真实测试/部署的来源会被过滤，原因写在 Filtered out 里。
- 提取：新增 `use`（问题、使用者、AI 角色、人的角色、渠道）、`implementation`（障碍、促进因素）、`domain_fields`、
  `outcomes`（每个结果一行：分类、名称、测量、对比、数值、单位、不确定性、时间、数据来源、引文）。每行 outcome 的引文由代码核对，
  没找到会标 `outcome_without_evidence`；有已核实数值的 outcome 也计入评分的“Quantified facts”。
- 数据库：`sources.domain`、`search_runs.domain` 记录这次运行的领域。比如：
  `SELECT domain, count(*) FROM sources GROUP BY 1;`

文件保存后，下一次运行即生效，不用重启。

## 4. 审核（网站）

下面的功能都已搬到网站，专家使用说明见 `docs/USER_GUIDE.md`。n8n 上的旧审计页保留为只读备份（http://localhost:5678/webhook/ai4sg-audit）。

**审计的最小单位是来源，按项目呈现**（v18）。项目列表里的项目（部署）点开是项目页：工具、部署信息、项目汇总，以及它的全部来源
（已分析、排队中、重复）；点某条来源进入它自己的审计页（提取、逐条核对的引文、本地副本、Pass / Fail）。只有一条来源的项目不套项目页，
点开直接是这条来源的审计页。项目页上显示“已审几条/共几条”；全部通过显示 ✓，有一条不通过显示 ✗。

- **什么算同一个项目**：写在 Extraction Skill 第 10 节“One project, many sources”，专家可以直接改。项目指“谁在什么地方用 AI 为谁做什么”
  的那个项目，而不是某一项研究：同一项目的不同研究、阶段、地点、软件版本，以及项目内并列比较的几个产品，都算一个项目；
  互不相关的机构各自采购同一商业产品，算不同项目。
- **怎么关联**：分析之前由 ② 的整理步骤（Sol）按第 10 节分组（见上）；没被分组的来源在提取后（C2）和已知项目比对：同一国家，
  并且名称相近、实施机构相同、地点相同或 AI 产品相同，就算候选，由 GPT-6 Luna 按第 10 节判断是否同一项目。
- **项目汇总（C3 · Project Synthesis）**：由代码把项目所有来源的提取合并：结果行、覆盖人数、成本、地点都保留出处（S12），
  阶段和证据取最强的一条，时间取最早开始到最晚结束。来源多于一条时，Luna 再写一段项目总结：做了什么、证据说明了什么、
  各来源在哪里一致或矛盾、还缺什么。结果存在 `ai_projects.synthesis`。
- **去重（v18）**：重复来源和重复项目都在分析之前由整理步骤处理（见上），不再有分析后的 Clean-up，审计页也不再有
  “Find duplicate projects” 按钮。每次运行结束时 ③ 只重新汇总有变化的项目。评审人手动放置过来源的项目不会被自动合并。
- **页面上的操作**：项目卡片里列出全部来源（S12…），点开可以看该来源自己的提取、逐条核对过的引文和本地副本；
  在来源页可以“Not this project”或“Move to P-…”；在项目页可以“Merge into P-…”。改动后相关项目会自动重新汇总（约半分钟）。
- **通过 / 不通过**：按来源记，存进 `reviews` 表（每次决定都保留，页面显示最新一次）。v11–v17 按项目做的决定仍在 `project_reviews`，
  项目页上显示为“Earlier project-level decision”。“Awaiting review” 列出还有已分析来源没审的项目。

- **相关性打分（0–100）**：由 C 流程的 Verify Evidence 节点按固定规则计算，不是模型自评。5 项各 20 分：AI 技术明确、社会目的与受益人、具体地点、落地实施（执行机构 + 试点/推广/已停止）、有量化数据（成本/覆盖人数/收益幅度）。
  每项只有在字段填了、且至少一条对应引文在原文中逐字找到时才得分。规则写在 Extraction Skill 第 9 节。
- **地图**：边界数据是 `n8n/audit/geo.json`（Natural Earth，公有领域，已简化，覆盖 Search Skill 国家表里的 13 个国家）。区域按名称涂色，具体地点按模型给的近似坐标打点。
- **Not analysed yet（页面最底部）**：所有还没做深度分析的来源，按原因分组：排队中（通过初筛但没挑上，受“深度提取数量”限制）、
  重复来源（同一文档，附保留的那份）、初筛判为不相关（附 Luna 的理由）、下载失败（附具体原因）、还没初筛、以及分析后判为不是 AI4SG（只供抽查）。每条可以点开看，
  觉得值得分析就点 **Analyse**（或勾选多条后 **Analyse selected**，一次最多 30 条）：没有正文的先下载，然后 C2 提取、关联项目、③ 重新汇总；
  每条约一分钟，刷新页面看结果。对应 `/webhook/ai4sg-analyse`。
- **按领域看（v14）**：每个条目（项目、来源、Not analysed yet 里的行）都有领域标签（Healthcare 绿色、Public service 紫色……），
  领域取自找到它的那次运行。页面顶部 **Domain** 一排按钮（All domains / Healthcare / Public service …，数字是该领域的项目数）对整页生效：
  列表、顶部数字、图表、Runs 表、Not analysed yet 都只显示所选领域。排序可选：最新、最早、相关度高/低、领域、国家、名称；
  Not analysed yet 也可按初筛相关度、时间、领域、国家、来源类型排序。
- **通过 / 不通过**：以专家身份登录，每条来源页底部点 Pass / Fail，可附评论。每次决定都存进 `reviews` 表（带 `reviewer_id`；可改，页面显示最新一次），以后可作为标注数据使用。

### 审计页上的标记

| 标记 | 含义 |
|---|---|
| `quote_not_found` | 模型给的引文在原文里找不到（可能是转述或编造） |
| `cost_without_evidence` / `benefit_without_evidence` | 声称有成本/收益数字，但没有能对上的原文引文 |
| `outcome_without_evidence` | 某行 outcome 引用的引文没有在原文里找到 |
| `no_text_extracted` | 原文下载失败或抽不出文字（如网站拦截、扫描版 PDF） |
| `extraction_failed` | 模型没有返回可解析的结果 |
| `abstract_only` | 只拿到摘要（不到 3000 字），结论要谨慎 |

## 5. 常用操作

| 操作 | 命令 |
|---|---|
| 看日志 | `docker compose logs -f web`、`docker compose logs -f n8n` |
| 直接查数据 | `docker compose exec postgres psql -U n8n -d ai4sg -c "select * from extractions order by id desc limit 5"` |
| 停止 / 启动 | `docker compose stop` / `docker compose up -d` |
| 备份 | `docker compose exec -T postgres pg_dumpall -U postgres > backup.sql` |
| 撤下一次运行（当作没跑过） | 网站上 **Runs → 那次运行 → Take out this run**，或命令行 `./forget-run.sh 4` 先看会撤下什么，`./forget-run.sh 4 --yes` 执行。删除前每行都复制到数据库的 `archive` 模式（`archive.run4_*`），资料文件夹移到 `library-archive/run4/`，需要时可以手动恢复 |

务必备份 `.env`：其中的 `N8N_ENCRYPTION_KEY` 用来加密 n8n 保存的 API key。

## 文件结构

```
ai4sg-n8n/
├── handoff.md                 交接文档：下一阶段的全栈网站（web/）
├── web/                       全栈网站（Next.js + Better Auth），见 web/README.md
├── skills/                    专家交付物（接口）
│   ├── search/SKILL.md
│   ├── extraction/SKILL.md, examples/
│   └── domains/               领域模块：healthcare, public_service, agriculture, education
├── expert-input/              专家交付的原始 Word/Excel（含文本版），按领域分文件夹
├── n8n/pipeline/              工作流：A-overview（A1-collect-screen, A2-pick-extract 两个阶段）, B-search, C1-screen, C-extract-interpretation,
│                              C3-project-synthesis, E-project-cleanup（③ Project Summaries）, D-audit-page
├── n8n/audit/                 审计页模板 audit.html 与地图边界 geo.json
├── n8n/credentials/           凭据模板（setup.sh 填入 key 后导入）
├── codex-runner/              Codex 搜索 agent 的容器（Dockerfile + server.mjs）
├── codex-runs/                每次 Codex 搜索的完整记录（含固定学术库的命中）
├── library/                   来源资料库：每条来源下载的网页/PDF 和抽出的文字
├── library-archive/           撤下的运行的资料（按 run 分文件夹）
├── archive/                   旧材料（不进 git）：v1–v5 旧工作流、旧资料库 library-old-20261012、数据库备份
├── db/                        建库脚本与表结构（管线表；web-schema.sql：网站读的 api 视图和数据库角色）
├── docker-compose.yml, .env.example, setup.sh, forget-run.sh
```
