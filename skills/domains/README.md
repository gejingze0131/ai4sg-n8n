# Domain modules

One file per domain: `healthcare.md`, `public_service.md`, `agriculture.md`, `education.md`. The run page's
**Domain** setting picks one; the pipeline then adds that file after the Search Skill (search and relevance
screen) and after the Extraction Skill (extraction). With **All domains**, no module is used.

Each module has the same five parts, and experts can edit all of them without an engineer:

1. **What counts in this domain**: inclusion and exclusion, best evidence.
2. **Where and how to search**: term groups, local-language terms, sources and programmes to follow up, and a
   `json academic` block: which fixed academic databases to query and with which AI and topic terms.
3. **Domain fields**: 4 short fields specific to the domain (`domain_fields` in the output).
4. **Outcomes**: the domain's outcome categories and its special coding rules.
5. **Reference cases** from the experts' own coding.

Files whose names start with `_` and this README are not sent to the AI.
To add a domain (e.g. `financial_inclusion.md`), copy a module and ask the engineer to add it to the run page.

The originals the modules were written from are in `expert-input/<Domain>/` (Word / Excel files plus text copies).

## How the experts' columns were simplified

The experts' General sheets have 32–36 columns per domain and the Outcome sheets 16. The pipeline keeps one
shared core for all domains plus 4 domain fields, and outcome rows with 12 columns.

| Experts' General-sheet column | Where it is now |
|---|---|
| Study / Source, Year, Publication type | `source` (title, publisher, date) and the search's source type |
| Country and State / City | `location` (places, mapped) |
| Country income level | left out: added later from World Bank tables, not from the source |
| Study design | `evidence_strength` (type + one-sentence rationale) |
| AI tool, AI function category, AI function description | `project.name`, `technology` (category, specific, product) |
| Level of AI autonomy / Decision role of AI | `use.ai_role` (one shared scale for all domains) |
| Primary user | `use.primary_user` |
| Health / public-service / agricultural / educational problem | `use.problem` |
| Targeted population, Sample size | `project.target_beneficiaries`, `reach`; outcome-specific samples in `outcomes[].population` |
| Implementing organization | `project.implementing_org`, `partners` |
| Treatment / Control condition | `outcomes[].comparison` and `use.human_role` |
| Health-worker / teacher / farmer involvement, Human oversight | `use.human_role` |
| Duration, Frequency / intensity | `timeline` (start, end, status); intensity left out |
| Implementation requirements, barriers, facilitators | `implementation.barriers`, `implementation.facilitators` |
| Deployment model, Device / infrastructure, Language / localisation | `use.channel` |
| Deployment stage, Scaling information | `project.deployment_stage`, `reach` |
| Government involvement | `project.government_role` |
| Cost information, Financing source, Financing mechanism | `cost` (amount, breakdown, what is covered, funding source) |
| Health area, Level of care, Care pathway, Regulatory status | Healthcare `domain_fields` |
| Service sector, Level of government, Grievance / appeal, Data and legal basis | Public-service `domain_fields` |
| Subsector / crop, Production setting, Action pathway (+ bundled support) | Agriculture `domain_fields` |
| Education level (+ subject, setting, instruction role) | Education `domain_fields` |

| Experts' Outcome-sheet column | Where it is now |
|---|---|
| Outcome domain, Outcome name, Outcome measure | `domain`, `name`, `measure` |
| Population / sample, Subgroup | `population` |
| Comparison | `comparison` |
| Result value, Result unit, Result interpretation | `value`, `unit`, `interpretation` |
| Standard error / CI, P-value | `uncertainty` (as written) |
| Measurement timing | `timing` |
| Actual vs intended usage | the `Adoption` / `Usage` / `Access` split and `notes` |
| Result notes | `notes`, plus `data_source` (logs, records, independent, self-report, claim, modelled) |
| (new) | `evidence_ref`: the verbatim quote behind the number, checked by the pipeline |

"Not reported" is an empty field; "Not verified" shows on the audit page as a quote that was not found in the source.
