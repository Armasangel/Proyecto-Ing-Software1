import { setupServer, SetupServerApi } from "msw/node";
import { handlers } from "./handlers";

let server: SetupServerApi | null = null;

export function createServer() {
  if (server) return server;
  server = setupServer(...handlers);
  return server;
}

export function getServer() {
  if (!server) throw new Error("MSW server not created. Call createServer() first.");
  return server;
}

export function setupTestServer() {
  const s = createServer();
  beforeAll(() => s.listen({ onUnhandledRequest: "bypass" }));
  afterEach(() => s.resetHandlers());
  afterAll(() => s.close());
  return s;
}
