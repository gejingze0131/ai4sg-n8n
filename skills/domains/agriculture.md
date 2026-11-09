# Domain module · Agriculture

> Owner: the agriculture experts. Used when **Domain = Agriculture** is chosen on the run page. The pipeline
> adds this file after the Search Skill (for searching and for the relevance screen) and after the Extraction
> Skill (for extraction). The format, language, quote and scoring rules of those two skills still apply.
> Source: `expert-input/Agriculture/` (Search and Background Extraction Rule and Intervention Outcome Extraction Rule,
> updated 14 Oct 2026), simplified. The experts' 10 worked examples are kept out of this file: they are the
> benchmark the pipeline is compared against.

## 1. What counts in this domain

**AI4SG in agriculture**: AI-enabled systems that address socially important agricultural problems by
improving access to agricultural information and services, the quality and timeliness of farming decisions,
productivity, farmer livelihoods, food security, environmental sustainability, resilience, equity,
agricultural-worker capacity, or the efficiency of agricultural services, especially for smallholders and
under-served producers. Covers crops, horticulture, livestock, aquaculture, extension, and value-chain
services that reach producers.

The shared rules in section 3b of the Search Skill apply (substantive AI, real use in the country,
country-specific results, unit = intervention or deployment). Specific to agriculture:
- A fixed-rule SMS advice service, a sensor dashboard, a digital marketplace or a remote-consultation platform
  without an AI function is not AI.
- The source must state the social or environmental benefit intended; using AI in agriculture is not enough.
- Validation on historical data or a public image dataset is **not** deployment, even if the data came from farms.

Typical applications: identifying crop diseases, pests, weeds or nutrient deficiencies from photos; offline
AI on phones; decision support for farmers, agronomists, vets or extension workers; advice on planting,
irrigation, fertiliser, pesticide or harvest timing; precision spraying and robotics; LLM or chatbot farm
advice; yield prediction and weather, pest, drought or flood early warning used operationally; targeting
extension outreach; livestock and aquaculture monitoring; speech and translation in local languages;
post-harvest grading and loss reduction; AI for agricultural credit, insurance and supply chains.

Do **not** count ML papers without field testing or programme deployment (section 3b lists the rest).

Stages to tell apart in `evidence_strength.rationale`: research-station test, on-farm test, pilot deployment,
routine operational use. Sources about agriculture often come from developers, implementers and technology
providers; their evidence pages count when they report an actual deployment. Name deployments as "Tool — place
or phase" (e.g. "Crop-doctor app — Punjab pilot", "Pest-trap reader — Kharif 2024 season").

## 2. Where and how to search

Combine one term from each group, in English and in the task language:
- **AI**: artificial intelligence, machine learning, deep learning, computer vision, decision support, generative AI, large language model, chatbot, predictive model, NLP, robotics.
- **Agriculture**: smallholder, farmer, agricultural extension, crop, plant disease, pest, weed, precision agriculture, irrigation, fertiliser, pesticide, yield, livestock, aquaculture, climate-smart agriculture, post-harvest loss, crop insurance, agricultural credit.
- **Evidence**: trial, field experiment, on-farm, field validation, evaluation, implementation, adoption, deployment, scale-up, cost-effectiveness, benefit-cost, government adoption.

| Concept | Bengali (bn) | Hindi (hi) | Indonesian (id) | Thai (th) |
|---|---|---|---|---|
| crop disease | ফসলের রোগ | फसल रोग | penyakit tanaman | โรคพืช |
| pest | পোকামাকড়, বালাই | कीट | hama | ศัตรูพืช |
| agricultural extension | কৃষি সম্প্রসারণ | कृषि विस्तार | penyuluhan pertanian | ส่งเสริมการเกษตร |
| rice | ধান | धान | padi | ข้าว |
| livestock | প্রাণিসম্পদ | पशुपालन | peternakan | ปศุสัตว์ |
| aquaculture / fish farming | মৎস্য চাষ | मत्स्य पालन | budidaya perikanan | การเพาะเลี้ยงสัตว์น้ำ |

**Sources**: AGRIS, CAB Abstracts, AgEcon Search, Scopus, Web of Science, Google Scholar; ACM CHI, ACM
COMPASS, AAAI AI for Social Impact, IJCAI, KDD, NeurIPS / ICML workshops, agricultural-engineering and
agricultural-economics conferences; GARUDA (Indonesia), ThaiJO (Thailand), BanglaJOL (Bangladesh), Indian
agricultural journals (ICAR `icar.org.in`); AEA RCT Registry, 3ie, J-PAL; FAO, IFAD, CGIAR centres (IRRI,
CIMMYT, ICRISAT), World Bank, ADB, GSMA AgriTech, Precision Development; agriculture
ministries (`dae.gov.bd`, `agriwelfare.gov.in`, `pertanian.go.id`, `doae.go.th`).
Search a tool or programme name directly once you find one, and look for each tool's other deployments.

