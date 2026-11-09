# AI4SG Pipeline · User Guide for Experts

This system searches the web, in local languages and English, for AI for Social Good (AI4SG) projects in
developing countries, then extracts and interprets each source the way you would. You shape it in two ways:
you **write the instructions the AI follows** (two "skill" files plus worked examples), and you **audit its
results** on a web page.

## 1. Access

For now, the system can be tried at **https://gemacbook-air.tail2851f0.ts.net**. It runs on a laptop, so it
is online during agreed trial sessions.

| Page | Address | Used for |
|---|---|---|
| Run page | https://gemacbook-air.tail2851f0.ts.net/form/ai4sg-run | Start a search |
| Audit page | https://gemacbook-air.tail2851f0.ts.net/webhook/ai4sg-audit | Review results |

No login is needed: open the links in any browser.

## 2. How the pipeline works

The pipeline is built in n8n, a visual workflow tool. Each box is one step, and data flows left to right.

![Workflow A: the overview](img/overview.png)

1. **Run page → Plan Search Tasks**: each country × language × source type you chose becomes one search
   task, e.g. *Bangladesh × Bengali × News*. If you chose a domain, every task also follows that domain's module.
2. **B · Search**: for each task, an AI agent searches following the **Search Skill**. For English journal and
   conference tasks (and, where the domain lists them, report tasks) it first receives every hit from the domain's fixed
   databases (OpenAlex, Europe PMC, ERIC, World Bank Documents & Reports, AEA RCT Registry) and
   screens them. It reads each source lightly, follows references, citing papers and reports named in news
   **one level** further, and returns **every** qualifying source.
3. **Save Candidates**: keeps every new candidate; nothing is cut. A source with the same URL, DOI or title as an
   earlier one is skipped; other versions of the same paper (preprint, repository copy) are kept as extra downloads.
4. **Collect Materials**: downloads what a reader or auditor needs (the page or PDF, the full-text PDF,
   appendices, the report a news story is based on; never datasets) into the source library, with its text.
5. **C1 · Screen**: a quick relevance screen (GPT-6 Luna) of every new source against the definition of AI4SG
   and the domain. Sources that fail are set aside, with the reason.
6. **Organise → C2**: GPT-6 Sol reads the screen's short card of every queued source (title, authors, organisation,
   kind of source, the intervention, key figures from real use, evidence type, a summary), together with the projects
   and tools already known, and organises them in one call per run:
   - each source goes into a **project**, which is one deployment of an AI tool, named "Tool — place/phase" (e.g.
     "Crop-doctor app — Punjab pilot"); each project belongs to a **tool** (T-00003), so all deployments of a tool are
     listed together;
   - **duplicates** (the same document found twice: another address, a preprint and the published paper, a republished
     report) are marked and kept with the project, but not analysed;
   - known projects that turn out to be the same deployment are merged;
   - with *Max sources to analyse in depth* set and more queued sources than that, it chooses which to analyse: as many
     different deployments as possible, for each the source with the most first-hand facts about real use, then
     stronger evidence and full text when otherwise similar. Each choice and each source left out gets a one-line
     reason. Left empty, every source that is not a duplicate is analysed.
   The rest wait as *Queued*, already placed in their project; the next run of the domain organises the whole queue
   again, and you can send any of them to the analysis from the audit page (*Not analysed yet*).

![Workflow C2: extract, interpret and link to a project](img/extract.png)

C2 reads the source's text from the library and runs the detailed **extraction and interpretation** (GPT-6 Sol)
that follows the **Extraction Skill**, the domain module and your worked examples. Every fact must cite a quote
from the source, and **Verify Evidence** checks by code that each quote really appears in the text. The project
the organiser placed the source in is given to the AI as background, so the project is named consistently; a source
that was not organised (e.g. one you send to the analysis yourself) is linked to a project at this point. A project
is one deployment, not one study: several papers, reports and news stories about the same deployment share one
project, while the same tool in another state or country, or a later national scale-up, is another project of the
same tool. The definition is section 10 of the Extraction Skill ("One project, many sources"), so you can refine it.

7. **C3 · Project Synthesis** merges all sources of a project into one project record: every outcome, reach
   figure, cost and place keeps the source it came from (S12), and when there are several sources the AI writes
   a project summary (what the evidence shows, where sources agree or disagree, what is missing).
