import { useEffect, useRef, useState } from "react";
import { useConfigurables } from "~/modules/configurables";
import { submit, getList } from "@qb/agentic";
import type { AgentJobView } from "@qb/agentic";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

export default function ChatPage() {
  const { config, loading } = useConfigurables();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingJobs, setPendingJobs] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Poll for responses
  useEffect(() => {
    if (pendingJobs.size === 0) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await getList({ limit: 100 });
        const items = response.items || [];

        // Check which pending jobs have completed
        const updatedJobs = new Set(pendingJobs);
        let hasUpdates = false;

        items.forEach((job) => {
          if (!updatedJobs.has(job.jobId)) return;

          if (job.status === "DONE" && job.response && typeof job.response.reply === "string") {
            // Add assistant response
            const reply = job.response.reply;
            setMessages((prev) => [
              ...prev,
              {
                id: job.jobId,
                role: "assistant",
                text: reply,
                timestamp: Date.now(),
              },
            ]);
            updatedJobs.delete(job.jobId);
            hasUpdates = true;
          } else if (job.status === "ERROR") {
            // Add error response
            const errorMsg = job.error || "Failed to get a response";
            setMessages((prev) => [
              ...prev,
              {
                id: job.jobId,
                role: "assistant",
                text: `Error: ${errorMsg}`,
                timestamp: Date.now(),
              },
            ]);
            updatedJobs.delete(job.jobId);
            hasUpdates = true;
          }
        });

        if (hasUpdates) {
          setPendingJobs(updatedJobs);
        }
      } catch (error) {
        console.error("Failed to poll for responses:", error);
      }
    }, 500);

    return () => clearInterval(pollInterval);
  }, [pendingJobs]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      text: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const result = await submit(input);
      setPendingJobs((prev) => new Set([...prev, result.jobId]));
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          text: "Sorry, something went wrong. Please try again.",
          timestamp: Date.now(),
        },
      ]);
      console.error("Failed to submit message:", error);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500"></div>
          <p className="text-slate-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  const appName = config?.appName || "SimpleChat";
  const welcomeMessage =
    config?.welcomeMessage || "Hi! I'm here to help. What would you like to talk about?";
  const placeholderText = config?.placeholderText || "Type your message here...";

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <div
        className="border-b border-slate-200 px-4 py-4 shadow-sm"
        style={{
          backgroundColor: config?.brandColor?.primary || "#3b82f6",
        }}
      >
        <div className="flex items-center gap-3">
          {config?.logoUrl && (
            <img
              src={config.logoUrl}
              alt={appName}
              className="h-8 w-8 rounded-lg object-cover"
            />
          )}
          <div>
            <h1 className="text-lg font-bold text-white">{appName}</h1>
            <p className="text-xs text-blue-100">AI Assistant</p>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-sm text-center">
              <div
                className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full"
                style={{
                  backgroundColor: (config?.brandColor?.primary || "#3b82f6") + "20",
                }}
              >
                <span className="text-3xl">💬</span>
              </div>
              <p
                className="text-lg font-semibold"
                style={{ color: config?.brandColor?.primary || "#3b82f6" }}
              >
                {appName}
              </p>
              <p className="mt-2 text-slate-600">{welcomeMessage}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "bg-blue-500 text-white shadow-md"
                      : "bg-white text-slate-800 shadow-sm border border-slate-200"
                  }`}
                  style={
                    message.role === "user"
                      ? {
                          backgroundColor: config?.brandColor?.primary || "#3b82f6",
                        }
                      : {}
                  }
                >
                  {message.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm border border-slate-200">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400"></div>
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-200 bg-white px-4 py-4 shadow-lg">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholderText}
            disabled={isLoading}
            className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm outline-none placeholder-slate-400 transition-colors disabled:bg-slate-50 disabled:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
            style={{
              borderColor: "currentColor",
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="h-10 w-10 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-white font-semibold hover:shadow-md active:scale-95"
            style={{
              backgroundColor: config?.brandColor?.accent || "#0ea5e9",
            }}
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            ) : (
              "→"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
