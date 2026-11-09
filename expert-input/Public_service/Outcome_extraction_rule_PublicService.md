Scope: AI4SG tools in public service delivery in **Bangladesh, India, Indonesia and Thailand**. Use together with the Public Service General extraction rule (Sheet 1).

# **Variables to extract**

## **1. Study / Source**

## **2. AI Tool / Program**

## **3. Outcome Domain**

**Definition:**

Standardized category describing the type of outcome measured.

Use one of the following categories whenever possible.

### **Adoption**

Whether eligible citizens, intermediaries, officials, or agencies begin using the AI tool.

Examples:

- share of targeted citizens who started using a chatbot,

- number of agencies or local governments onboarded,

- share of frontline officials who began using a system.

**Keywords / cues:**

adopted, take-up, onboarded, registered, activated, started using, participation rate

### **Usage**

How much, how often, or how long the AI tool is actually used after access/adoption.

Examples:

- queries or messages per user,

- complaints submitted per month,

- active users,

- repeat use,

- retention.

**Keywords / cues:**

usage, queries, messages, sessions, submissions, active users, retention, engagement

### **Access / Reach**

Whether the intervention extends the service or information to the intended population.

Examples:

- households that received a flood alert,

- area and population covered by forecasts,

- citizens in remote areas reached,

- share of target population aware of the service.

**Keywords / cues:**

reach, coverage, received, delivered, population covered, awareness, underserved

### **Accuracy / Technical Performance**

Correctness and reliability of AI outputs in a real setting.

Examples:

- forecast skill or alert precision and recall,

- complaint classification or routing accuracy,

- share of chatbot answers judged correct,

- speech-recognition or translation error rate,

- system uptime.

**Keywords / cues:**

accuracy, precision, recall, F1, skill score, error rate, correct answers, hallucination, uptime

### **Targeting / Eligibility Accuracy**

Accuracy of AI-supported decisions about who is eligible for, or prioritised by, a public programme.

Examples:

- inclusion error rate,

- exclusion error rate,

- share of beneficiaries correctly identified as eligible,

- duplicate or fraudulent records identified and confirmed.

**Keywords / cues:**

inclusion error, exclusion error, targeting accuracy, eligibility, mistargeting, false positive, entity resolution

### **Service Uptake / Benefit Receipt**

Whether citizens actually obtain the service, entitlement, or benefit.

Examples:

- scheme applications submitted,

- benefits received,

- enrolment in programmes,

- resolved service requests.

**Keywords / cues:**

applied, enrolled, received benefit, entitlement, uptake, claim approved

### **Timeliness / Efficiency**

Changes in the speed or efficiency of the public service.

Examples:

- complaint resolution time,

- application processing time,

- call handling time,

- warning lead time.

**Keywords / cues:**

processing time, resolution time, turnaround, lead time, backlog, speed, efficiency

### **Citizen Behaviour / Response**

Actions taken by citizens in response to AI-enabled information or services.

Examples:

- protective actions taken before a flood,

- evacuation,

- adoption of a recommended agricultural practice,

- follow-up with an agency.

**Keywords / cues:**

protective action, evacuation, preparedness, practice adoption, behaviour change, response

### **Welfare / Socioeconomic Outcome**

Changes in the wellbeing or economic situation of citizens or households.

Examples:

- asset losses,

- income,

- consumption,

- borrowing or depletion of savings after a shock,

- crop yields,

- physical health after a disaster.

**Keywords / cues:**

income, consumption, losses, yields, welfare, coping, savings, livelihoods

### **Frontline Productivity / Workload**

Changes in officials' or frontline workers' time, workload, output, or efficiency.

Examples:

- cases handled per official,

- time saved per case,

- farmers served per extension worker.

**Keywords / cues:**

productivity, workload, time saved, caseload, throughput, efficiency

### **Administrative Cost / Fiscal**

Changes in public expenditure, administrative cost, or leakage attributable to the AI system.

Examples:

- administrative cost savings,

- leakage or fraud prevented,

- cost per transaction.

**Keywords / cues:**

cost savings, budget, leakage, fraud prevented, fiscal, cost per transaction

### **Trust / Satisfaction / Accountability**

Perceptions and accountability outcomes among people who actually used the service, and measures of government responsiveness.

Examples:

- citizen satisfaction score,

- trust in alerts,

- share of complaints closed with citizen confirmation,

- transparency of decisions.

**Keywords / cues:**

satisfaction, trust, responsiveness, accountability, transparency, citizen rating

### **Equity**

Differences in adoption, usage, accuracy, or outcomes across groups.

Examples:

- women vs men,

- smartphone owners vs non-owners,

- low-literacy vs higher-literacy users,

- remote vs central villages,

- socially disadvantaged groups where reported.

**Keywords / cues:**

heterogeneous effects, subgroup, disadvantaged, equity, digital divide, gender gap

### **Inclusion / Language Access**

Outcomes specifically related to local-language access, low literacy, or disability.

