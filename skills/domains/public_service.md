# Domain module · Public service

> Owner: the public-service experts. Used when **Domain = Public service** is chosen on the run page. The
> pipeline adds this file after the Search Skill (for searching and for the relevance screen) and after the
> Extraction Skill (for extraction). The format, language, quote and scoring rules of those two skills still apply.
> Source: `expert-input/Public_service/` (General and Outcome extraction rules, batch 1), simplified.

## 1. What counts in this domain

**AI4SG in public service**: AI-enabled systems that improve citizens' access to, and the quality,
timeliness, equity, accountability or efficiency of, services that are delivered, financed or mandated by
government, especially where citizens, frontline officials or agencies face resource, capacity, language or
access constraints. Services run by NGOs or firms count when delivered under a public mandate, with a public
agency, or in place of a public service (e.g. public flood alerts, public agricultural extension).

Include a source only when all three hold:
1. AI is a substantive part of the tool (not just an online form, portal, rule-based IVR menu or SMS broadcast).
   A keyword-triggered bot with no NLP or learning is **borderline**: include it but say so in `interpretation.credibility`.
2. It addresses a public-service problem.
3. It was **actually tested, deployed or used** in the country. A multi-country study qualifies only if it
   reports this country's results separately.

Typical applications: citizen chatbots and virtual assistants; speech recognition and machine translation for
services (e.g. Bhashini); LLM advisory on schemes, legal rights or farming; fraud and leakage detection in
benefits, subsidies, procurement or tax; classifying and routing citizen complaints; flood, weather and pest
early warning linked to public alerts; satellite or geospatial AI for planning, damage assessment or
targeting; computer vision for infrastructure monitoring; OCR / NLP for records; translating court judgments;
decision support for frontline officials; predictive allocation of programme resources.

Do **not** count: opinion pieces, general discussion of AI in government, attitude or technology-acceptance
surveys without actual use, and ML papers with no real public-service deployment.

Best evidence, in order: randomised trials and field experiments; quasi-experiments; implementation and
deployment evaluations; analyses of usage data or administrative records; government evaluations and annual
programme reports; audit-institution and parliamentary reports; algorithmic audits (including civil-society
audits); World Bank, UNDP, ADB, ITU or OECD reports.

## 2. Where and how to search

Combine one term from each group, in English and in the task language:
- **AI**: artificial intelligence, machine learning, chatbot, virtual assistant, large language model, NLP, speech recognition, machine translation, algorithmic / automated decision, predictive analytics, early warning system, remote sensing.
- **Public service**: e-government, social protection, welfare, cash transfer, targeting, grievance redress, complaint, flood forecasting, disaster risk, agricultural extension, government scheme, access to justice, municipality, tax administration.
- **Evidence**: trial, experiment, evaluation, implementation, deployment, scale-up, audit, cost-effectiveness, procurement.
- **Places**: also local-government units (panchayat, union parishad, desa, tambon).

| Concept | Bengali (bn) | Hindi (hi) | Indonesian (id) | Thai (th) |
|---|---|---|---|---|
| public service | সরকারি সেবা | सार्वजनिक सेवा | layanan publik | บริการสาธารณะ |
| social protection / welfare | সামাজিক সুরক্ষা | सामाजिक सुरक्षा, कल्याण योजना | perlindungan sosial, bansos | สวัสดิการสังคม |
| complaint / grievance | অভিযোগ | शिकायत निवारण | pengaduan | ร้องเรียน |
| early warning | আগাম সতর্কবার্তা | पूर्व चेतावनी | peringatan dini | ระบบเตือนภัยล่วงหน้า |
| government scheme | সরকারি কর্মসূচি | सरकारी योजना | program pemerintah | โครงการของรัฐ |
| chatbot | চ্যাটবট | चैटबॉट | chatbot, asisten virtual | แชทบอท |

