# Domain module · Healthcare

> Owner: the healthcare experts. Used when **Domain = Healthcare** is chosen on the run page. The pipeline adds
> this file after the Search Skill (for searching and for the relevance screen) and after the Extraction Skill
> (for extraction). The format, language, quote and scoring rules of those two skills still apply.
> Source: `expert-input/Healthcare/` (General and Outcome extraction rules, batch 1), simplified.

## 1. What counts in this domain

**AI4SG in healthcare**: AI-enabled systems that address socially important health problems by improving
access to care, the quality and timeliness of screening, diagnosis or treatment, health outcomes, equity,
health-workforce capacity, or the efficiency of health services and public-health programmes, especially
where patients, health workers or facilities face resource, capacity or access constraints.

Include a source only when all three hold:
1. AI is a substantive part of the tool (not just an electronic record, a telemedicine platform or rule-based SMS reminders).
2. It addresses a health or public-health problem.
3. It was **actually tested, deployed or used in a real care or public-health setting** in the country.
   A multi-country study qualifies only if it reports this country's results separately.

Typical applications: AI reading of medical images (chest X-ray for TB, retinal images for diabetic
retinopathy, cervical, breast, skin, ultrasound); offline AI on phones and portable devices; clinical decision
support for doctors, nurses or community health workers; triage and referral; autonomous diagnosis; LLM or
chatbot health information; risk prediction (high-risk pregnancy, non-adherence, drop-out from a programme);
targeting outreach calls; disease surveillance and outbreak forecasting; mental-health chatbots; speech and
translation in local languages; insurance-claim fraud detection and supply-chain forecasting.

Do **not** count: opinion pieces, narrative reviews (use them only to find primary studies), attitude or
intention-to-use surveys without actual use, and purely technical ML papers tested only on public datasets.

Best evidence, in order: randomised trials; field or quasi-experiments; prospective accuracy studies in real
screening; implementation and deployment evaluations; usage logs or programme records; ministry, WHO, Stop TB
Partnership or World Bank programme reports; costing studies of real deployments.

## 2. Where and how to search

Combine one term from each group, in English and in the task language:
- **AI**: artificial intelligence, machine learning, deep learning, computer-aided detection (CAD), clinical decision support, autonomous AI, chatbot, large language model, risk prediction, NLP.
- **Health**: screening, diagnosis, triage, tuberculosis, diabetic retinopathy, maternal / child health, mental health, community health worker, primary health care, telemedicine, health insurance.
- **Evidence**: trial, randomised, real-world, evaluation, implementation, deployment, scale-up, cost-effectiveness, government adoption.

| Concept | Bengali (bn) | Hindi (hi) | Indonesian (id) | Thai (th) |
|---|---|---|---|---|
| tuberculosis | যক্ষ্মা | तपेदिक, टीबी | tuberkulosis, TBC | วัณโรค |
| screening | স্ক্রিনিং | जांच, स्क्रीनिंग | skrining | การคัดกรอง |
| diabetic retinopathy | ডায়াবেটিক রেটিনোপ্যাথি | डायबिटिक रेटिनोपैथी | retinopati diabetik | เบาหวานขึ้นจอตา |
| maternal health | মাতৃস্বাস্থ্য | मातृ स्वास्थ्य | kesehatan ibu | สุขภาพมารดา |
| community health worker | স্বাস্থ্যকর্মী | आशा कार्यकर्ता | kader kesehatan | อสม. |
| primary care facility | উপজেলা স্বাস্থ্য কমপ্লেক্স | प्राथमिक स्वास्थ्य केंद्र | puskesmas | รพ.สต. |

**Sources**: PubMed / MEDLINE, Google Scholar, medRxiv; Lancet Digital Health, npj Digital Medicine, PLOS
Digital Health, BMJ Global Health; WHO, Stop TB Partnership, World Bank; national programmes and ministries
(Bangladesh DGHS `dghs.gov.bd`, India `mohfw.gov.in`, ICMR `icmr.gov.in`, Indonesia Kemenkes `kemkes.go.id`,
Thailand MOPH `moph.go.th`); conference tracks AAAI AI for Social Impact, ACM COMPASS, CHI, KDD.
Search a programme or tool name directly once you find one (e.g. CAD4TB, qXR, ARMMAN / mMitra, ASHABot,
Medios) and link sources about the same tool.

**Fixed academic databases** (searched automatically for English journal and conference tasks, once per country: Europe PMC with the AI, topic and evidence terms in titles and abstracts and the country in the title, abstract or an author affiliation; OpenAlex in the AI-for-social-good conference venues of the Search Skill, plus a general title-and-abstract query when Europe PMC is not listed; reviews left out; every hit is ranked and screened by the search agent, which then follows references and citing papers one level). Keep this block valid JSON; databases: `openalex`, `europepmc`, `eric`.

