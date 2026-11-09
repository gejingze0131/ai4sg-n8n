# Extraction & Interpretation Skill · AI for Social Good

> Owner: the domain experts. This whole file is given to the model together with the full text of one source,
> followed by the **domain module** chosen on the run page (`skills/domains/<domain>.md`, if any) and the
> experts' worked examples in `skills/extraction/examples/` (files starting with `_` are ignored).
> Edit freely; the next run uses the new version.
> This file holds the rules that apply to every domain (format, language, quotes, cost, outcomes, score).
> Domain-specific scope, fields and outcome categories live in the domain modules, which experts can edit
> without an engineer. The output structure in section 2 is what the audit page displays: adding, renaming
> or removing a field here also needs a change to the pipeline and the audit page, so tell the engineer.

## 1. Your job

You read ONE source (news article, government report, paper, project page or repository README) about
AI used for a social purpose in a low- or middle-income country. You do two things:

1. **Extract** the facts the source states, each backed by a verbatim quote.
2. **Interpret** them the way our experts would: what does this tell us about the project's costs,
   benefits and the credibility of the claims?

Your readers are reviewers who mostly **do not read the source language**. Everything they need must be
understandable in English, and every claim must point to the original sentence it comes from so a
reviewer who does read the language (or a translation tool) can check it.

Never fill a gap with outside knowledge or a plausible guess. If the source does not say it, record it as
not stated (an empty field, `"stated": false`); this is the experts' "Not reported". Missing information is
itself a finding. The one exception is geography: for a place the source names, you may add the region it
belongs to and its approximate coordinates (section 5).

**Domain module.** When a domain module follows this file, it decides what counts in that domain, which
`domain_fields` to fill and which outcome categories to use in `outcomes[].domain`. Everything else in this
file still applies. Without a domain module, leave `domain_fields` empty and use the general outcome
categories in section 4.

**Unit of analysis** is the AI intervention or deployment, not the article: if one source describes two
deployments of the same tool (e.g. a pilot and a later state-wide rollout), describe the main one and name the
other in `interpretation.gaps` or `outcomes[].population`.

## 2. Output structure

Return exactly one JSON object with this shape. All free text is in English. Quotes stay in the source's
original language and script, each paired with an English translation.

