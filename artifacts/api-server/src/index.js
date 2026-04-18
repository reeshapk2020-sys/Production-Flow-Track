import app from "../api-server/src/app.js";  // Adjust path to your app
import { initializeAdminOnStartup } from "../api-server/src/init.js";

// Initialize admin user (will run once per cold start)
await initializeAdminOnStartup();

// Export the Express app for Vercel serverless functions
export default app;
