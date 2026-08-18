import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach } from "@jest/globals";

// jsdom doesn't provide fetch; polyfill from Node's built-in undici
const nodeFetch = require("node-fetch");
const origFetch = nodeFetch;
globalThis.fetch = (input: any, init?: any) => {
  if (typeof input === "string" && input.startsWith("/")) {
    input = `http://localhost${input}`;
  } else if (input?.url && typeof input.url === "string" && input.url.startsWith("/")) {
    input = new Request(`http://localhost${input.url}`, input);
  }
  return origFetch(input, init);
};
globalThis.Headers = nodeFetch.Headers;
globalThis.Request = nodeFetch.Request;
globalThis.Response = nodeFetch.Response;

// Garantiza un JWT_SECRET válido (>= 32 caracteres) en todos los tests,
// incluso si otro archivo de tests lo borró o sobrescribió antes.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests-0123456789";
}

// Next.js NextResponse.json relies on Response.json static method
if (typeof globalThis.Response.json !== "function") {
  (globalThis.Response as any).json = (body: any, init?: any) => {
    return new globalThis.Response(JSON.stringify(body), {
      ...init,
      headers: { "content-type": "application/json" },
    });
  };
}

afterEach(() => {
  cleanup();
});
