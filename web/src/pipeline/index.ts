import type { PipelineAdapter } from "./adapter";
import { n8nAdapter } from "./n8n";

export const pipeline: PipelineAdapter = n8nAdapter;
