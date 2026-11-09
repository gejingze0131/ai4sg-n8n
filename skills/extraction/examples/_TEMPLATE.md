# Worked example template (files starting with "_" are NOT sent to the model)

Copy this file to e.g. `agriculture-bd-rice-disease-app.md`, fill it with one source YOU read and extracted by
hand, and delete these instructions. Two to four real examples per domain, covering different source types and
at least one local-language source, teach the model your conventions better than any rule.

Start the file name with the domain (`healthcare-`, `public_service-`, `agriculture-`, `education-`) and the
example is only sent in runs of that domain. Without such a prefix it is sent in every run.

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
  "project": { "name": "", "implementing_org": "", "partners": [], "funders": [], "countries": [],
               "domain": "", "deployment_stage": "", "government_role": "", "target_beneficiaries": "", "evidence_refs": ["e1"] },
  "use": { "problem": "", "primary_user": "", "ai_role": "", "human_role": "", "channel": "", "evidence_refs": ["e1"] },
  "technology": { "stated": true, "category": "", "specific": "", "model_or_product": "", "data_used": "", "evidence_refs": ["e1"] },
  "timeline": { "stated": false, "start_date": "", "end_date": "", "status": "unknown", "as_written": "", "evidence_refs": [] },
  "location": { "stated": true, "scope": "", "places": [
      { "name": "", "name_original": "", "level": "admin2", "admin1": "", "country": "", "lat": null, "lon": null } ],
    "evidence_refs": ["e1"] },
  "reach": { "stated": false, "number": null, "unit": "", "is_target": false, "evidence_refs": [] },
  "cost": { "stated": true, "amount": 0, "currency": "", "amount_as_written": "", "what_is_covered": "",
            "cost_per_beneficiary": null, "funding_source": "",
            "breakdown": [ { "item": "", "category": "", "amount": 0, "currency": "", "amount_as_written": "", "period": "", "evidence_ref": "e2" } ],
            "evidence_refs": ["e2"] },
  "benefit": { "stated": false, "outcome": "", "metric": "", "magnitude": "", "comparison": "", "outputs_reported": [], "evidence_refs": [] },
  "outcomes": [ { "domain": "", "name": "", "measure": "", "population": "", "comparison": "", "value": null, "unit": "",
                  "interpretation": "", "uncertainty": "", "timing": "", "data_source": "", "notes": "", "evidence_ref": "e3" } ],
  "domain_fields": [ { "field": "<from the domain module>", "value": "", "evidence_ref": "e1" } ],
  "implementation": { "barriers": [], "facilitators": [], "evidence_refs": [] },
  "evidence_strength": { "type": "", "rationale": "" },
  "interpretation": { "cost_benefit": "", "credibility": "", "gaps": [], "overall": "<how you would summarise it>" },
  "evidence": [
    { "id": "e1", "field": "project", "quote_original": "<verbatim>", "quote_en": "<translation>" },
    { "id": "e2", "field": "cost", "quote_original": "<verbatim>", "quote_en": "<translation>" },
    { "id": "e3", "field": "outcomes", "quote_original": "<verbatim>", "quote_en": "<translation>" }
  ]
}
```

## Why I read it this way (optional, very useful)
<e.g. "the 12,000 figure is registrations, not active users, so I did not treat it as reach">