8. **③ Project Summaries** (end of every run) re-summarises the projects that got new sources. Grouping and
   duplicates are handled before the analysis (step 6), so there is no clean-up afterwards.

## 3. Running a search

Open the run page, adjust the settings and click **Start run**. After about 10 to 30 minutes, new results
appear on the audit page. Each run uses paid API credits, so start small (e.g. 6 searches, 10 sources).

| Setting | Meaning |
|---|---|
| Domain | All domains, or Healthcare, Public service, Agriculture or Education: applies that domain's rules for what counts, where to search, and which fields and outcomes to extract |
| Countries / Other countries | Tick focus countries or type others, e.g. `Vietnam, Nepal` |
| Search languages | Local language, English, or both |
| Source types | News, government reports (PDF), government websites, journal papers, conference reports, open-source code & data |
| Topic focus, Published from (year) | Optional, e.g. `tuberculosis`, `2022` |
| Max web searches | Upper limit on search tasks (each is one country × language × source type) |
| Results per search (target) | How many sources each search should aim for; more are kept if they qualify |
| Max sources to analyse in depth | The analysis budget of this run: GPT-6 Sol chooses that many from the queue; the others wait as Queued (already grouped into their projects). Empty = analyse every source that passes the screen (except duplicates) |
| Relevance screen | How strict the first screen is: Broad 0.4, Balanced 0.6, Strict 0.8 |

## 4. Reviewing results on the audit page

![The audit page](img/audit.png)

Each card on the left is one **project** (one deployment of an AI tool) with all its sources; you **review each source**.
Open a project to see its tool, its summary and the list of its sources (analysed, queued and duplicates), then open a
source to review it. A project with only one source opens straight on that source's page. A project shows how many of its
analysed sources have been reviewed; ✓ when all passed, ✗ when one failed.

- **Top row and charts**: sources awaiting review, passed, failed; projects with outcome data; sources analysed, queued and
  filtered out; charts of projects by country and AI technology (click to filter), best relevance score,
  deployment stage and strength of evidence.
- **Runs**: for each run, how many sources were found, unique, new, reached by following leads, downloaded,
  passed the screen, analysed (some from the queue), still queued, and how many new projects appeared.
