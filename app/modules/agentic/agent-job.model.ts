import mongoose, { type Document, type Model, Schema } from "mongoose";

export type AgentJobStatus = "PENDING" | "DONE" | "ERROR";

export interface AgentJob extends Document {
  jobId: string;
  prompt: string;
  status: AgentJobStatus;
  response: Record<string, unknown> | null;
  error: string | null;
  callbackToken: string;
  remoteJobId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const AgentJobSchema = new Schema<AgentJob>(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    prompt: { type: String, required: true },
    status: {
      type: String,
      enum: ["PENDING", "DONE", "ERROR"],
      default: "PENDING",
      required: true,
    },
    response: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
    callbackToken: { type: String, required: true },
    remoteJobId: { type: String, default: null },
  },
  { timestamps: true },
);

export const AgentJobModel: Model<AgentJob> =
  (mongoose.models.AgentJob as Model<AgentJob>) ||
  mongoose.model<AgentJob>("AgentJob", AgentJobSchema);