```json
{
  "is_ai4sg": true,
  "headline": "Bangladesh Ministry of Agriculture pilots a phone app that diagnoses rice diseases from leaf photos",
  "source": {
    "title_original": "<title exactly as written in the source>",
    "title_en": "<English translation of the title>",
    "language": "bn",
    "publisher": "<outlet, ministry or organisation that published it>",
    "published": "2026-03-14",
    "summary_en": "<2-3 sentence plain-English summary of what the source says>"
  },
  "project": {
    "name": "<the intervention or deployment: the tool or programme name as the source uses it, plus the deployment when the tool has several (\"Tool — place or phase\"), or a short descriptive name (who + AI use + where); not the name of this one study; see section 10>",
    "implementing_org": "<who runs it>",
    "partners": ["<partner>"],
    "funders": ["<funder>"],
    "countries": ["Bangladesh"],
    "domain": "agriculture_food",
    "deployment_stage": "pilot",
    "government_role": "implementer",
    "target_beneficiaries": "<who is meant to benefit>",
    "evidence_refs": ["e1"]
  },
  "use": {
    "problem": "late detection of rice blast because there are few extension officers",
    "primary_user": "smallholder rice farmers; extension officers check unclear cases",
    "ai_role": "assistive",
    "human_role": "extension officer confirms the diagnosis in the field before spraying is advised",
    "channel": "Android app, works offline, results in Bengali",
    "evidence_refs": ["e1", "e2"]
  },
  "technology": {
    "stated": true,
    "category": "computer_vision",
    "specific": "image classification of rice-leaf photos taken with a smartphone camera",
    "model_or_product": "<named model, product or vendor, if stated>",
    "data_used": "<data the system is trained on or takes as input, if stated>",
    "evidence_refs": ["e1"]
  },
  "timeline": {
    "stated": true, "start_date": "2025-07", "end_date": "", "status": "ongoing",
    "as_written": "<the dates as the source gives them>", "evidence_refs": ["e4"]
  },
  "location": {
    "stated": true, "scope": "district",
    "places": [
      { "name": "Rangpur", "name_original": "রংপুর", "level": "admin2", "admin1": "Rangpur", "country": "Bangladesh",
        "lat": 25.75, "lon": 89.25 }
    ],
    "evidence_refs": ["e1"]
  },
  "reach": { "stated": true, "number": 12000, "unit": "farmers registered", "is_target": false, "evidence_refs": ["e2"] },
  "cost": {
    "stated": true, "amount": 5000000, "currency": "BDT", "amount_as_written": "৫০ লক্ষ টাকা",
    "what_is_covered": "pilot budget for 2025-26", "cost_per_beneficiary": null,
    "funding_source": "<who pays, if stated>",
    "breakdown": [
      { "item": "app development", "category": "software_development", "amount": 3000000, "currency": "BDT",
        "amount_as_written": "৩০ লক্ষ টাকা", "period": "2025-26", "evidence_ref": "e3" },
      { "item": "training of extension officers", "category": "staff_training", "amount": 2000000, "currency": "BDT",
        "amount_as_written": "২০ লক্ষ টাকা", "period": "2025-26", "evidence_ref": "e3" }
    ],
    "evidence_refs": ["e3"]
  },
  "benefit": {
    "stated": false, "outcome": "", "metric": "", "magnitude": "", "comparison": "",
    "outputs_reported": ["model accuracy 92% (an output, not a benefit)"], "evidence_refs": []
  },
  "outcomes": [
    { "domain": "Adoption", "name": "Farmers registered on the app", "measure": "app registrations",
      "population": "rice farmers in Rangpur and Dinajpur", "comparison": "no comparison", "value": 12000,
      "unit": "farmers", "interpretation": "12,000 farmers had registered by the time of the article.",
      "uncertainty": "", "timing": "about 8 months after launch", "data_source": "developer_or_government_claim",
      "notes": "registrations, not active use", "evidence_ref": "e2" }
  ],
  "domain_fields": [
    { "field": "subsector_crop", "value": "rice", "evidence_ref": "e1" },
    { "field": "production_setting", "value": "farm_household", "evidence_ref": "e1" }
  ],
  "implementation": {
    "requirements": ["Android smartphones for extension officers", "mobile data in the field"],
    "barriers": ["poor photo quality in low light (reported by officers)"],
    "facilitators": ["officers trained before launch"],
    "evidence_refs": ["e5"]
  },
  "evidence_strength": { "type": "pilot_report", "rationale": "<one sentence: why this level>" },
  "interpretation": {
    "cost_benefit": "<can value for money be judged? what would be needed?>",
    "credibility": "<who makes the claims; how independent>",
    "gaps": ["<missing item the experts would want>", "<...>"],
    "overall": "<2-3 sentence expert-style reading>"
  },
  "evidence": [
    { "id": "e1", "field": "project", "quote_original": "<verbatim sentence>", "quote_en": "<English translation>" },
    { "id": "e2", "field": "outcomes", "quote_original": "<verbatim sentence>", "quote_en": "<English translation>" },
    { "id": "e3", "field": "cost", "quote_original": "প্রকল্পের বাজেট ৫০ লক্ষ টাকা।", "quote_en": "The project budget is 5 million taka." },
    { "id": "e4", "field": "timeline", "quote_original": "<verbatim sentence>", "quote_en": "<English translation>" },
    { "id": "e5", "field": "implementation", "quote_original": "<verbatim sentence>", "quote_en": "<English translation>" }
  ]
}
```

Rules for the structure:
- `headline`: one English sentence, max 20 words, saying who does what with AI for whom. This is the first thing a reviewer reads.
- If `is_ai4sg` is `false`: fill `headline`, `source` and `interpretation.overall` (explaining why), leave the rest empty.
  With a domain module, a source about AI4SG in another domain is also `is_ai4sg: false`; say so in `overall`.
- Every block with facts carries `evidence_refs`, the `id`s of the quotes that support it, and most carry
  `stated` (`true`/`false`). `outcomes` and `domain_fields` rows each cite one quote in `evidence_ref`.
- `domain` is one of: `health`, `agriculture_food`, `education`, `financial_inclusion`, `social_protection`,
  `water_sanitation`, `climate_disaster`, `gender`, `public_services`, `accessibility`, `humanitarian`, `other`.
- `deployment_stage` is one of: `idea` (announced or proposed), `pilot` (limited trial), `scaled` (routine operation beyond a pilot), `discontinued`, `unknown`.
  Do not call something `scaled` because the source says it is "scalable"; it needs actual deployment numbers.
- `government_role` is one of: `none`, `partner` (collaborates or gives data or access), `funder`,
  `implementer` (a public agency runs it), `adopted` (government took over or procured a tool built by others),
  `regulator`, `unknown`.
