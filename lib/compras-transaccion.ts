import type { PoolClient } from "pg";
import { pool } from "@/lib/db";

export async function transaccion<T>(fn: (client: PoolClient) => Promise<T>) {
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    const result=await fn(client);
    await client.query("COMMIT");
    return result;
  } catch(e) {await client.query("ROLLBACK");throw e;}
  finally {client.release();}
}
