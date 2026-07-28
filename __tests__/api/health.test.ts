import { GET } from "@/app/api/health/route";
import { createMockRequest } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };

describe("GET /api/health", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 200 with connection info on success", async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ hora_servidor: "2026-07-28T12:00:00Z", base_de_datos: "test_db" }],
    });
    const req = createMockRequest("/api/health");
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.base_de_datos).toBe("test_db");
    expect(data.hora_servidor).toBe("2026-07-28T12:00:00Z");
  });

  it("returns 500 with error detail on DB failure", async () => {
    mockPool.query.mockRejectedValue(new Error("connection refused"));
    const req = createMockRequest("/api/health");
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(500);
    expect(data.status).toBe("error");
    expect(data.detalle).toContain("connection refused");
  });
});
