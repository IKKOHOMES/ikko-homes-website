import { assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("persists invoice issued_at when a draft invoice is issued", async () => {
  const migration = await Deno.readTextFile(
    new URL("../../migrations/202608300005_invoice_issued_at.sql", import.meta.url),
  );

  assertMatch(migration, /add column if not exists issued_at timestamptz/i);
  assertMatch(migration, /before insert or update of status on public\.invoices/i);
  assertMatch(migration, /new\.issued_at := now\(\)/i);
});