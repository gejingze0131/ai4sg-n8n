// The vocabularies of the Extraction Skill and the pipeline, with the labels people read.
export const DOMAIN_TAGS: Record<string, string> = { healthcare: "Healthcare", public_service: "Public service", agriculture: "Agriculture", education: "Education", general: "All-domain runs" };
export const DOMAIN_COLOR: Record<string, string> = { healthcare: "#1baf7a", public_service: "#e34948", agriculture: "#eda100", education: "#2a78d6", general: "#8a8983" };
export const DOMAIN_ORDER = ["healthcare", "public_service", "agriculture", "education"];

export const LANG: Record<string, string> = { bn: "Bengali", hi: "Hindi", id: "Indonesian", th: "Thai", ta: "Tamil", ur: "Urdu", ne: "Nepali", en: "English", ms: "Malay", vi: "Vietnamese", si: "Sinhala", tl: "Filipino", km: "Khmer", sw: "Swahili", am: "Amharic" };
export const SUBJECT_DOMAIN: Record<string, string> = { health: "Health", agriculture_food: "Agriculture & food", education: "Education", financial_inclusion: "Financial inclusion", social_protection: "Social protection", water_sanitation: "Water & sanitation", climate_disaster: "Climate & disaster", gender: "Gender", public_services: "Public services", accessibility: "Accessibility", humanitarian: "Humanitarian", other: "Other" };
export const AI_ROLE: Record<string, string> = { information_only: "Information only (no decision)", assistive: "Assistive: a person decides", triage_prioritisation: "Triage / prioritisation", autonomous_decision: "Autonomous: AI output is the decision", unknown: "Not stated" };
export const GOV_ROLE: Record<string, string> = { none: "None", partner: "Partner", funder: "Funder", implementer: "Implementer", adopted: "Adopted / procured", regulator: "Regulator", unknown: "Not stated" };
export const DATA_SOURCE: Record<string, string> = { system_logs: "System logs", programme_records: "Programme records", independent_measurement: "Independent measurement", survey_self_report: "Survey / self-report", developer_or_government_claim: "Claim by developer or government", modelled: "Modelled", not_stated: "Not stated" };
export const DATABASE: Record<string, string> = { openalex: "OpenAlex", europepmc: "Europe PMC", eric: "ERIC", worldbank: "World Bank", aearct: "AEA RCT Registry", web: "Web search" };
export const RELATION: Record<string, string> = { cites: "cited by", cited_by: "citing", mentioned_in: "named in" };
export const STAGE: Record<string, string> = { idea: "Idea / announced", pilot: "Pilot", scaled: "Scaled", discontinued: "Discontinued", unknown: "Unknown" };
export const TECH: Record<string, string> = { computer_vision: "Computer vision", speech_nlp: "Speech & language", llm_chatbot: "LLM / chatbot", predictive_ml: "Predictive ML", remote_sensing: "Remote sensing", recommender_decision_support: "Decision support", robotics: "Robotics", other: "Other", unspecified: "Not specified" };
export const TIMELINE_STATUS: Record<string, string> = { planned: "Planned", ongoing: "Ongoing", completed: "Completed", discontinued: "Discontinued", unknown: "Unknown" };
export const COST_CATEGORY: Record<string, string> = { hardware_equipment: "Hardware & equipment", software_development: "Software development", data: "Data", staff_training: "Staff & training", operations_maintenance: "Operations & maintenance", research_evaluation: "Research & evaluation", total_budget: "Total budget", other: "Other" };
export const EVIDENCE: [string, string][] = [["rct", "RCT"], ["quasi_experimental", "Quasi-experimental"], ["observational", "Observational"], ["pilot_report", "Pilot report"], ["anecdotal", "Anecdotal"], ["none", "None"]];
export const EVIDENCE_LABEL: Record<string, string> = Object.fromEntries(EVIDENCE);
export const SOURCE_TYPE: Record<string, string> = { news: "News", gov_report: "Government report", gov_website: "Government website", journal: "Journal", conference_report: "Conference", open_source: "Open source", ngo_report: "NGO report", other: "Other" };
export const FLAGS: Record<string, [string, "bad" | "warn"]> = {
  quote_not_found: ["Quote not found in source", "bad"], cost_without_evidence: ["Cost figure not backed by a quote", "bad"], benefit_without_evidence: ["Benefit claim not backed by a quote", "bad"],
  no_text_extracted: ["Source text could not be read", "warn"], extraction_failed: ["AI extraction failed", "bad"], outcome_without_evidence: ["Outcome not backed by a found quote", "bad"], abstract_only: ["Only the abstract could be read", "warn"],
};
export const LEVEL: Record<string, string> = { country: "Country", admin1: "Region", admin2: "District", city: "City", site: "Site" };
export const SCOPE: Record<string, string> = { national: "Nationwide", multi_region: "Several regions", region: "One region", district: "District", city: "City", site: "Specific site", unknown: "" };
export const FILE_KIND: Record<string, string> = { main: "Page or document", full_text: "Full text", appendix: "Appendix", related_report: "Related report" };
export const LINK_METHOD: Record<string, string> = { organised: "grouped by the organiser", duplicate: "duplicate", new: "started the project", llm: "matched by AI", merged: "merged", manual: "placed by a reviewer", auto: "matched" };