```json academic
{
  "databases": ["europepmc", "openalex"],
  "ai_terms": ["artificial intelligence", "machine learning", "deep learning", "computer-aided detection", "clinical decision support", "autonomous AI", "chatbot", "large language model", "risk prediction", "natural language processing", "neural network", "reinforcement learning", "bandit", "LLM", "AI"],
  "topic_terms": ["health", "screening", "diagnosis", "tuberculosis", "diabetic retinopathy", "maternal health", "child health", "community health worker", "primary health care", "telemedicine", "mental health", "public health"],
  "evidence_terms": ["trial", "randomized", "randomised", "prospective", "cohort", "field study", "deployment", "deployed", "implementation", "real-world", "pilot", "evaluation", "diagnostic accuracy", "sensitivity", "feasibility", "programme", "program", "cost-effectiveness"]
}
```

## 3. Domain fields (`domain_fields`)

Add one row per field below, in this order. Use the allowed values where given; leave `value` empty if the
source does not say, and cite the quote in `evidence_ref`.

| `field` | What to record | Allowed values / example |
|---|---|---|
| `health_area` | disease or health area | "tuberculosis", "diabetic retinopathy", "maternal health" |
| `level_of_care` | where in the system the AI is used | `community_household`, `primary`, `secondary`, `tertiary`, `national_programme`, `mixed` |
| `care_pathway` | what happens after the AI output | "positive CXR → Xpert test → treatment start" |
| `regulatory_status` | approval or certification, if stated | "CE-marked", "CDSCO approval", "none stated" |

The common fields cover the rest: AI autonomy goes in `use.ai_role` (`assistive` = clinician decides,
`triage_prioritisation` = AI decides who gets further assessment, `autonomous_decision` = AI output is the
decision for some patients); health-worker involvement in `use.human_role`; device and connectivity in
`use.channel`.

## 4. Outcomes (`outcomes[].domain`)

Use these outcome domains:
`Adoption`, `Usage`, `Diagnostic / Predictive Accuracy`, `Technical Performance / Data Quality`,
`Case Detection / Service Yield`, `Care Continuum / Linkage`, `Health Behaviour / Programme Engagement`,
`Health Outcome`, `Health-Worker Practice / Knowledge`, `Health-Worker Productivity / Workload`,
`Service Efficiency / Timeliness`, `Patient Experience`, `Access`, `Equity`, `Safety / Harms`, `Economic`,
`Administrative / System`, `Other`.

Healthcare coding rules, on top of the general outcome rules:
- **Accuracy is not health.** Sensitivity of a TB reader is `Diagnostic / Predictive Accuracy`; more cases notified is `Case Detection / Service Yield`; treatment success is `Health Outcome`. Separate rows.
- **Sensitivity, specificity, AUC, PPV, NPV**: one row each, for the same condition and threshold. Use the prespecified or programme threshold; mention others in `notes`.
- **Ungradable images or failed AI reads** are a `Technical Performance / Data Quality` row; for every accuracy row say in `notes` whether they were excluded from the denominator.
- **Engagement is not health**: listening to programme voice calls is `Health Behaviour / Programme Engagement`; add a `Health Outcome` row only if health status was measured.
- **AI alone vs clinician with AI**: separate rows with different `comparison`.

## 5. Reference cases from the experts (batch 1)

- Abramoff et al. 2023, Bangladesh (Rangpur, specialist eye clinic): autonomous AI diabetic-eye exams in a
  cluster-randomised trial. `use.ai_role` = `autonomous_decision` (AI-negative patients do not see the retina
  specialist). Outcome: `Health-Worker Productivity / Workload`, "Specialist clinic productivity",
  comparison "AI clinic days vs control days (randomised)", value 1.59, unit "encounters/hour", interpretation
  "1.59 vs 1.14 on control days, about 40% higher", uncertainty "95% CI 1.37 to 1.80".
- Ruamviboonsuk et al. 2022, Thailand: deep-learning DR screening in primary care. Three separate
  `Diagnostic / Predictive Accuracy` rows (sensitivity 91.4, specificity 95.4, accuracy 94.7 percent for
  vision-threatening DR, comparison "AI vs reference standard") and one `Case Detection / Service Yield` row
  (referral rate 31.5 percent).
- Qin et al. 2021, Bangladesh: CXR AI for TB triage. "Xpert tests avoided" (50 percent) is
  `Case Detection / Service Yield`, not accuracy; differences by age and TB history are an `Equity` row.
