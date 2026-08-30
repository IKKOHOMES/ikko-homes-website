import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertEquals, assertRejects, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertDocumentAccess,
  assertInvoiceDocumentLifecycle,
  loadAuthorisedOrderDocument,
  loadInvoicePdfInput,
  loadQuotePdfInput,
} from "./index.ts";

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
    quote_lines: [{ display_name: "Joinery", unit_price: 1000, quantity: 1, is_tbd: false }],
    payment_plan_instalments: [],
    orders: {
      order_number: "ORD-1001",
      customers: {
        first_name: "Zebin", last_name: "Hu", email: "client@example.com",
        phone: "0400 000 000", address: "69 Patricia Loop", auth_user_id: "customer-1",
      },
    },
  };
  const admin = {
    from(table: string) {
      if (table === "quotes") return { select: () => ({ eq: () => ({ single: async () => ({ data: quote, error: null }) }) }) };
      if (table === "payment_plan_instalments") return { select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) };
      return { select: () => ({ eq: () => ({ single: async () => ({ data: {
        studio_address: "69 Patricia Loop", studio_email: "accounts@ikkohomes.com", studio_phone: "0490 384 021",
      }, error: null }) }) }) };
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

Deno.test("allows a customer to access their own order document", () => {
  assertDocumentAccess({ id: "customer-1", isAdmin: false }, { customerAuthUserId: "customer-1" });
});

Deno.test("denies a customer access to another customer's order document", () => {
  assertThrows(
    () => assertDocumentAccess({ id: "customer-1", isAdmin: false }, { customerAuthUserId: "customer-2" }),
    Error,
    "Unauthorised.",
  );
});

Deno.test("authorises ownership before loading a legacy quote or allocating its number", async () => {
  let quoteSelects = 0;
  let numberAllocations = 0;
  const admin = {
    from(table: string) {
      assertEquals(table, "quotes");
      return {
        select: () => {
          quoteSelects += 1;
          return {
            eq: () => ({
              single: async () => ({
                data: { orders: { customers: { auth_user_id: "customer-2" } } },
                error: null,
              }),
            }),
          };
        },
      };
    },
    rpc: async () => {
      numberAllocations += 1;
      return { data: "IKKO2026080042", error: null };
    },
  } as unknown as SupabaseClient;

  await assertRejects(
    () => loadAuthorisedOrderDocument(
      { id: "customer-1", isAdmin: false },
      "quote",
      "quote-1",
      admin,
    ),
    Error,
    "Unauthorised.",
  );
  assertEquals(quoteSelects, 1);
  assertEquals(numberAllocations, 0);
});
Deno.test("allows an explicit administrator to access any order document", () => {
  assertDocumentAccess({ id: "admin-1", isAdmin: true }, { customerAuthUserId: "customer-1" });
});

Deno.test("denies document generation for a draft invoice", () => {
  assertThrows(
    () => assertInvoiceDocumentLifecycle("draft"),
    Error,
    "Only issued or paid invoices can be downloaded or emailed.",
  );
});

Deno.test("denies document generation for a void invoice", () => {
  assertThrows(
    () => assertInvoiceDocumentLifecycle("void"),
    Error,
    "Only issued or paid invoices can be downloaded or emailed.",
  );
});

Deno.test("allows document generation for issued and paid invoices", () => {
  assertInvoiceDocumentLifecycle("issued");
  assertInvoiceDocumentLifecycle("paid");
});

Deno.test("uses the invoice issuance timestamp as the PDF issue date", async () => {
  const invoice = {
    id: "invoice-1", order_id: "order-1", invoice_number: "IKKO-1001", total: 1100,
    status: "issued", due_on: "2026-10-01", created_at: "2026-08-01T00:00:00.000Z",
    issued_at: "2026-09-15T10:30:00.000Z", customer_name: "Aiko Tanaka",
    customer_email: "aiko@example.com", customer_address: "1 Studio Lane", invoice_lines: [],
    payment_plan_instalments: null,
    orders: { order_number: "ORD-1001", customers: { phone: "0400 000 000", auth_user_id: "customer-1" } },
  };
  const admin = {
    from(table: string) {
      const data = table === "invoices" ? invoice : {
        studio_address: "69 Patricia Loop", studio_email: "accounts@ikkohomes.com", studio_phone: "0490 384 021",
      };
      return { select: () => ({ eq: () => ({ single: async () => ({ data, error: null }) }) }) };
    },
  } as unknown as SupabaseClient;

  const loaded = await loadInvoicePdfInput(admin, "invoice-1");
  assertEquals(loaded.input.issuedOn, invoice.issued_at);
});