**Sources**: Scopus, Web of Science, Google Scholar; Government Information Quarterly, World Development,
Journal of Development Economics; NBER, J-PAL, IPA, 3ie, World Bank Policy Research Working Papers, AEA RCT
Registry; ICEGOV and dg.o (digital government) conferences, AAAI AI for Social Impact, IJCAI, CHI; GARUDA
(Indonesia), ThaiJO (Thailand), BanglaJOL (Bangladesh); ministry and agency reports, national AI strategies,
audit institutions (e.g. CAG India), UNDP, World Bank, ADB, ITU, OECD.
Much of the evidence in this domain is **grey literature**: agency announcements, programme dashboards, audit and
parliamentary reports, civil-society audits and investigative journalism. Search for them as hard as for papers,
and when you find a programme, search its name directly for evaluations, news and official figures.
Leads the experts had not yet followed up: Farmer.Chat (Digital Green) evaluations with India-specific results;
evaluations of CPGRAMS's AI-based grievance monitoring (IGMS); evaluations of Bhashini or Jugalbandi services.

**Screening judgements from the experts (batch 1)**:
- A model trained or tested on a government platform's data (e.g. classifying complaints from a city complaint app)
  is **excluded** unless the agency actually uses it; it is **borderline** when the paper claims operational
  benefits (e.g. shorter validation time) without confirming routine use: read the full text before deciding.
- A prototype app built by researchers, and a conceptual paper proposing AI for a government service, are excluded.
- A global model paper (e.g. a worldwide flood model) qualifies only when it reports results for this country separately.
- An evaluation summary (J-PAL, IPA, a blog) of a study already listed is another source about the same project:
  link it to that project rather than counting it as a new one.

**Fixed databases** (searched automatically for English tasks, once per country; every hit is ranked and screened by
the search agent, which then follows references and citing papers one level):
- OpenAlex (journal and conference tasks): one query in the AI-for-social-good and digital-government venues below
  (`venues` replaces the Search Skill's list, so it repeats it), plus one general title-and-abstract query (AI, topic
  and evidence terms and the country); reviews left out.
- World Bank Documents & Reports (report and journal tasks): working papers, reports and briefs tagged with the
  country, with an AI term in the title or abstract.
- AEA RCT Registry (journal tasks): registered trials with an AI term and the country; they lead to results papers.
Keep this block valid JSON; databases: `openalex`, `europepmc`, `eric`, `worldbank`, `aearct`.

```json academic
{
  "databases": ["openalex", "worldbank", "aearct"],
  "ai_terms": ["artificial intelligence", "machine learning", "deep learning", "chatbot", "virtual assistant", "conversational agent", "large language model", "generative AI", "natural language processing", "speech recognition", "machine translation", "algorithmic decision", "automated decision", "predictive analytics", "early warning", "remote sensing", "AI"],
  "topic_terms": ["public service", "public sector", "e-government", "digital government", "social protection", "social assistance", "welfare", "cash transfer", "targeting", "grievance", "complaint", "flood forecasting", "disaster", "agricultural extension", "government scheme", "access to justice", "local government", "municipal", "tax administration"],
  "evidence_terms": ["trial", "randomized", "experiment", "evaluation", "deployment", "deployed", "implementation", "pilot", "field", "usage", "adoption", "scaling", "administrative data", "audit", "impact", "cost", "procurement", "government adoption", "programme", "program"],
  "venues": [
    {"id": "S4210191458", "name": "AAAI Conference on Artificial Intelligence (incl. AI for Social Impact track)"},
    {"id": "S4363607743", "name": "ACM CHI"},
    {"id": "S7407086267", "name": "ACM COMPASS"},
    {"id": "S7407086352", "name": "ACM COMPASS (SIGCAS/SIGCHI)"},
    {"id": "S4387291547", "name": "ACM Journal on Computing and Sustainable Societies"},
    {"id": "S7407087199", "name": "ICTD"},
    {"id": "S7407088418", "name": "ACM KDD"},
    {"id": "S4363608767", "name": "ACM KDD"},
    {"id": "S4306419999", "name": "IJCAI"},
    {"id": "S4306400194", "name": "arXiv (preprints of conference papers)"},
    {"id": "S4306419883", "name": "ICEGOV (Theory and Practice of Electronic Governance)"},
    {"id": "S5407047506", "name": "dg.o (Annual International Conference on Digital Government Research)"},
    {"id": "S4306418197", "name": "dg.o (Digital Government Research)"},
    {"id": "S4210232200", "name": "Digital Government: Research and Practice"}
  ]
}
```

