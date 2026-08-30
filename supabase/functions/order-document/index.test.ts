import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { loadQuotePdfInput } from "./index.ts";

Deno.test("uses an allocated quote number for a legacy quote PDF input", async () => {
  const quote = {
    id: "quote-1",
    version: 2,
    quote_number: "",
    total: 1100,
    subtotal: 1000,
    discount_total: 0,
    gst_total: 100,
    expires_on: "2026-09-30",
    created_at: "2026-08-30",
    order_id: "order-1",
    quote_lines: [{
      display_name: "Joinery",
      unit_price: 1000,
      quantity: 1,
      is_tbd: false,
    }],
    payment_plan_instalments: [],
    orders: {
      order_number: "ORD-1001",
      customers: {
        first_name: "Zebin",
        last_name: "Hu",
        email: "client@example.com",
        phone: "0400 000 000",
        address: "69 Patricia Loop",
      },
    },
  };
  const admin = {
    from(table: string) {
      const data = table === "quotes" ? quote : {
        studio_address: "69 Patricia Loop",
        studio_email: "accounts@ikkohomes.com",
        studio_phone: "0490 384 021",
      };
      return {
        select: () => ({
          eq: () => ({ single: async () => ({ data, error: null }) }),
        }),
      };
    },
    rpc: async (name: string, params: Record<string, string>) => {
      assertEquals(name, "ensure_quote_number");
      assertEquals(params, { p_quote_id: "quote-1" });
      return { data: "IKKO2026080042", error: null };
    },
  } as unknown as SupabaseClient;

  const loaded = await loadQuotePdfInput(admin, "quote-1");
  assertEquals(loaded.input.number, "IKKO2026080042");
});
