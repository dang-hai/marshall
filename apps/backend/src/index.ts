import { createConfiguredBackendApp } from "./app";

function resolvePort(value?: string) {
  const port = Number.parseInt(value ?? "3000", 10);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`PORT must be a positive integer. Received "${value ?? ""}".`);
  }

  return port;
}

const port = resolvePort(process.env.PORT);
const app = createConfiguredBackendApp();

app.listen(port);

console.log(`Marshall backend listening on http://localhost:${port}`);