## 3. Domain fields (`domain_fields`)

Add one row per field below, in this order. Leave `value` empty if the source does not say.

| `field` | What to record | Allowed values / example |
|---|---|---|
| `service_sector` | which public service | `social_protection`, `disaster_early_warning`, `grievance_complaints`, `agricultural_extension`, `justice_legal`, `tax_revenue`, `municipal_services`, `identity_records`, `other` |
| `level_of_government` | who runs or mandates it | `national`, `state_provincial`, `district`, `local_municipal`, `mixed` |
| `appeal_mechanism` | how citizens can contest an AI-driven decision | "appeal to district officer", "none stated" |
| `data_and_legal_basis` | data the system uses and the law or order allowing it | "Aadhaar-linked welfare databases; state government order" |

The common fields cover the rest: the AI's decision role goes in `use.ai_role` (`information_only`,
`assistive` = recommends to an official, `triage_prioritisation` = automated routing, `autonomous_decision`
= decides eligibility or entitlement); human oversight in `use.human_role`; access channel in `use.channel`.

## 4. Outcomes (`outcomes[].domain`)

Use these outcome domains:
`Adoption`, `Usage`, `Access / Reach`, `Accuracy / Technical Performance`, `Targeting / Eligibility Accuracy`,
`Service Uptake / Benefit Receipt`, `Timeliness / Efficiency`, `Citizen Behaviour / Response`,
`Welfare / Socioeconomic Outcome`, `Frontline Productivity / Workload`, `Administrative Cost / Fiscal`,
`Trust / Satisfaction / Accountability`, `Equity`, `Inclusion / Language Access`, `Errors / Harms`, `Other`.

Public-service coding rules, on top of the general outcome rules:
- **Sent, received, acted upon**: for alerts and notifications, each step reported is its own row.
- **Accuracy is not impact**: a well-performing flood forecast or complaint classifier is `Accuracy / Technical Performance`; fewer losses or faster resolution are separate rows.
- **Targeting errors**: inclusion error and exclusion error are separate rows; say in `notes` what defines true eligibility and the denominator. Documented wrongful exclusions are `Errors / Harms` even without a rate.
- **Queries answered vs problems solved**: query counts are `Usage`, answer correctness is `Accuracy / Technical Performance`, getting the benefit is `Service Uptake / Benefit Receipt`.
- **Closed vs resolved**: agency-reported case closure is `Timeliness / Efficiency`; citizen-confirmed resolution or satisfaction is `Trust / Satisfaction / Accountability`.
- **Official and developer claims**: figures only from a government announcement, developer page or press release get `data_source` = `developer_or_government_claim`. Keep them, but never in the same row as independently evaluated figures.

## 5. Reference cases from the experts (batch 1)

- Jagnani and Pande 2024, India (Bihar): Google flood alerts plus volunteer dissemination, randomised.
  Separate rows for 2022 and 2023: household receipt of any alert (`Access / Reach`), alerts received before
  the water arrived (`Timeliness / Efficiency`), complete trust in alerts (`Trust / Satisfaction /
  Accountability`), missed floods and false alarms (two `Errors / Harms` rows), benefit per dollar spent
  (`Administrative Cost / Fiscal`, 30, unit "benefit-cost ratio").
- Kisan e-Mitra, India: 2.69 million queries answered (`Usage`) and 11 languages (`Inclusion / Language
  Access`), both `developer_or_government_claim` (developer web page).
- Samagra Vedika, Telangana: 1.86 million food-security cards cancelled and wrongful exclusions reported by
  journalists and Amnesty International: `Errors / Harms` rows.