Examples:

- share of queries in local languages,

- use by low-literacy users through voice,

- use by persons with disabilities.

**Keywords / cues:**

local language, multilingual, voice, low literacy, disability, accessibility, inclusive

### **Errors / Harms**

Adverse or unintended consequences of using the AI.

Examples:

- wrongful exclusion from benefits,

- false alarms,

- incorrect or misleading advice,

- privacy breaches,

- falsified or unverified case closures.

**Keywords / cues:**

harm, error, wrongful, exclusion, false alarm, misinformation, privacy, grievance, manipulation

### **Other**

Use only when none of the above categories fit.

Explain clearly in the outcome name.

## **4. Outcome Name**

**Definition:**

Specific variable or result being measured.

The name should be more precise than the outcome domain.

**Examples:**

- Flood alerts sent

- Household receipt of flood alert

- Protective actions taken before flood

- Household borrowing after flood

- Complaint resolution time

- Chatbot answer correctness

- Exclusion error in welfare eligibility

- Weekly queries per farmer

- Agencies onboarded

**Keywords / cues:**

dependent variable, primary outcome, secondary outcome, endpoint, indicator, measure

## **5. Outcome Measure**

**Definition:**

How the outcome was operationalized or measured.

**Examples:**

- number of alerts sent, from system records,

- self-reported receipt of an alert in a household survey,

- days from complaint submission to closure, from platform records,

- share of answers rated correct by domain experts,

- share of eligible households wrongly excluded, verified against field visits or records,

- self-reported satisfaction scale.

Be concise.

**Keywords / cues:**

measured using, constructed from, household survey, platform logs, administrative records, expert rating

## **6. Population / Sample for Outcome**

**Definition:**

The group for whom this particular outcome was measured.

This can differ from the overall study sample.

**Examples:**

- all households in randomized communities,

- households in flooded villages only,

- registered chatbot users,

- complaints submitted in a given period,

- officials in participating agencies,

- applicants flagged by the algorithm.

**Keywords / cues:**

analysis sample, respondents, users, flagged cases, subgroup, period

## **7. Comparison**

**Definition:**

What the reported result is compared against.

**Possible answers:**

- Treatment vs control (randomized)

- Treatment A vs Treatment B (e.g., smartphone alerts only vs alerts plus community volunteers)

- AI-supported process vs manual process

- AI vs human official

- Before vs after deployment

- Users vs non-users

- AI output vs ground truth (accuracy; no comparison arm)

- Subgroup A vs subgroup B

- No comparison / descriptive outcome

**Example:**

Households in panchayats randomized to community-volunteer dissemination of flood alerts vs households in control panchayats.

**Keywords / cues:**

compared with, relative to, control, baseline, manual process, difference, treatment effect

## **8. Result Value**

**Definition:**

Main numerical estimate reported for the outcome.

Record the number only where practical.

**Examples:**

- 100000000

- 0.12

- -3.5

- 87

- 1754

Do not include units in this field.

If several estimates are reported, use the principal specification and explain alternatives in Result Notes.

**Keywords / cues:**

coefficient, effect, treatment effect, estimate, mean difference, count

## **9. Result Unit**

**Definition:**

Unit corresponding to the result value.

**Possible answers:**

- percent

- percentage points

- proportion

- count (e.g., alerts, queries, users, agencies)

- SD

- days

- hours

- minutes

- index points

- odds ratio

- currency

- other

**Example:**

count (alerts sent)

Do not confuse percentage points with percent.

## **10. Result Interpretation**

**Definition:**

Short plain-language description of the quantitative result.

**Example:**

During the 2021 monsoon season, the flood warning system operating in India and Bangladesh sent more than 100 million alerts to affected populations, authorities, and emergency organizations.

Keep this factual and concise.

Do not add causal interpretation beyond what the study design and authors support.

## **11. Standard Error / Confidence Interval**

**Definition:**

Uncertainty measure reported with the estimate.

**Intended answer:**

Report either:

- standard error,

- confidence interval,

- or both if available.

**Examples:**

- SE = 0.04

- 95% CI: 0.02 to 0.10

If not reported:

**NR**

**Keywords / cues:**

standard error, SE, confidence interval, CI

## **12. P-value / Statistical Significance**

**Definition:**

Reported p-value or significance information.

**Intended answer:**

Prefer exact p-value where available.

Examples:

- p = 0.03

- p \< 0.01

- statistically significant at 5%

- not statistically significant

- not applicable (descriptive count)

If significance is shown only through stars, report the implied threshold if clearly defined by the paper.

**Keywords / cues:**

p-value, significance, \*, **,** \*

## **13. Measurement Timing**

**Definition:**

When the outcome was measured relative to the intervention.

**Possible answers:**

- During the flood season (midline)

- After the flood season (endline)

- First 30 days after launch

- Calendar year of operation

- 12 months after deployment

- Multi-year follow-up

**Keywords / cues:**

