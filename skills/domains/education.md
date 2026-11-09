# Domain module · Education

> Owner: the education experts. Used when **Domain = Education** is chosen on the run page. The pipeline adds
> this file after the Search Skill (for searching and for the relevance screen) and after the Extraction Skill
> (for extraction). The format, language, quote and scoring rules of those two skills still apply.
> Source: `expert-input/Education/` (Search and Background Extraction Rule and Intervention Outcome Extraction
> Rule, updated 14 Oct 2026; examples), simplified.

## 1. What counts in this domain

**AI4SG in education**: AI-enabled systems that address socially important educational problems by
improving learning, access, equity, inclusion, teaching capacity, or the efficiency and quality of education
delivery, especially where students, teachers, schools or education systems face resource, capacity or
access constraints.

The shared rules in section 3b of the Search Skill apply (substantive AI, real use in the country,
country-specific results, unit = intervention or deployment). Specific to education: older systems count if
adaptive algorithms, learner modelling, prediction, NLP, automated personalisation or automated feedback are
substantive; ordinary digital content, video lessons or a learning-management system without these do not.

Typical applications: intelligent tutoring systems; personalised adaptive learning;
generative-AI or LLM tutors; educational chatbots; teacher copilots and AI teacher support; automated
feedback and assessment; dropout or learning-risk prediction and early warning; AI for accessibility and
special education; translation and language-learning systems; AI for education administration.

Do **not** count ML papers without a real educational deployment (section 3b lists the rest).

Stages to tell apart in `evidence_strength.rationale`: lab or classroom trial, pilot, government-scale
deployment. Name deployments as "Tool — place or phase" (e.g. "Adaptive maths tutor — city after-school
centres", "Adaptive maths tutor — state government schools").

## 2. Where and how to search

Combine one term from each group, in English and in the task language:
- **AI**: artificial intelligence, generative AI, large language model, AI tutor, intelligent tutoring system, adaptive learning, personalised learning, educational chatbot, teacher copilot, automated feedback, automated assessment, early warning system, learning analytics, machine learning.
- **Education**: school, student, teacher, classroom, learning, primary school, secondary school, higher education, public school, dropout.
- **Evidence**: intervention, trial, experiment, evaluation, implementation, adoption, usage, deployment, scale-up, cost-effectiveness, procurement, government adoption.

| Concept | Bengali (bn) | Hindi (hi) | Indonesian (id) | Thai (th) |
|---|---|---|---|---|
| school | বিদ্যালয় | विद्यालय, स्कूल | sekolah | โรงเรียน |
| student / teacher | শিক্ষার্থী / শিক্ষক | छात्र / शिक्षक | siswa / guru | นักเรียน / ครู |
| learning | শিখন | सीखना, अधिगम | pembelajaran | การเรียนรู้ |
| adaptive learning | অভিযোজিত শিখন | अनुकूली शिक्षण | pembelajaran adaptif | การเรียนรู้แบบปรับเหมาะ |
| dropout | ঝরে পড়া | पढ़ाई छोड़ना, ड्रॉपआउट | putus sekolah | ออกกลางคัน |

**Sources**: ERIC, Google Scholar, Scopus; J-PAL, IPA, 3ie, NBER, World Bank Policy Research Working Papers
and the AEA RCT Registry; EdTech Hub, UNESCO, UNICEF; GARUDA (Indonesia), ThaiJO (Thailand), BanglaJOL
(Bangladesh); education ministries and state education departments (`education.gov.in`, DIKSHA,
`kemdikbud.go.id`, `moe.go.th`, `dshe.gov.bd`).
Search a tool or programme name directly once you find one, and look for each tool's other
deployments (a pilot and a later government-scale deployment are separate records).

**Fixed databases** (searched automatically for English tasks, once per country; every hit is ranked and screened
by the search agent, which then follows references and citing papers one level): OpenAlex (journal and conference
tasks: the AI-for-social-good venues of the Search Skill plus a general title-and-abstract query); ERIC (journal
and conference tasks); World Bank Documents & Reports (report and journal tasks: Policy Research Working Papers,
reports); AEA RCT Registry (journal tasks: J-PAL, IPA and other registered trials). Keep this block valid JSON;
databases: `openalex`, `europepmc`, `eric`, `worldbank`, `aearct`.

```json academic
{
  "databases": ["openalex", "eric", "worldbank", "aearct"],
  "ai_terms": ["artificial intelligence", "machine learning", "intelligent tutoring", "adaptive learning", "personalized learning", "large language model", "chatbot", "automated assessment", "learning analytics", "early warning", "AI"],
  "topic_terms": ["education", "school", "student", "teacher", "learning", "classroom", "tutoring", "dropout"],
  "evidence_terms": ["trial", "randomized", "randomised", "experiment", "evaluation", "deployment", "implementation", "pilot", "impact", "learning outcomes", "test scores", "schools", "students"]
}
```

## 3. Domain fields (`domain_fields`)

Add one row per field below, in this order. Leave `value` empty if the source does not say.

| `field` | What to record | Allowed values / example |
|---|---|---|
| `education_level` | level of the learners | `early_childhood`, `primary`, `secondary`, `higher`, `adult_vocational`, `mixed` |
| `subject` | subject or skill | "mathematics", "Hindi reading", "English" |
| `learning_setting` | where the AI is used | `school_classroom`, `school_lab`, `home`, `community_centre`, `remote`, `mixed` |
| `instruction_role` | how the AI relates to teaching | `replaces_instruction`, `supplements_instruction`, `supports_teacher`, `assessment_feedback`, `prediction`, `administration` |

The common fields cover the rest: teacher or tutor involvement goes in `use.human_role`, device and
connectivity in `use.channel`.

## 4. Outcomes (`outcomes[].domain`)

Use these outcome domains:
`Adoption`, `Usage`, `Learning`, `Engagement`, `Attendance`, `Dropout / Retention`, `Teacher Practice`,
`Teacher Productivity`, `Access`, `Equity`, `Inclusion / Accessibility`, `Administrative`, `Other`.

Education coding rules, on top of the general outcome rules:
- **Performance vs learning**: better scores while using the tool and later unaided learning are separate rows.
- **Prediction accuracy is not reduced dropout**: dropout-prediction accuracy is `Administrative`; actual dropout is `Dropout / Retention`.
- **Separate rows per subject** (mathematics, language) and per follow-up time: the same outcome measured at year 1
  and later is two rows, each with its own `timing`.
- **Effect sizes**: learning effects are usually in standard deviations: unit "SD".