- **Domain tags**: every item carries coloured tags for the domains it actually belongs to (set by the screen; one item can
  have several, e.g. a farmers' scheme chatbot is Public service and Agriculture). The *Domain* buttons at the top limit the
  whole page (list, numbers, charts, *Not analysed yet*) to items with that tag.
- **Filters**: search, country, technology, status (*Awaiting review*, *All*, *Passed*, *Failed*, *Needs attention*)
  and sorting (newest, oldest, relevance score, domain, country, name). Sources not analysed are in *Not analysed yet* at the bottom.
  The search box also finds a project code such as `P-00012`.
- **Project pane**: the tool (with links to its other deployments), the place and phase, the project summary, the list of
  its **sources** (S12 …, with type, strength of evidence, whether the full text or only the abstract was read, score, your
  review, and how it was grouped; queued sources and duplicates are listed too), then the merged facts: organisations,
  AI technology and products, timeline across all sources, a map of all places, use, the domain fields, reach,
  cost, the strongest evidence, and **Outcomes from all sources** (each row names its source; expand it for the
  quote). **Merge into P-…** joins two projects that are the same. Every S12 tag opens that source.
- **Source page** (open a source from its project): the source's own extraction, as before: headline, original title with translation and a summary, then **Relevance score**, **AI
  technology**, **Timeline** (start, end, ongoing or not), **Location** (a map shading the regions named and
  marking specific places), **Cost** with a breakdown table, **Benefit**, **Reach**, **Strength of evidence**,
  **How it is used** (problem, user, the AI's role, the people around it), the domain's own fields,
  **Implementation** (barriers, facilitators), **Outcomes** (one row per result, with "Claim" marking figures
  that come only from the developer or a government announcement), the project, the interpretation, all quotes,
  and **Source and project**: the project with its other sources (**Not this project** or **Move to P-…** if
  the link is wrong), how the source was found (database, or the source that led to it), and **Local copies**
  of the downloaded files, which open even if the original site is down. Each card shows whether its quote was found in the source;
  expand it to see the original next to the English. **Open source ↗** opens the original page.
- **Relevance score (0 to 100)** is computed by fixed rules, not by the AI: five criteria of 20 points
  (AI technology specified, social purpose and beneficiaries, specific location, concrete implementation,
  quantified facts), each counted only when backed by a quote found word for word in the source.
- **Pass / Fail**: type your name once at the top of the page, then use the buttons at the bottom of each
  **source** page, with an optional comment. Decisions are saved and can be changed later. *Awaiting review* lists the
  projects that still have an analysed source without a decision. (Decisions made on whole projects before this change
  are still shown on the project page.)
- **Not analysed yet** (bottom of the page): every source without an in-depth analysis, grouped by the reason: waiting in
  the queue (passed the screen but not chosen within the analysis budget; the selection's reason is shown), duplicates (the same
  document as another source, which is named), set aside by the
  screen (with the AI's reason), could not be downloaded (with the error), not screened yet, and, for spot-checks, sources the
  analysis judged not AI4SG. Open any of them to read it; if it is worth analysing, click **Analyse** (or tick several and
  **Analyse selected**, up to 30). A source without text is downloaded first. Each takes about a minute; reload the page to see
  the result and the updated project.

**Flags**: `quote_not_found` (a quote is not in the source text), `cost_without_evidence` /
`benefit_without_evidence` / `outcome_without_evidence` (a figure with no matching quote), `no_text_extracted` (page or PDF unreadable),
`extraction_failed` (no usable AI result), `abstract_only` (only the abstract could be read).

Please also open **Set aside by the screen** (under *Not analysed yet*) now and then: if relevant sources appear there, the screen is too
strict or the AI4SG definition in the Search Skill needs refining. A case you corrected by hand also makes a
good worked example (section 5).

## 5. Your inputs: skills and worked examples

A *skill* is a plain-text Markdown file that the AI reads as its instructions, word for word. Your inputs
live in three places:

```
skills/
├── search/SKILL.md        rules for every domain: what counts as AI4SG, how to search, local keywords, countries
├── extraction/
│   ├── SKILL.md           rules for every domain: format, language, quotes, cost, outcomes, interpretation
│   └── examples/          one .md per source you extracted by hand (start from _TEMPLATE.md)
└── domains/               one module per domain: healthcare.md, public_service.md, agriculture.md, education.md
```

- **Domain modules** hold what is specific to a domain: what counts, search terms and sources, four domain
  fields and the outcome categories. They were written from your Word and Excel rules (kept in
  `expert-input/`), with the 32–36 columns reduced to a shared core plus four domain fields;
  `skills/domains/README.md` shows where each of your columns went.

- **Editing a skill**: change the text freely; it is written for a human reader as much as for the AI. In
  the Search Skill, keep the `json countries` block valid JSON (add a line there to search a new country in
  its own language). In the Extraction Skill, keep the field names in section 2. If you want a new field,
  let us know so the output format can be extended.
- **Adding worked examples**: copy `_TEMPLATE.md` to a new name such as `agriculture-bd-rice-app.md` (the domain
  prefix means it is used only in runs of that domain) and fill in
  the source excerpt, your extraction and, most usefully, *why you read it that way*. Two to four examples
  covering different source types, with at least one local-language source, teach the model your
  conventions better than more rules. Files whose names start with `_` are not sent to the AI.
- **Submitting**: email us the new or edited files. Once they are placed in these folders, the next run
  uses them; nothing needs restarting.



1. 导师的意见如下：In audit page:
   1. Technology the project is using.(具体的AI技术）
   2. Start date, end date, whether ongoing
   3. Location(area and specific，最好能画个小地图标出地点，如果是地区则涂色)
   4. Cost should be broken down as much as possible
   5. 最后有一个反馈按钮，是否通过审计，还是不通过
   6. 不需要黑色背景，字体稍微大一点，更清晰一些；
   7. 然后关于你定义的confidence，是如何计算的？最好是个明确可计算的指标而不是你根据文本直接生成的。最好不叫做confidence，叫做相关性打分。

Next step:

1. manully audit a lot of examples
1. 3~5 golden examples in skills

30~50 golden examples overall, and train a aggregation machine learning algorithm to indentify which one is closer.
