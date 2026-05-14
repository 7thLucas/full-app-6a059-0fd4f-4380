import { apiGet, apiRequest } from "~/lib/api.client";
import type { AgentJobStatus } from "./agent-job.model";

export interface AgentJobView {
  jobId: string;
  prompt: string;
  status: AgentJobStatus;
  response: { reply?: string } | Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SubmitResponse {
  jobId: string;
  status: "PENDING";
}

interface ListResponse {
  items: AgentJobView[];
  total: number;
  limit: number;
  skip: number;
}

/**
 * Fire-and-forget submit. Returns the new jobId immediately. The result lands
 * in the database asynchronously when the microplatform's callback fires; read
 * it from the list (or from `AgentJobModel` server-side) when you need it.
 */
export async function submit(prompt: string): Promise<{ jobId: string }> {
  const res = await apiRequest<SubmitResponse>("/api/agents/call", {
    method: "POST",
    data: { prompt },
  });
  if (!res.success || !res.data?.jobId) {
    throw new Error(res.message ?? "Failed to submit agent call");
  }
  return { jobId: res.data.jobId };
}

/**
 * Read the agent-job list (most recent first) for the current keyspace.
 * The page lives in the database; submission and result are decoupled.
 */
export async function getList(
  options: { limit?: number; skip?: number } = {},
): Promise<ListResponse> {
  const params: Record<string, string> = {};
  if (options.limit != null) params.limit = String(options.limit);
  if (options.skip != null) params.skip = String(options.skip);

  const res = await apiGet<ListResponse>("/api/agents/list", params);
  if (!res.success || !res.data) {
    throw new Error(res.message ?? "Failed to load agent jobs");
  }
  return res.data;
}
