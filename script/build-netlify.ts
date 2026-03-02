import { build as viteBuild } from "vite";

async function buildNetlify() {
  console.log("Building frontend with Vite...");
  await viteBuild({
    configFile: "./vite.config.ts",
    mode: "production",
  });
  console.log("Frontend build complete! Output in dist/public");
  console.log("Netlify Functions will be bundled automatically by Netlify.");
}

buildNetlify().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
