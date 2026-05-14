/**
 * Agentic scaffold routes.
 *
 * Surface:
 *   POST /api/agents/call         — submit a prompt; returns { jobId, status: "PENDING" } immediately.
 *                                   Background process dispatches to the agentic service with a callback URL.
 *   POST /api/agents/callback/:id — webhook hit by the agentic service on completion. NOT for app code to call.
 *                                   Persists DONE/ERROR + payload to Mongo. Extension point for notifications,
 *                                   downstream workflows, audit, etc.
 *   GET  /api/agents/list         — list recent jobs, most recent first.
 *
 * The job record (see `agent-job.model.ts`) is the source of truth for everything
 * else. Read directly from Mongo for history, dashboards, admin views.
 */

import { createHash, randomUUID } from "node:crypto";
import axios, { AxiosError } from "axios";
import { Router, type Request, type Response } from "express";
import { createLogger } from "~/lib/logger";
import { AgentJobModel } from "./agent-job.model";

const logger = createLogger("AgentsRoutes");
const router = Router();

// Single deployed instance for all environments. If this ever needs to vary,
// promote to an env var, but the convention right now is one global service.
const AGENTIC_SERVICE_URL = "https://api-micro-agentic.quantumbyte.ai";

const REPLY_SCHEMA = {
  type: "object",
  properties: { reply: { type: "string" } },
  required: ["reply"],
  additionalProperties: false,
};

function keyspace() {
  return process.env.VITE_KEYSPACE ?? "";
}

function authHeaders(): Record<string, string> {
  const auth = process.env.QB_SCAFFOLDER_KEY;
  return auth ? { Authentication: auth } : {};
}

function publicBaseUrl(req: Request): string {
  // Honor X-Forwarded-Proto when the host app sits behind a TLS-terminating
  // proxy. Falls back to req.protocol for direct-bind dev setups.
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto =
    typeof forwardedProto === "string" && forwardedProto.length > 0
      ? forwardedProto.split(",")[0].trim()
      : req.protocol;
  return `${proto}://${req.get("host")}`;
}

function dedupeKey(ks: string, prompt: string): string {
  return createHash("sha256").update(`${ks} ${prompt}`).digest("hex").slice(0, 32);
}

router.post("/agents/call", async (req: Request, res: Response) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "";
  if (!prompt) {
    return res.status(400).json({ success: false, message: "prompt is required" });
  }

  const ks = keyspace();

  // Reuse an in-flight row for the same prompt. The agentic service dedupes
  // on idempotency-key = sha256(ks+prompt) and only ever fires one callback
  // (to the *first* submitter's URL+token). Without consumer-side dedupe,
  // a rapid duplicate submit would create a second row that the agentic
  // service's callback never reaches → orphaned PENDING.
  const existing = await AgentJobModel.findOne({
    prompt,
    status: "PENDING",
  })
    .sort({ createdAt: -1 })
    .lean();
  if (existing) {
    return res.status(202).json({
      success: true,
      data: { jobId: existing.jobId, status: "PENDING" },
    });
  }

  const jobId = randomUUID();
  const callbackToken = randomUUID();

  // Persist PENDING up-front so a fast-arriving callback can find the row.
  await AgentJobModel.create({
    jobId,
    prompt,
    status: "PENDING",
    callbackToken,
  });

  const callbackUrl = `${publicBaseUrl(req)}/api/agents/callback/${jobId}`;

  // Dispatch to the agentic service in the background. We don't await — the
  // caller gets PENDING immediately and learns the result via the callback.
  void (async () => {
    try {
      const dispatch = await axios.post(
        `${AGENTIC_SERVICE_URL}/api/call`,
        {
          prompt,
          schema: REPLY_SCHEMA,
          callback_url: callbackUrl,
          callback_token: callbackToken,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-id-keyspace": ks,
            "idempotency-key": dedupeKey(ks, prompt),
            ...authHeaders(),
          },
          timeout: 30_000,
        },
      );
      await AgentJobModel.updateOne(
        { jobId },
        { $set: { remoteJobId: dispatch.data?.job_id ?? null } },
      );
    } catch (error) {
      const ax = error as AxiosError<{ detail?: string }>;
      const message = ax.response?.data?.detail ?? ax.message ?? "Agent dispatch failed";
      logger.error(`POST /api/call dispatch failed for ${jobId}`, error);
      await AgentJobModel.updateOne(
        { jobId },
        { $set: { status: "ERROR", error: message } },
      );
    }
  })();

  return res.status(202).json({
    success: true,
    data: { jobId, status: "PENDING" },
  });
});

router.post("/agents/callback/:id", async (req: Request, res: Response) => {
  const { id: jobId } = req.params;
  const job = await AgentJobModel.findOne({ jobId }).lean();
  if (!job) {
    return res.status(404).json({ success: false, message: "unknown job" });
  }

  const presentedToken = req.header("Authentication");
  if (!presentedToken || presentedToken !== job.callbackToken) {
    logger.warn(`callback auth failed for job ${jobId}`);
    return res.status(401).json({ success: false, message: "invalid callback token" });
  }

  // Idempotent: a retried callback (or a stray duplicate) on an already-
  // settled job is acknowledged but does not overwrite. The first callback
  // wins, period.
  if (job.status !== "PENDING") {
    return res.json({ success: true, idempotent: true });
  }

  const status = req.body?.status;
  if (status !== "DONE" && status !== "ERROR") {
    return res.status(400).json({ success: false, message: "status must be DONE or ERROR" });
  }

  const response = (req.body?.response ?? null) as Record<string, unknown> | null;
  const error = (req.body?.error ?? null) as string | null;

  await AgentJobModel.updateOne(
    { jobId },
    { $set: { status, response, error } },
  );

  return res.json({ success: true });
});

router.get("/agents/list", async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const skip = Math.max(Number(req.query.skip) || 0, 0);

  const [items, total] = await Promise.all([
    AgentJobModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AgentJobModel.countDocuments(),
  ]);

  return res.json({
    success: true,
    data: {
      items: items.map((job) => ({
        jobId: job.jobId,
        prompt: job.prompt,
        status: job.status,
        response: job.response,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      })),
      total,
      limit,
      skip,
    },
  });
});

export default router;