midline, endline, follow-up, season, after launch, months later

## **14. Subgroup**

**Definition:**

Whether the reported outcome applies to a specific subgroup rather than the full sample.

**Possible answers:**

- Full sample

- Women

- Men

- Households without smartphones

- Low-literacy users

- Remote villages

- Flood-affected households

- Socially disadvantaged groups

- Other

If full sample:

**Full sample**

**Keywords / cues:**

heterogeneous effects, subgroup, by gender, by literacy, by phone ownership, disadvantaged

## **15. Actual vs Intended Usage**

Use this field **only for Adoption, Usage, or Access / Reach outcomes**.

**Definition:**

Clarifies whether the result refers to:

- planned access,

- message or alert sent,

- message or alert received,

- initial adoption,

- actual use,

- sustained use.

**Possible answers:**

- Offered access

- Sent / delivered

- Received

- Activated tool

- Used at least once

- Repeat use

- Average usage

- Sustained usage

**Example:**

Sent / delivered: more than 100 million flood alerts sent in 2021 (system records); receipt by households not measured in this source.

This field is useful because "offered access" or "sent" is not the same as "actually received" or "actually used."

## **16. Result Notes**

**Definition:**

Short clarification needed to interpret the outcome correctly.

Use for:

- alternative specifications,

- important denominator definitions (e.g., all households vs smartphone owners),

- multiple related estimates,

- whether result is ITT or treatment-on-treated,

- whether result comes from platform logs, administrative records, surveys, or official statements,

- whether figures are self-reported by the agency or developer, or independently verified,

- any ambiguity.

**Example:**

Figure from a government presentation; not independently verified; baseline call duration and measurement period not reported.

Do not use this field for general paper commentary.

# **Special coding rules**

## **Adoption vs Usage**

Do not combine them automatically.

**Adoption** answers:

> Did the intended user begin using the tool?

**Usage** answers:

> How much or how often did the user actually use it?

Example:

- Number of farmers who sent a first query → Adoption

- Total queries per farmer per month → Usage

## **Sent vs received vs acted upon**

For alerts, notifications, and information services, record each step as a separate row when reported.

Example:

- alerts sent to an area → Access / Reach (Sent / delivered)

- households reporting that they received an alert → Access / Reach (Received)

- households that took protective action → Citizen Behaviour / Response

- household losses after the flood → Welfare / Socioeconomic Outcome

## **Access vs Usage**

Do not treat being offered access as actual usage.

Example:

- service launched in 10 languages for 5 million potential users → access

- 50,000 users sent at least one message → adoption

- average 4 messages per user per month → usage

## **Model accuracy vs impact**

If an AI system forecasts floods, classifies complaints, or predicts eligibility accurately, record this as Accuracy / Technical Performance or Targeting / Eligibility Accuracy.

Do not treat accuracy as equivalent to reduced losses, faster resolution, or better targeting outcomes. If the study measures those, create separate outcome rows.

## **Targeting errors**

Record inclusion error and exclusion error as **separate rows**, and state in Result Notes the benchmark used to define true eligibility (e.g., consumption survey, field verification) and the denominator.

Record documented cases of wrongful exclusion as Errors / Harms, even when the source does not report an error rate.

## **Queries answered vs problems solved**

Chatbot query counts are Usage; correctness of answers is Accuracy / Technical Performance; obtaining the benefit or service is Service Uptake / Benefit Receipt. Do not merge these.

## **Closed vs resolved**

For complaint and service-request platforms, record agency-reported case closure as Timeliness / Efficiency and citizen-confirmed resolution or satisfaction as Trust / Satisfaction / Accountability. Note in Result Notes how closure was verified, since agency self-reported closure can be inaccurate.

## **Official and developer claims**

Figures that come only from government announcements, developer reports, or press releases must be coded with "self-reported, not independently verified" in Result Notes. Keep them, but do not mix them with independently evaluated estimates in the same row.

## **Multiple services or sectors**

If a study separately reports outcomes for different services (e.g., agricultural advice and scheme information), create separate rows.

Example:

| **Outcome Domain** | **Outcome Name**                     |
|--------------------|--------------------------------------|
| Usage              | Weekly queries on crop advice        |
| Usage              | Weekly queries on government schemes |

## **Multiple time periods**

If the same outcome is measured at different points (e.g., midline during the flood season and endline after it, or across several seasons), create separate rows when the distinction is important.

Example:

- Alert receipt at midline (flood season)

- Alert receipt at endline (after flood season)

# **Output format**

Return one table with **one row per distinct outcome**.

Study / Source

AI Tool / Program

Outcome Domain

Outcome Name

Outcome Measure

Population / Sample for Outcome

Comparison

Result Value

Result Unit

Result Interpretation

Standard Error / Confidence Interval

P-value / Statistical Significance

Measurement Timing

Subgroup

Actual vs Intended Usage

Result Notes

Do not merge several substantively different outcomes into one row.