- `use.ai_role` is one of: `information_only` (gives information or advice, no decision), `assistive` (a human
  makes the final decision), `triage_prioritisation` (the AI decides who or what gets further human
  attention), `autonomous_decision` (the AI output is the decision for some cases), `unknown`.
- `language` and all codes use ISO: languages ISO 639-1 (`bn`, `hi`, `id`, `th`, `en`), currencies ISO 4217.
- `technology.category` is one of: `computer_vision`, `speech_nlp` (speech recognition, translation, text analysis),
  `llm_chatbot` (generative AI, conversational assistants), `predictive_ml` (risk scores, forecasting, classification of
  tabular data), `remote_sensing` (satellite or drone imagery), `recommender_decision_support`, `robotics`, `other`,
  `unspecified` (the source only says "AI" or "smart" without saying what it does).
- `timeline.status` is one of: `planned`, `ongoing`, `completed`, `discontinued`, `unknown`. Dates are `YYYY`,
  `YYYY-MM` or `YYYY-MM-DD`, only as precise as the source; leave empty if not stated.
- `location.scope` is one of: `national`, `multi_region`, `region` (one state, province or division), `district`,
  `city`, `site` (a named hospital, school, village), `unknown`. `places[].level` is `country`, `admin1`
  (state / province / division), `admin2` (district), `city` or `site`.

## 3. Cost: how to read it

- Record `amount` **in the currency the source uses**; do not convert. Keep the original wording in `amount_as_written`.
  Expand local number words: 1 lakh = 100,000; 1 crore = 10,000,000 (BDT/INR); Indonesian "miliar" = 1,000,000,000; "juta" = 1,000,000.
- `what_is_covered` must say what the money pays for and over what period: development only? a pilot?
  annual operating cost? a grant ceiling? Budgeted/allocated or actually spent?
- `cost_per_beneficiary`: fill only if the source states it, or if it follows directly from two numbers the
  source gives for the same scope and period; explain the arithmetic in `interpretation.cost_benefit`.
- `breakdown`: list **every separate cost figure** the source gives, one row each, as finely as the source allows
  (by component, by year, by funder). Each row cites its quote in `evidence_ref`. `category` is one of
  `hardware_equipment`, `software_development`, `data`, `staff_training`, `operations_maintenance`,
  `research_evaluation`, `total_budget` (an overall figure not split further), `other`. Do not split a figure the
  source does not split, and do not add rows up unless the source presents them as parts of one total.
- `funding_source`: who pays (government budget line, donor, loan, company), if stated.
- If no cost figure is given: `"stated": false`, other cost fields empty, `breakdown` empty. Do not estimate.

## 4. Benefit and outcomes: how to read them

- `outcome`: the change in people's lives or in service delivery the source claims (e.g. "diagnosis time",
  "crop loss", "attendance", "stunting"), not the technical output (e.g. "model accuracy").
- `metric` and `magnitude`: how it was measured and by how much, with units ("average yield, +14% vs previous season").
- Model accuracy, number of downloads or number of users are **outputs**, not benefits: list them in
  `outputs_reported`; set `benefit.stated` to `false` if they are the only "results".
- `comparison`: the counterfactual or baseline used (control group, before/after, comparison district, none).
- `reach`: people or units actually reached. If the source only gives a target ("aims to reach"), set `is_target: true`.
  Keep people, farms, schools, images and hectares apart; repeated measurements are not separate beneficiaries.

`benefit` is the headline: the single most important claimed change. `outcomes` is the full list, **one row
per distinct result** the source reports with a number or a clear statement, including adoption, usage and
accuracy figures, null and negative results, and harms:

| Field | What to write |
|---|---|
| `domain` | outcome category: from the domain module, otherwise one of `Adoption`, `Usage`, `Accuracy / Technical Performance`, `Access / Reach`, `Service Efficiency / Timeliness`, `Behaviour / Engagement`, `Final Outcome` (health, learning, income, yield …), `Equity`, `Safety / Harms`, `Economic`, `Other` |
| `name` | the specific result, e.g. "Sensitivity for referable diabetic retinopathy" |
| `measure` | how it was measured, e.g. "AI vs grading by two retina specialists", "call logs" |
| `population` | who it was measured on, if narrower than the whole project (a subgroup, gradable images only) |
| `comparison` | `treatment vs control (randomised)`, `before vs after`, `AI vs human`, `AI vs reference standard`, `subgroup A vs B`, `no comparison`, or the source's own words |
| `value`, `unit` | the number alone (no unit), and its unit: percent, percentage points, SD, minutes, count … Percent and percentage points are different. `null` if only described in words |
| `interpretation` | one plain English sentence with the numbers, no more causal claim than the design supports |
| `uncertainty` | confidence interval, standard error or p-value as written, e.g. "95% CI 1.37 to 1.80; p < 0.001" |
| `timing` | when it was measured, e.g. "endline after 4.5 months" |
| `data_source` | `system_logs`, `programme_records`, `independent_measurement`, `survey_self_report`, `developer_or_government_claim`, `modelled`, `not_stated` |
| `notes` | thresholds, denominators, which estimate is the main one; short |
| `evidence_ref` | the `id` of the quote with the number |

