import { z } from "zod";

// One definition per request body, used by the routes and the forms.
export const registerBody = z.object({
  email: z.email().max(200),
  password: z.string().min(8, "at least 8 characters").max(200),
  name: z.string().trim().min(1).max(100),
  role: z.string(),
});
export const loginBody = z.object({ email: z.email(), password: z.string().min(1).max(200) });

export const reviewBody = z.object({ source_id: z.number().int().positive(), decision: z.enum(["approved", "rejected"]), comment: z.string().max(2000).optional().default("") });
export const analyseBody = z.object({ source_ids: z.array(z.number().int().positive()).min(1).max(30, "at most 30 sources at a time") });
const projectCode = z.string().trim().toUpperCase().regex(/^P-\d{5}$/, "must look like P-00012");
export const moveBody = z.object({ source_id: z.number().int().positive(), target: projectCode });
export const detachBody = z.object({ source_id: z.number().int().positive() });
export const mergeBody = z.object({ project: projectCode, target: projectCode }).refine((b) => b.project !== b.target, "a project cannot be merged into itself");

const domain = z.enum(["", "healthcare", "public_service", "agriculture", "education"]);
export const runBody = z.object({
  domain,
  countries: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  other_countries: z.string().trim().max(300).optional().default(""),
  languages: z.array(z.enum(["local", "en"])).min(1, "choose at least one language"),
  source_types: z.array(z.enum(["news", "gov_report", "gov_website", "journal", "conference_report", "open_source"])).min(1, "choose at least one source type"),
  topic_focus: z.string().trim().max(300).optional().default(""),
  since_year: z.number().int().min(1990).max(2100).nullable().optional(),
  engine: z.enum(["codex", "api"]),
  max_searches: z.number().int().min(1).max(200),
  results_per_search: z.number().int().min(1).max(100),
  max_analyse: z.number().int().min(0).max(1000).nullable().optional(),
  screen_level: z.enum(["broad", "balanced", "strict"]),
}).refine((b) => b.countries.length > 0 || b.other_countries.length > 0, "choose at least one country");
export const rescreenBody = z.object({ domain, limit: z.number().int().min(1).max(300), min_relevance: z.number().min(0).max(1).optional().default(0.6) });
export const organiseBody = z.object({ domain, max: z.number().int().min(0).max(1000), analyse: z.boolean() });
export const userPatchBody = z.object({ role: z.enum(["visitor", "expert", "admin"]).optional(), approved: z.boolean().optional() }).refine((b) => b.role !== undefined || b.approved !== undefined, "nothing to change");
export const internalJobBody = z.object({ status: z.enum(["running", "done", "failed"]), execution_id: z.union([z.string(), z.number()]).optional(), result: z.unknown().optional(), error: z.string().max(4000).optional() });
