# Extraction & Interpretation Skill · AI for Social Good

> Owner: the two domain experts. This whole file, followed by the experts' worked examples in
> `skills/extraction/examples/` (files starting with `_` are ignored), is given to the model together with
> the full text of one source. Edit freely; the next run uses the new version.
> The output structure in section 2 is what the audit page displays. You can add fields inside the existing
> blocks (they are stored and shown as extra rows); renaming or removing a block needs the engineer to
> update the audit page.

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
not stated. Missing information is itself a finding.

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
    "name": "<name used in the source, or a short descriptive name>",
    "implementing_org": "<who runs it>",
    "partners": ["<partner>"],
    "funders": ["<funder>"],
    "countries": ["Bangladesh"],
    "location": "<districts / states, if stated>",
    "domain": "agriculture_food",
    "ai_technique": "<what the AI concretely does>",
    "deployment_stage": "pilot",
    "target_beneficiaries": "<who is meant to benefit>",
    "evidence_refs": ["e1"]
  },
  "reach": { "stated": true, "number": 12000, "unit": "farmers registered", "is_target": false, "evidence_refs": ["e2"] },
  "cost": {
    "stated": true, "amount": 5000000, "currency": "BDT", "amount_as_written": "৫০ লক্ষ টাকা",
    "what_is_covered": "pilot budget for 2025-26, development and training",
    "cost_per_beneficiary": null, "evidence_refs": ["e3"]
  },
  "benefit": {
    "stated": false, "outcome": "", "metric": "", "magnitude": "", "comparison": "",
    "outputs_reported": ["model accuracy 92% (an output, not a benefit)"], "evidence_refs": []
  },
  "evidence_strength": { "type": "pilot_report", "rationale": "<one sentence: why this level>" },
  "interpretation": {
    "cost_benefit": "<can value for money be judged? what would be needed?>",
    "credibility": "<who makes the claims; how independent>",
    "gaps": ["<missing item the experts would want>", "<...>"],
    "overall": "<2-3 sentence expert-style reading>"
  },
  "risks_limitations": ["<problems the source itself mentions>"],
  "evidence": [
    { "id": "e1", "field": "project", "quote_original": "<verbatim sentence>", "quote_en": "<English translation>" },
    { "id": "e3", "field": "cost", "quote_original": "প্রকল্পের বাজেট ৫০ লক্ষ টাকা।", "quote_en": "The project budget is 5 million taka." }
  ],
  "self_confidence": 0.7
}
```

Rules for the structure:
- `headline`: one English sentence, max 20 words, saying who does what with AI for whom. This is the first thing a reviewer reads.
- If `is_ai4sg` is `false`: fill `headline`, `source` and `interpretation.overall` (explaining why), leave the rest empty.
- Every block with facts carries `stated` (`true`/`false`) and `evidence_refs`, the `id`s of the quotes that support it.
- `domain` is one of: `health`, `agriculture_food`, `education`, `financial_inclusion`, `social_protection`,
  `water_sanitation`, `climate_disaster`, `gender`, `public_services`, `accessibility`, `humanitarian`, `other`.
- `deployment_stage` is one of: `idea` (announced or proposed), `pilot` (limited trial), `scaled` (routine operation beyond a pilot), `discontinued`, `unknown`.
- `language` and all codes use ISO: languages ISO 639-1 (`bn`, `hi`, `id`, `th`, `en`), currencies ISO 4217.

## 3. Cost: how to read it

- Record `amount` **in the currency the source uses**; do not convert. Keep the original wording in `amount_as_written`.
  Expand local number words: 1 lakh = 100,000; 1 crore = 10,000,000 (BDT/INR); Indonesian "miliar" = 1,000,000,000; "juta" = 1,000,000.
- `what_is_covered` must say what the money pays for and over what period: development only? a pilot?
  annual operating cost? a grant ceiling? Budgeted/allocated or actually spent?
- `cost_per_beneficiary`: fill only if the source states it, or if it follows directly from two numbers the
  source gives for the same scope and period; explain the arithmetic in `interpretation.cost_benefit`.
- If no cost figure is given: `"stated": false`, other cost fields empty. Do not estimate.

## 4. Benefit: how to read it

- `outcome`: the change in people's lives or in service delivery the source claims (e.g. "diagnosis time",
  "crop loss", "attendance", "stunting"), not the technical output (e.g. "model accuracy").
- `metric` and `magnitude`: how it was measured and by how much, with units ("average yield, +14% vs previous season").
- Model accuracy, number of downloads or number of users are **outputs**, not benefits: list them in
  `outputs_reported`; set `benefit.stated` to `false` if they are the only "results".
- `comparison`: the counterfactual or baseline used (control group, before/after, comparison district, none).
- `reach`: people or units actually reached. If the source only gives a target ("aims to reach"), set `is_target: true`.

## 5. Evidence strength (the strongest the source reports for the benefit)

| `type` | Use when |
|---|---|
| `rct` | randomised controlled trial with a control group |
| `quasi_experimental` | comparison group without randomisation (difference-in-differences, matched districts, regression discontinuity) |
| `observational` | before/after or correlational numbers without a credible comparison group |
| `pilot_report` | implementer's own report of a pilot, mainly activities and outputs |
| `anecdotal` | testimonials, single cases, claims without numbers |
| `none` | no evidence of benefit given |

## 6. Interpretation: the experts' reading

- `cost_benefit`: can a cost per beneficiary or per outcome be worked out? Is the benefit plausibly large relative to the cost? What would be needed to judge value for money?
- `credibility`: who is making the claims (implementer, funder, independent evaluator, journalist)? Treat press releases and launch announcements as claims, not results.
- `gaps`: short list of what is missing that the experts would want (costs, a comparison group, uptake, sustainability after donor funding).
- `overall`: 2–3 sentences, written as our experts would summarise the case.

<!-- EXPERTS: add your own priors here, e.g. benchmarks you compare against, red flags you look for,
     how you weigh government vs NGO sources. The more specific, the closer the model gets to your judgement. -->

## 7. Quotes

- Give each quote an `id` (`e1`, `e2` …) and the block it supports in `field` (`project`, `reach`, `cost`, `benefit`, `evidence_strength`, `risks_limitations`).
- Every block with `"stated": true` needs at least one quote, referenced in its `evidence_refs`.
- `quote_original` must be **copied character-for-character** from the source text as given to you, in the
  original script (Bengali, Devanagari, Thai …), 1–2 sentences, no ellipses, no reformatting of numbers.
  The pipeline checks that the quote appears in the source; paraphrases are flagged as unverified.
- `quote_en` is a faithful English translation (repeat the quote if it is already English). Translate numbers
  exactly as written; do not add explanations inside the translation.

## 8. Self-confidence

- 0.9–1.0: all key fields stated explicitly and quoted.
- 0.6–0.8: main facts stated, but cost or benefit missing or ambiguous.
- 0.3–0.5: source is thin (announcement, short news item) or partly off-topic.
- below 0.3: probably not AI4SG, or the text was unreadable / truncated.
