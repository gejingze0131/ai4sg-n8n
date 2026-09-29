# Worked example template (files starting with "_" are NOT sent to the model)

Copy this file to e.g. `bd-rice-disease-app.md`, fill it with one source YOU read and extracted by hand,
and delete these instructions. Two to four real examples, covering different source types and at least one
local-language source, teach the model your conventions better than any rule.

## Source
- URL: <link>
- Type / language: <gov_report, bn>
- Excerpt the extraction relies on (paste the relevant paragraphs, original language):

> <paste>

## Expert extraction

Use exactly the JSON structure from `SKILL.md` section 2. Short version:

```json
{
  "is_ai4sg": true,
  "headline": "<who does what with AI for whom, max 20 words>",
  "source": { "title_original": "", "title_en": "", "language": "bn", "publisher": "", "published": "", "summary_en": "" },
  "project": { "name": "", "implementing_org": "", "partners": [], "funders": [], "countries": [], "location": "",
               "domain": "", "ai_technique": "", "deployment_stage": "", "target_beneficiaries": "", "evidence_refs": ["e1"] },
  "reach": { "stated": false, "number": null, "unit": "", "is_target": false, "evidence_refs": [] },
  "cost": { "stated": true, "amount": 0, "currency": "", "amount_as_written": "", "what_is_covered": "", "cost_per_beneficiary": null, "evidence_refs": ["e2"] },
  "benefit": { "stated": false, "outcome": "", "metric": "", "magnitude": "", "comparison": "", "outputs_reported": [], "evidence_refs": [] },
  "evidence_strength": { "type": "", "rationale": "" },
  "interpretation": { "cost_benefit": "", "credibility": "", "gaps": [], "overall": "<how you would summarise it>" },
  "risks_limitations": [],
  "evidence": [
    { "id": "e1", "field": "project", "quote_original": "<verbatim>", "quote_en": "<translation>" },
    { "id": "e2", "field": "cost", "quote_original": "<verbatim>", "quote_en": "<translation>" }
  ],
  "self_confidence": 0.8
}
```

## Why I read it this way (optional, very useful)
<e.g. "the 12,000 figure is registrations, not active users, so I did not treat it as reach">
