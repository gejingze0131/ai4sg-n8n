// The only interface the website has to the processing engine. Today n8n (./n8n.ts); to move to another queue or service,
// write another implementation of this and change ./index.ts.
export type RunSettings = {
  domain: string; countries: string[]; other_countries?: string; languages: string[]; source_types: string[];
  topic_focus?: string; since_year?: number | null; engine: "codex" | "api"; max_searches: number; results_per_search: number;
  max_analyse?: number | null; screen_level: "broad" | "balanced" | "strict";
};

export interface PipelineAdapter {
  startRun(jobId: string, settings: RunSettings): Promise<void>;
  analyse(jobId: string, sourceIds: number[], requester: string): Promise<void>;
  rescreen(jobId: string, domain: string, limit: number, minRelevance: number): Promise<void>;
  organise(jobId: string, domain: string, max: number, analyse: boolean): Promise<void>;
  resummarise(jobId: string, projectIds: number[]): Promise<void>;
  /** moves the run's downloaded files to the archive; the database side is ai4sg_forget_run */
  forgetRun(jobId: string, runId: number, sourceIds: number[]): Promise<{ moved: number }>;
  /** a stored copy of a source (`name` = a file in its manifest, or "text") */
  readFile(sourceId: number, name: string): Promise<Response>;
}
