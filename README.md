# AI for Social Good · 专家 Skill 驱动的采集与解读管线（MVP）

两位专家交付两个 Skill 文件，n8n 按它们去全网搜索、提取与解读，结果放到审计页供专家核对。

```
skills/search/SKILL.md ──► B · Search（OpenAI 联网搜索，本地语言优先）
                                  │ 候选来源（去重后存入 sources 表）
skills/extraction/SKILL.md ─► C · Extract & Interpretation（下载原文 → 按专家框架提取+解读 → 核对引文）
  + skills/extraction/examples/     │ 结果（extractions 表，状态 pending_review）
                                  ▼
                     审计页 http://localhost:5678/webhook/ai4sg-audit
A · Overview 负责把以上串起来：每次运行从“运行页”开始，在运行页上选国家、语言、来源类型、最多解析多少条等。
D · Audit Page 是审计页的网页服务，常驻运行，不需要手动启动。
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

`open -e .env` 会用文本编辑器打开配置文件：在 `OPENAI_API_KEY=` 后面粘贴 key 并保存，再运行最后一行。

然后打开 http://localhost:5678 建管理员账号。之后每次运行：

- 打开运行页 http://localhost:5678/form/ai4sg-run ，选好设置，点 **Start run**；进度在 n8n 的 Executions 里看；
- 或者在 n8n 里打开 **AI4SG · A Overview** 点 **Execute workflow**，会弹出同一个运行页，提交后可以在画布上实时看到每一步。

跑完后打开 http://localhost:5678/webhook/ai4sg-audit 看结果。

运行页上的设置：

| 设置 | 含义 |
|---|---|
| Countries / Other countries | 勾选重点国家；其他国家直接填名字（在 Search Skill 国家表里的会用当地语言搜，不在的只用英语搜） |
| Search languages | 当地语言、英语，可都选 |
| Source types | 新闻、政府报告、政府网站、期刊论文、会议报告、开源代码与数据 |
| Topic focus | 可选，例如 health, agriculture |
| Published from (year) | 可选，只要这一年及之后发表的 |
| Max web searches | 最多几次联网搜索（每次 = 一个国家 × 一种语言 × 一类来源），控制费用 |
| Max results per search | 每次搜索最多返回几条候选 |
| Max sources to analyse | 本次最多解析多少条新来源（之前跑过的会跳过） |
| Relevance screen | 相关性筛选的松紧：Broad 0.4 / Balanced 0.6 / Strict 0.8 |

改了 `.env` 里的 key 之后运行 `./setup.sh --reimport`。

## 分享给其他人（用这台 Mac 当服务器）

通过 Tailscale Funnel 把这台 Mac 上的 n8n 开放到公网，固定地址形如 `https://你的Mac名.xxxx.ts.net`，免费，不用改路由器。

第一次准备：从 https://tailscale.com/download/mac 安装 Tailscale，打开并登录（Google 账号即可）。

```bash
cd ~/Projects/ai4sg-n8n
./share.sh on
```

第一次运行时，Tailscale 可能会打印一个链接，让你在网页上允许 Funnel；打开、同意后再运行一次 `./share.sh on`。
成功后会打印运行页、审计页的公网地址和页面登录密码，发给对方即可。演示结束运行 `./share.sh off`。

- 对方只用两个页面：运行页（发起一次搜索）和审计页（看结果），都要输入 `.env` 里的 `AI4SG_PAGE_USER` / `AI4SG_PAGE_PASSWORD`。
- n8n 编辑器也会在公网地址上，但需要你的 n8n 管理员账号登录，请确认这个密码足够强。
- 分享期间 Mac 要开机、联网、Docker Desktop 在运行；`share.sh on` 会阻止 Mac 自动睡眠，但合上盖子仍会睡眠（外接显示器时除外）。
- 每次有人在运行页提交都会用你的 OpenAI 额度，页面密码只发给需要的人。

## 3. 专家怎么改 Skill

- `skills/search/SKILL.md`：什么算 AI4SG、各类来源怎么搜、本地语言关键词、推荐站点。文件里的 `json countries`
  代码块是国家表（ISO 代码 + 当地语言），要让新国家用当地语言搜索就加一行。每次搜哪些国家、多少条在运行页上选，不用改这个文件。
- `skills/extraction/SKILL.md`：提取哪些字段、每个字段怎么判断、怎么写解读。新增字段直接写进去即可，会被存下并显示在审计页。
- `skills/extraction/examples/`：专家亲手做的提取样例，一篇一个 `.md` 文件，会作为示范放进提示词。复制 `_TEMPLATE.md` 开始；以 `_` 开头的文件不会发给模型。

文件保存后，下一次运行即生效，不用重启。

## 4. 审计页上的标记

| 标记 | 含义 |
|---|---|
| `quote_not_found` | 模型给的引文在原文里找不到（可能是转述或编造） |
| `cost_without_evidence` / `benefit_without_evidence` | 声称有成本/收益数字，但没有能对上的原文引文 |
| `no_text_extracted` | 原文下载失败或抽不出文字（如网站拦截、扫描版 PDF） |
| `extraction_failed` | 模型没有返回可解析的结果 |

## 5. 常用操作

| 操作 | 命令 |
|---|---|
| 看日志 | `docker compose logs -f n8n` |
| 直接查数据 | `docker compose exec postgres psql -U n8n -d ai4sg -c "select * from extractions order by id desc limit 5"` |
| 停止 / 启动 | `docker compose stop` / `docker compose up -d` |
| 备份 | `docker compose exec -T postgres pg_dumpall -U postgres > backup.sql` |

务必备份 `.env`：其中的 `N8N_ENCRYPTION_KEY` 用来加密 n8n 保存的 API key。

## 文件结构

```
ai4sg-n8n/
├── skills/                    专家交付物（接口）
│   ├── search/SKILL.md
│   └── extraction/SKILL.md, examples/
├── n8n/pipeline/              三个工作流：A-overview, B-search, C-extract-interpretation
├── n8n/credentials/           凭据模板（setup.sh 填入 key 后导入）
├── db/                        建库脚本与表结构（sources, extractions）
├── docker-compose.yml, .env.example, setup.sh
```
