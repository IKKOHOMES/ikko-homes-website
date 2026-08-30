import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isDocumentAdministrator } from "./auth.ts";

Deno.test("treats only an explicit admin role as document-administrator access", () => {
  assertEquals(isDocumentAdministrator({ id: "customer-1", role: "customer" }), false);
  assertEquals(isDocumentAdministrator({ id: "legacy-profile" }), false);
  assertEquals(isDocumentAdministrator({ id: "admin-1", role: "admin" }), true);
});