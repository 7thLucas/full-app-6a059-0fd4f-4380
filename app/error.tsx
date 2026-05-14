import React, { useState } from "react";
import {
  AlertTriangle,
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
  RefreshCcw,
  LifeBuoy,
} from "lucide-react";
import { cn } from "~/lib/utils";

export interface GlobalErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  error: unknown;
  cardClassName?: string;
}

export function GlobalError({
  error,
  className,
  cardClassName,
  ...props
}: GlobalErrorProps) {
  const [showLog, setShowLog] = useState(false);

  let errorMessage = "Unknown Error";
  let errorStack = "";
  let errorStatus = "";

  if (error instanceof Error) {
    errorMessage = error.message;
    errorStack = error.stack || "";
  } else if (typeof error === "string") {
    errorMessage = error;
  } else if (error && typeof error === "object" && "statusText" in error) {
    // Handling Remix's ErrorResponse
    errorMessage = (error as any).statusText || "Routing Error";
    errorStatus = (error as any).status ? `${(error as any).status} ` : "";
    errorStack = JSON.stringify(error, null, 2);
  } else {
    errorStack = JSON.stringify(error, null, 2);
  }

  const handleDownloadLog = () => {
    const logContent = `Status: ${errorStatus}\nError Message: ${errorMessage}\n\nDetails:\n${errorStack}`;
    const blob = new Blob([logContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `error_log_${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={cn(
        "min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100",
          cardClassName,
        )}
      >
        <div className="bg-red-50 p-8 flex flex-col md:flex-row items-start md:items-center gap-6 border-b border-red-100 relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-red-100 rounded-full opacity-50 blur-2xl"></div>

          <div className="bg-red-100 p-4 rounded-full shadow-sm relative z-10">
            <AlertTriangle className="w-10 h-10 text-red-600" />
          </div>
          <div className="relative z-10">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Oops! It's okay.
            </h1>
            <p className="text-slate-600 mt-2 text-lg">
              Something went a little off, but don't worry, we can get you back
              on track.
            </p>
          </div>
        </div>

        <div className="p-8">
          <div className="mb-8 space-y-4">
            <div className="flex gap-4 items-start p-4 bg-slate-100 rounded-xl border border-slate-200 shadow-sm">
              <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-200 mt-0.5">
                <RefreshCcw className="w-5 h-5 text-slate-500" />
              </div>
              <div>
                <h3 className="font-medium text-slate-900 mb-1">Quick Fix</h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  You can try refreshing the app or page to see if that gets
                  things working again.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start p-4 bg-blue-50 rounded-xl border border-blue-200 shadow-sm">
              <div className="bg-white p-2 rounded-lg shadow-sm border border-blue-200 mt-0.5">
                <LifeBuoy className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-medium text-blue-900 mb-1">
                  Need more help?
                </h3>
                <p className="text-blue-700/80 text-sm leading-relaxed">
                  If you're still stuck, we've got your back. Try chatting with
                  our agent or contact our customer service for support. We're
                  here to help!
                </p>
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button
              onClick={() => setShowLog(!showLog)}
              className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors focus:outline-none"
            >
              <div className="flex items-center gap-3 text-slate-700 font-medium">
                <FileText className="w-5 h-5 text-slate-500" />
                View Error Details
              </div>
              {showLog ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>

            <div
              className={`transition-all duration-300 ease-in-out ${showLog ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"} overflow-hidden`}
            >
              <div className="p-5 bg-slate-900 text-slate-300 font-mono text-sm overflow-y-auto max-h-[400px]">
                <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
                  <div className="text-red-400 font-bold flex items-center gap-2">
                    {errorStatus && (
                      <span className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded">
                        {errorStatus}
                      </span>
                    )}
                    {errorMessage}
                  </div>
                  <button
                    onClick={handleDownloadLog}
                    className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg transition-colors border border-slate-700 hover:border-slate-600"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                </div>
                <pre className="whitespace-pre-wrap break-words leading-relaxed">
                  {errorStack}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
