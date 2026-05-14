import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createElement } from "react";
import type { FieldSchemaType } from "../schemas/configurables.schema";
import type { TDefaultConfigurableData } from "../constants/configurables.default";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfigurablesState {
  config: TDefaultConfigurableData;
  schema: FieldSchemaType[];
  loading: boolean;
  error: string | null;
}

interface ConfigurablesApiResponse {
  configurable_data: TDefaultConfigurableData;
  configurable_schema: FieldSchemaType[];
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ConfigurablesContext = createContext<ConfigurablesState | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface ConfigurablesProviderProps {
  children: ReactNode;
}

export function ConfigurablesProvider({ children }: ConfigurablesProviderProps) {
  const [config, setConfig] = useState<TDefaultConfigurableData>(
    {} as TDefaultConfigurableData,
  );
  const [schema, setSchema] = useState<FieldSchemaType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Prevent double-emit of READY in StrictMode double-invoke
  const readyEmittedRef = useRef(false);

  const emitReady = useCallback(() => {
    if (typeof window === "undefined") return;
    if (readyEmittedRef.current) return;
    readyEmittedRef.current = true;

    const isInIframe = window.parent !== window;
    console.log("[Configurables] Config loaded, emitting READY", {
      isInIframe,
      timestamp: Date.now(),
    });

    if (!isInIframe) return;
    window.parent.postMessage({ type: "QB_MIDDLE_EDITOR_READY" }, "*");
    console.log("[Configurables] QB_MIDDLE_EDITOR_READY sent to parent");
  }, []);

  useEffect(() => {
    let cancelled = false;

    // 1. Fetch initial config from the internal API endpoint
    async function fetchConfig() {
      try {
        console.log("[Configurables] Fetching /api/configurables...");
        const response = await fetch("/api/configurables");
        if (cancelled) return;

        if (!response.ok) {
          console.error("[Configurables] Fetch failed:", response.status);
          setError(`Failed to load configurables (${response.status})`);
          return;
        }

        const data: ConfigurablesApiResponse = await response.json();
        console.log("[Configurables] Fetch OK", {
          hasData: !!data.configurable_data,
          hasSchema: !!data.configurable_schema,
          schemaLength: data.configurable_schema?.length ?? 0,
        });

        if (data.configurable_data) {
          setConfig(data.configurable_data);
        }
        if (data.configurable_schema) {
          setSchema(data.configurable_schema);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[Configurables] Fetch error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load configurables",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
          // 2. Signal the portal that the app is ready to receive config updates
          emitReady();
        }
      }
    }

    // 3. Listen for live config updates sent by the portal (QB_MIDDLE_EDITOR_UPDATE)
    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== "QB_MIDDLE_EDITOR_UPDATE") return;
      const payload = event.data?.payload;
      console.log("[Configurables] Received QB_MIDDLE_EDITOR_UPDATE", {
        hasPayload: !!payload,
      });
      if (payload && typeof payload === "object") {
        setConfig(payload as TDefaultConfigurableData);
      }
    }

    fetchConfig();
    window.addEventListener("message", handleMessage);

    return () => {
      cancelled = true;
      window.removeEventListener("message", handleMessage);
    };
  }, [emitReady]);

  const value: ConfigurablesState = { config, schema, loading, error };

  return createElement(ConfigurablesContext.Provider, { value }, children);
}

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

/**
 * Returns the current configurable_data and schema for this app instance.
 *
 * - On mount, config is loaded from the app's own MongoDB via GET /api/configurables.
 * - While embedded in the portal, config updates arrive via postMessage
 *   (QB_MIDDLE_EDITOR_UPDATE) and are applied immediately, causing all consumers
 *   to re-render.
 * - Works standalone (outside iframe) — fetches from DB and skips postMessage.
 *
 * Must be used inside <ConfigurablesProvider>.
 */
export function useConfigurables(): ConfigurablesState {
  const ctx = useContext(ConfigurablesContext);
  if (ctx === null) {
    throw new Error(
      "useConfigurables must be used within <ConfigurablesProvider>",
    );
  }
  return ctx;
}