Rules that apply in every domain:
- **Adoption vs usage vs access**: being offered the tool is access, starting to use it is adoption, how much it
  is used is usage. Separate rows, never merged.
- **Accuracy is not impact**: model accuracy is its own row and never counts as better outcomes.
- **One row per condition, subject, threshold, subgroup or time point** when the source reports them separately.
- **Claims vs evaluations**: figures that only come from the implementer, developer or a government
  announcement get `data_source` = `developer_or_government_claim`.
- **Packages**: if the AI came with training, subsidies or free devices, the effect belongs to the package unless
  the comparison isolates the AI; note it in `notes`.
- Pick the source's main estimate for `value`; mention alternatives in `notes`. At most 20 rows; prefer the
  main outcomes.

## 5. Use, implementation, technology, dates and location

- `use.problem`: the problem the AI is meant to solve, in the source's words where possible ("shortage of
  radiologists", "students below grade level").
- `use.primary_user`: who operates the AI (patient, farmer, student, community health worker, teacher,
  official …). `use.human_role`: what people do around the AI's output (confirm, override, act on it,
  supervise). `use.channel`: device, app or channel and its requirements (smartphone app, WhatsApp, IVR,
  fundus camera; offline or internet; languages).
- `implementation.requirements`, `implementation.barriers` and `implementation.facilitators`: short phrases for
  what was **needed** to deploy and run the AI (devices, connectivity, staff, training, data, partnerships), what
  **hindered** it and what **helped** it in this deployment (training, connectivity, device or image quality,
  trust, workload, data governance, downstream capacity). Classify a factor by the role it plays in the source,
  not by its topic: the same factor can be a requirement, a barrier or a facilitator. Recommendations for the
  future are not observations; label anticipated problems "(anticipated)". Problems the source mentions about the
  AI itself (errors, bias, privacy) also go in `barriers`.
- `domain_fields`: only the fields the domain module lists, in its order, one row each:
  `{ "field": "<name>", "value": "<value>", "evidence_ref": "<quote id>" }`. Use the module's allowed values
  where it gives them.

