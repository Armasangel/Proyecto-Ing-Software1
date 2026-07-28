import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach } from "@jest/globals";

// jsdom doesn't provide fetch; polyfill from Node's built-in undici
const nodeFetch = require("node-fetch");
globalThis.fetch = nodeFetch;
globalThis.Headers = nodeFetch.Headers;
globalThis.Request = nodeFetch.Request;
globalThis.Response = nodeFetch.Response;

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
