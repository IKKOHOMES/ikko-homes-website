import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { loadQuotePdfInput } from "./index.ts";

Deno.test("uses the order payment schedule when a revision links immutable instalments to an earlier quote", async () => {
  const quote = {
    id: "quote-v2", version: 2, quote_number: null, quote_number_source_id: "quote-v1",
    total: 1000, subtotal: 909.09, discount_total: 0, gst_total: 90.91,
    expires_on: "2026-10-01", created_at: "2026-08-31", order_id: "order-1",
    quote_lines: [{ display_name: "Kitchen", unit_price: 1000, quantity: 1, is_tbd: false }],
    orders: { order_number: "ORDER-1", customers: { first_name: "Aiko", last_name: "Tanaka", email: "aiko@example.com", phone: "0400", address: "1 Studio Lane", auth_user_id: "user-1" } },
  };
  const instalments = [
    { label: "Deposit", percentage: 50, amount: 500, due_on: "2026-09-01", status: "paid" },
    { label: "Balance", percentage: 50, amount: 500, due_on: "2026-10-01", status: "draft" },
  ];
  const admin = {
    from: (table: string) => {
      if (table === "quotes") return { select: () => ({ eq: () => ({ single: async () => ({ data: quote, error: null }) }) }) };
      if (table === "payment_plan_instalments") return { select: () => ({ eq: () => ({ order: async () => ({ data: instalments, error: null }) }) }) };
      if (table === "site_settings") return { select: () => ({ eq: () => ({ single: async () => ({ data: { studio_address: "Studio", studio_email: "studio@example.com", studio_phone: "0401" }, error: null }) }) }) };
      throw new Error(`Unexpected table ${table}`);
    },
    rpc: async (name: string) => {
      assertEquals(name, "ensure_quote_number");
      return { data: "IKKO2026080001", error: null };
    },
  } as never;

  const loaded = await loadQuotePdfInput(admin, "quote-v2");

  assertEquals(loaded.input.number, "IKKO2026080001");
  assertEquals(loaded.input.paymentSchedule?.map((line) => line.description), ["Deposit", "Balance"]);
});
