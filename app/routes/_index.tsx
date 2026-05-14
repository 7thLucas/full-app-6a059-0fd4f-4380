import { useConfigurables } from "~/modules/configurables";

export default function IndexPage() {
  const { config, loading } = useConfigurables();

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Base Template : {loading ? "Loading..." : config.appName ?? "Untitled App"}</h1>
      <p>Add your routes and pages here.</p>
    </div>
  );
}