**Fixed databases** (searched automatically for English tasks, once per country; every hit is ranked and screened
by the search agent, which then follows references and citing papers one level): OpenAlex (journal and conference
tasks: the AI-for-social-good venues of the Search Skill plus a general title-and-abstract query); World Bank
Documents & Reports (report and journal tasks); AEA RCT Registry (journal tasks). Keep this block valid JSON; databases: `openalex`, `europepmc`, `eric`,
`worldbank`, `aearct`.

```json academic
{
  "databases": ["openalex", "worldbank", "aearct"],
  "ai_terms": ["artificial intelligence", "machine learning", "deep learning", "computer vision", "computer-aided detection", "decision support", "generative AI", "large language model", "chatbot", "conversational agent", "predictive model", "natural language processing", "remote sensing", "robotics", "AI"],
  "topic_terms": ["agriculture", "farming", "farmer", "smallholder", "crop", "horticulture", "plant disease", "pest", "weed", "precision agriculture", "irrigation", "fertilizer", "pesticide", "yield", "harvest", "livestock", "aquaculture", "agricultural extension", "post-harvest", "crop insurance", "agricultural credit"],
  "evidence_terms": ["trial", "randomized", "field", "on-farm", "farmers", "deployment", "deployed", "implementation", "pilot", "evaluation", "adoption", "usage", "impact", "scale", "cost", "extension"]
}
```

## 3. Domain fields (`domain_fields`)

Add one row per field below, in this order. Leave `value` empty if the source does not say.

| `field` | What to record | Allowed values / example |
|---|---|---|
| `subsector_crop` | subsector and crop, species or product | "rice", "cotton", "dairy cattle", "shrimp aquaculture" |
| `production_setting` | where the AI is used | `farm_household`, `research_station`, `extension_service`, `cooperative`, `value_chain_market`, `national_programme`, `mixed` |
| `action_pathway` | what users do after the AI output | "photo diagnosis → spray recommendation → farmer buys pesticide" |
| `bundled_support` | what came with the AI (training, subsidies, free devices, extra extension visits) | "free smartphones and two training sessions" |

`bundled_support` matters: if AI came with training or subsidies, a reported effect is the effect of the
package unless the comparison isolates the AI; say so in `interpretation.credibility`.
The common fields cover the rest: autonomy in `use.ai_role`, farmer and extension-worker involvement in
`use.human_role`, device and connectivity in `use.channel`.

## 4. Outcomes (`outcomes[].domain`)

Use these outcome domains:
`Adoption`, `Usage`, `Diagnostic / Predictive Accuracy`, `Technical Performance / Data Quality`,
`Problem Detection / Service Yield`, `Action Continuum / Linkage`, `Farmer Behaviour / Programme Engagement`,
`Agricultural Production Outcome`, `Resource Use / Environmental Outcome`, `Livelihood / Food Security Outcome`,
`Agricultural-Worker Practice / Knowledge`, `Agricultural-Worker Productivity / Workload`,
`Service Efficiency / Timeliness`, `Farmer / User Experience`, `Access`, `Equity`, `Safety / Harms`,
`Economic`, `Administrative / System`, `Other`.

Agriculture coding rules, on top of the general outcome rules:
- **Tool adoption vs practice adoption**: starting to use the app is `Adoption`; adopting the farming practice it recommends is `Farmer Behaviour / Programme Engagement`.
- **Accuracy is not yield**: detection accuracy is `Diagnostic / Predictive Accuracy`; **predicted yield is not harvested yield**. Production, income and environment are separate rows.
- **Precision, recall, F1, RMSE, MAE**: one row each, keeping the original unit and forecast horizon.
- **Yield and income**: distinguish yield per area from total production, and revenue, gross margin, net profit and household income; give area, season and currency.
- **Resources**: less fertiliser or pesticide alone does not show less pollution; water withdrawal, consumption and water-use efficiency are different.
- **Modelled benefits** (e.g. estimated emissions saved) get `data_source` = `modelled`; never present them as observed.
- Separate rows per crop, pest, disease, species or season.
