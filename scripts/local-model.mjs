import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
const mode = process.argv[2] || "serve",
  model = process.env.SHOWFLOW_OLLAMA_MODEL || "qwen2.5:1.5b";
const models = path.resolve(".runtime/ollama-models");
await mkdir(models, { recursive: true });
const child = spawn(
  process.env.OLLAMA_BINARY || "ollama",
  mode === "pull" ? ["pull", model] : ["serve"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      OLLAMA_HOST: "127.0.0.1:11434",
      OLLAMA_MODELS: models,
      OLLAMA_NO_CLOUD: "1",
    },
  },
);
child.on("error", () => {
  console.error(
    "Ollama is not available. Install it from the official vendor first.",
  );
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code || 0;
});
