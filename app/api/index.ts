// Import global routes
import routes from "./routes";
import { initializeModels } from "./models";

// Initialize models
await initializeModels();

export default routes;