export const SOURCE_STATES: Record<string, { label: string; help: string; api: string }> = {
  queued: { api: "queued", label: "Waiting in the queue", help: "Passed the screen but not chosen yet: with an analysis budget, GPT-6 Sol chooses from the whole queue the sources most worth analysing; the reason for each is shown." },
  duplicate: { api: "duplicate", label: "Duplicates", help: "The same document as another source (another address, a preprint, a reprint), found by the organiser: kept with its deployment, not analysed." },
  filtered: { api: "filtered", label: "Set aside by the screen", help: "GPT-6 Luna judged it not AI4SG, outside the domain, or below the relevance threshold." },
  download_failed: { api: "failed", label: "Could not be downloaded", help: "No readable text (blocked, bot check, unsupported file); it is tried again once in a later run." },
  not_screened: { api: "not_screened", label: "Not screened yet", help: "Downloaded or found, but the run stopped before the screen." },
  judged_out: { api: "judged", label: "Analysed: judged not AI4SG", help: "The in-depth analysis concluded it is not about an AI4SG project (shown for spot-checks)." },
  extraction_failed: { api: "extraction_failed", label: "Analysis failed", help: "The AI could not produce a structured result for this source." },
};
export const JOB_TYPE: Record<string, string> = { run: "Run", analyse: "Analysis", rescreen: "Re-screen", organise: "Organise", resummarise: "Project summaries", forget_run: "Take out a run" };
export const REVIEW_STATE: Record<string, string> = { awaiting: "Awaiting review", passed: "All sources passed", failed: "A source failed", none: "Not analysed" };

export const RUN_FORM = {
  domains: [["", "All domains"], ["healthcare", "Healthcare"], ["public_service", "Public service"], ["agriculture", "Agriculture"], ["education", "Education"]] as [string, string][],
  countries: ["Bangladesh", "India", "Indonesia", "Thailand"],
  languages: [["local", "Local language"], ["en", "English"]] as [string, string][],
  sourceTypes: [["news", "News"], ["gov_report", "Government reports (PDF)"], ["gov_website", "Government websites"], ["journal", "Journal papers"], ["conference_report", "Conference reports"], ["open_source", "Open-source code & data"]] as [string, string][],
  engines: [["codex", "Codex agent (multi-step, slower)"], ["api", "Single API call (fast)"]] as [string, string][],
  screens: [["broad", "Broad (0.4)"], ["balanced", "Balanced (0.6)"], ["strict", "Strict (0.8)"]] as [string, string][],
};

export const fmtNum = (n: unknown) => { const v = Number(n); return n !== null && n !== undefined && n !== "" && Number.isFinite(v) ? v.toLocaleString("en-US") : ""; };
export const langName = (c?: string | null) => (c ? LANG[c] || c.toUpperCase() : "—");
export const pretty = (v: unknown) => String(v ?? "").replace(/_/g, " ");
export const fmtDate = (d?: string | Date | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Singapore" }) : "");
export const fmtDateTime = (d?: string | Date | null) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Singapore" }) : "");
export const compact = (n: number) => (n >= 1e9 ? `${+(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : n.toLocaleString("en-US"));