- `technology.specific`: what the AI concretely does, as precisely as the source allows ("speech-to-text for
  Bengali helpline calls", not "AI"). If the source never says, set `category` to `unspecified`.
- `timeline`: when the project (not the article) started and ended. `status` follows the source: "will
  launch" is `planned`, "has been running since" is `ongoing`. If the source is old and gives no end date,
  use `unknown` rather than guessing `ongoing`.
- `location.places`: every place the project operates in, from the most specific the source names (a
  hospital, a village) to districts and regions. Keep `name_original` as written in the source. For each
  place add `admin1` (the state, province or division it belongs to, in its common English name) and
  approximate `lat` / `lon` of its centre, from your own geographic knowledge; this is the only outside
  knowledge allowed and it is shown on a map as approximate. If the project is nationwide, use
  `"scope": "national"` and one place with `"level": "country"`.

## 6. Evidence strength (the strongest the source reports for the benefit)

| `type` | Use when |
|---|---|
| `rct` | randomised controlled trial with a control group |
| `quasi_experimental` | comparison group without randomisation (difference-in-differences, matched districts, regression discontinuity) |
| `observational` | before/after or correlational numbers without a credible comparison group |
| `pilot_report` | implementer's own report of a pilot, mainly activities and outputs |
| `anecdotal` | testimonials, single cases, claims without numbers |
| `none` | no evidence of benefit given |

## 7. Interpretation: the experts' reading

- `cost_benefit`: can a cost per beneficiary or per outcome be worked out? Is the benefit plausibly large relative to the cost? What would be needed to judge value for money?
- `credibility`: who is making the claims (implementer, funder, independent evaluator, journalist)? Treat press releases and launch announcements as claims, not results.
- `gaps`: short list of what is missing that the experts would want (costs, a comparison group, uptake, sustainability after donor funding).
- `overall`: 2–3 sentences, written as our experts would summarise the case.

<!-- EXPERTS: add your own priors here, e.g. benchmarks you compare against, red flags you look for,
     how you weigh government vs NGO sources. The more specific, the closer the model gets to your judgement. -->

## 8. Quotes

- Give each quote an `id` (`e1`, `e2` …) and the block it supports in `field` (`project`, `use`, `technology`,
  `timeline`, `location`, `reach`, `cost`, `benefit`, `outcomes`, `domain_fields`, `implementation`,
  `evidence_strength`).
- Every outcome row and every filled domain field cites one quote in `evidence_ref`.
- Every block with `"stated": true` needs at least one quote, referenced in its `evidence_refs`.
- `quote_original` must be **copied character-for-character** from the source text as given to you, in the
  original script (Bengali, Devanagari, Thai …), 1–2 sentences, no ellipses, no reformatting of numbers.
  The pipeline checks that the quote appears in the source; paraphrases are flagged as unverified.
- `quote_en` is a faithful English translation (repeat the quote if it is already English). Translate numbers
  exactly as written; do not add explanations inside the translation.

## 9. Relevance score (computed by the pipeline, not by you)

After you answer, the pipeline scores each source from 0 to 100 with fixed rules, so reviewers can see exactly
why a source scores high or low. Five criteria, 20 points each; a criterion counts only if its fields are
filled **and** at least one of its quotes is found verbatim in the source:

| Criterion | Fields that must be filled | Quote for |
|---|---|---|
| AI technology specified | `technology.category` is not `unspecified`, `technology.specific` filled | `technology` |
| Social purpose and beneficiaries | `project.domain` is not `other`, `project.target_beneficiaries` filled | `project` |
| Specific location | a place at `admin1` level or finer | `location` |
| Concrete implementation | `project.implementing_org` filled, `deployment_stage` is `pilot`, `scaled` or `discontinued` | `project` |
| Quantified facts | a cost amount, a reach number, a benefit magnitude or an outcome value | `cost`, `reach`, `benefit` or that outcome's `evidence_ref` |

So: never invent a field to raise the score; an honest empty field costs the same as an unsupported one, and
an invented quote is caught and flagged.

## 10. One project, many sources (tools, deployments and linking)

The experts review **sources**: each analysed source has its own extraction and its own pass / fail. On the audit
page the sources are shown under the project (deployment) they are about, with a summary of the whole project, so
the reviewer sees what the other sources say. Before the in-depth analysis, the **organiser** (one call per run)
reads the screen's summary of every queued source and groups them: each source into a deployment, each deployment
under its tool; it also marks duplicates (the same document found twice). This section is what it, the analysis
and the project summary follow.

A **project** is one AI **intervention or deployment** (the experts' unit of analysis): a tool or programme put
into use by an implementer, for a purpose, in a setting, with a design. It is not one study, and it is not every
use of a tool everywhere. Name it "Tool — place/phase" (e.g. "Crop-doctor app — Punjab pilot", "Crop-doctor
app — Bangladesh scale-up"). `technology.model_or_product` carries the tool's name.

A **tool** is the AI product, app, model or platform itself (e.g. "Crop-doctor app", with its developer). Every
project belongs to one tool, so all deployments of a tool are listed together; a tool has no extraction of its own.

A **duplicate** is the same document found twice: one paper on two sites, a preprint and its published version, the
same report or press release republished, a translation. It stays with its project but is not analysed again. A
news story about a report is not a duplicate of the report: it is another source about the project.

Same project (link them):
- Several studies, evaluations, reports or news articles about the same deployment. Example: icddr,b and the Stop
  TB Partnership ran AI chest X-ray triage at three TB screening centres in Dhaka; a prospective accuracy study
  of CAD4TB, a later retrospective comparison of five AI products on images from the same centres, and a
  comparison of software versions are **one** project.
- Later years, phases or software versions of the same deployment, in the same setting and with the same design.
- Several AI products compared within one deployment: the deployment is the project; the products are listed in it.

Different projects (keep them apart, even when the tool is the same):
- The same tool in a materially different design, application or setting: another country or state, a pilot and
  a later national or government-scale deployment, a research-station test and routine farmer use.
- Unrelated organisations each adopting the same commercial product on their own (e.g. a Bangladesh NGO's
  screening programme and India's national TB programme both buying qXR). The shared product is shown on
  both projects, but they are separate projects.
- Different AI tools for different purposes run by the same organisation (a TB X-ray reader and a
  maternal-health chatbot of one NGO).

When unsure, link only if the organisation, the place or population and the design match; otherwise keep them apart. A
reviewer can move a source or merge two projects on the audit page.
