import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isDocumentAdministrator, requireDocumentCaller } from "./auth.ts";

Deno.test("treats only an explicit admin role as document-administrator access", () => {
  assertEquals(isDocumentAdministrator({ id: "customer-1", role: "customer" }), false);
  assertEquals(isDocumentAdministrator({ id: "legacy-profile" }), false);
  assertEquals(isDocumentAdministrator({ id: "admin-1", role: "admin" }), true);
});
Deno.test("uses the verified bearer JWT, not the service role, for document RPC calls", async () => {
  const prior = {
    url: Deno.env.get("SUPABASE_URL"),
    anon: Deno.env.get("SUPABASE_ANON_KEY"),
    service: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    fetch: globalThis.fetch,
  };
  const requests: Array<{ url: string; headers: Headers }> = [];
  Deno.env.set("SUPABASE_URL", "https://documents.example.test");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-test-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push({ url: request.url, headers: request.headers });
    if (request.url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify({ id: "11111111-1111-4111-8111-111111111111" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({}), {
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const { callerClient } = await requireDocumentCaller(new Request("https://edge.example.test", {
      headers: { Authorization: "Bearer verified-customer-jwt" },
    }));
    await callerClient.rpc("load_authorised_order_document", {
      p_document_type: "quote", p_document_id: "11111111-1111-4111-8111-111111111111",
    });
    const rpc = requests.find((request) => request.url.includes("/rest/v1/rpc/load_authorised_order_document"));
    assertEquals(rpc?.headers.get("authorization"), "Bearer verified-customer-jwt");
    assertEquals(rpc?.headers.get("apikey"), "anon-test-key");
  } finally {
    globalThis.fetch = prior.fetch;
    for (const [key, value] of [["SUPABASE_URL", prior.url], ["SUPABASE_ANON_KEY", prior.anon], ["SUPABASE_SERVICE_ROLE_KEY", prior.service]] as const) {
      if (value === undefined) Deno.env.delete(key); else Deno.env.set(key, value);
    }
  }
});