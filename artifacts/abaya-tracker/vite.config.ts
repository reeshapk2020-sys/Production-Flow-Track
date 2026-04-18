import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Use standard __dirname or import.meta.dirname
const projectRoot = path.resolve(__dirname);

export default defineConfig({
  // Ensure the base path defaults to root for Vercel
  base: "/",
  
  plugins: [
    react(),
    tailwindcss(),
  ],
  
  resolve: {
    alias: {
      // Direct alias to your src folder
      "@": path.resolve(projectRoot, "src"),
    },
    // Prevents version conflicts between workspace packages
    dedupe: ["react", "react-dom"],
  },

  // Set the root to where this config file sits
  root: projectRoot,

  build: {
    // Vercel works best with a standard 'dist' output directory
    outDir: "dist",
    emptyOutDir: true,
    // Disabling sourcemaps fixes the 'Can't resolve original location' warning
    sourcemap: false,
    // Ensures clean chunking for production
    minify: "esbuild",
  },

  server: {
    // Vercel doesn't use these, but keeping them safe for local dev
    port: 5173,
    host: "0.0.0.0",
  },
});
