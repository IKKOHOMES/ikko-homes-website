import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "./auth.ts";
import { buildOrderPdf, type OrderPdfInput } from "./pdf.ts";

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
type DocumentType = "quote" | "invoice";
type Action = "download" | "email";
type Payload = {
  action?: unknown;
  document_type?: unknown;
  document_id?: unknown;
};
type DocumentDeliveryInsert = {
  order_id: string;
  quote_id: string | null;
  invoice_id: string | null;
  document_type: DocumentType;
  recipient_email: string;
  sent_at: string | null;
  provider_message_id: string | null;
  outcome: "sent" | "failed";
  error_message: string | null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};
const asString = (value: unknown) => typeof value === "string" ? value : "";
const asNumber = (value: unknown) => Number(value ?? 0);
const asRows = (value: unknown) => Array.isArray(value) ? value : [];
const firstRow = (value: unknown) => Array.isArray(value) ? value[0] : value;

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary);
}

function parsePayload(
  payload: Payload,
): { action: Action; documentType: DocumentType; documentId: string } {
  if (
    (payload.action !== "download" && payload.action !== "email") ||
    (payload.document_type !== "quote" &&
      payload.document_type !== "invoice") ||
    typeof payload.document_id !== "string" || !payload.document_id
  ) {
    throw new Error("A document action, type and id are required.");
  }
  return {
    action: payload.action,
    documentType: payload.document_type,
    documentId: payload.document_id,
  };
}

async function studioDetails(admin: SupabaseClient) {
  const { data, error } = await admin.from("site_settings").select(
    "studio_address, studio_email, studio_phone",
  ).eq("id", true).single();
  if (error || !data) throw new Error("Unable to load studio details.");
  return {
    address: data.studio_address,
    email: data.studio_email,
    phone: data.studio_phone,
  };
}

async function loadQuotePdfInput(
  admin: SupabaseClient,
  quoteId: string,
): Promise<{ orderId: string; recipientEmail: string; input: OrderPdfInput }> {
  const { data, error } = await admin.from("quotes").select(
    "id, version, quote_number, total, subtotal, discount_total, gst_total, expires_on, created_at, order_id, quote_lines(display_name, unit_price, quantity, is_tbd), payment_plan_instalments(label, percentage, amount, due_on, status), orders(order_number, customers(first_name, last_name, email, phone, address))",
  ).eq("id", quoteId).single();
  if (error || !data) throw new Error("Unable to load the quote.");
  const quote = asRecord(data);
  const order = asRecord(firstRow(quote.orders));
  const customer = asRecord(firstRow(order.customers));
  const email = asString(customer.email);
  if (!asString(order.order_number) || !email) {
    throw new Error("The quote customer is unavailable.");
  }
  return {
    orderId: asString(quote.order_id),
    recipientEmail: email,
    input: {
      documentType: "quote",
      number: asString(quote.quote_number) ||
        `QUOTE-${asString(order.order_number)}-V${asNumber(quote.version)}`,
      issuedOn: asString(quote.created_at),
      expiresOn: asString(quote.expires_on),
      customer: {
        name: `${asString(customer.first_name)} ${asString(customer.last_name)}`
          .trim(),
        email,
        phone: asString(customer.phone),
        address: asString(customer.address),
      },
      studio: await studioDetails(admin),
      lines: asRows(quote.quote_lines).map((line) => {
        const row = asRecord(line);
        return {
          description: asString(row.display_name),
          unitPrice: asNumber(row.unit_price),
          quantity: asNumber(row.quantity),
          isTbd: row.is_tbd === true,
        };
      }),
      subtotal: asNumber(quote.subtotal) || asNumber(quote.total),
      discountTotal: asNumber(quote.discount_total),
      gstTotal: asNumber(quote.gst_total),
      totalDue: asNumber(quote.total),
      paymentSchedule: asRows(quote.payment_plan_instalments).map((line) => {
        const row = asRecord(line);
        return {
          description: asString(row.label),
          percentage: asNumber(row.percentage),
          amount: asNumber(row.amount),
          dueOn: asString(row.due_on),
          status: asString(row.status),
        };
      }),
    },
  };
}

async function loadInvoicePdfInput(
  admin: SupabaseClient,
  invoiceId: string,
): Promise<{ orderId: string; recipientEmail: string; input: OrderPdfInput }> {
  const { data, error } = await admin.from("invoices").select(
    "id, order_id, invoice_number, total, status, due_on, created_at, customer_name, customer_email, customer_address, payment_plan_instalment_id, invoice_lines(display_name, unit_price, quantity, finish), payment_plan_instalments(label, percentage, amount, due_on, status), orders(order_number, customers(phone))",
  ).eq("id", invoiceId).single();
  if (error || !data) throw new Error("Unable to load the invoice.");
  const invoice = asRecord(data);
  const order = asRecord(firstRow(invoice.orders));
  const customer = asRecord(firstRow(order.customers));
  const email = asString(invoice.customer_email);
  if (!asString(invoice.invoice_number) || !email) {
    throw new Error("The invoice customer is unavailable.");
  }
  return {
    orderId: asString(invoice.order_id),
    recipientEmail: email,
    input: {
      documentType: "invoice",
      number: asString(invoice.invoice_number),
      issuedOn: asString(invoice.created_at),
      dueOn: asString(invoice.due_on),
      invoiceStatus: asString(invoice.status),
      customer: {
        name: asString(invoice.customer_name),
        email,
        phone: asString(customer.phone),
        address: asString(invoice.customer_address),
      },
      studio: await studioDetails(admin),
      lines: asRows(invoice.invoice_lines).map((line) => {
        const row = asRecord(line);
        return {
          description: asString(row.display_name),
          unitPrice: asNumber(row.unit_price),
          quantity: asNumber(row.quantity),
          finish: asString(row.finish) || null,
        };
      }),
      subtotal: asNumber(invoice.total) / 1.1,
      discountTotal: 0,
      gstTotal: asNumber(invoice.total) / 11,
      totalDue: asNumber(invoice.total),
      invoiceMilestone: (() => {
        const row = asRecord(firstRow(invoice.payment_plan_instalments));
        return Object.keys(row).length
          ? {
            description: asString(row.label),
            percentage: asNumber(row.percentage),
            amount: asNumber(row.amount),
            dueOn: asString(row.due_on),
            status: asString(row.status),
          }
          : null;
      })(),
    },
  };
}

async function logDelivery(
  admin: SupabaseClient,
  input: {
    documentType: DocumentType;
    documentId: string;
    orderId: string;
    recipientEmail: string;
    outcome: "sent" | "failed";
    providerMessageId?: string | null;
    errorMessage?: string | null;
  },
) {
  const payload: DocumentDeliveryInsert = input.documentType === "quote"
    ? {
      order_id: input.orderId,
      quote_id: input.documentId,
      invoice_id: null,
      document_type: "quote",
      recipient_email: input.recipientEmail,
      sent_at: input.outcome === "sent" ? new Date().toISOString() : null,
      provider_message_id: input.providerMessageId ?? null,
      outcome: input.outcome,
      error_message: input.errorMessage ?? null,
    }
    : {
      order_id: input.orderId,
      quote_id: null,
      invoice_id: input.documentId,
      document_type: "invoice",
      recipient_email: input.recipientEmail,
      sent_at: input.outcome === "sent" ? new Date().toISOString() : null,
      provider_message_id: input.providerMessageId ?? null,
      outcome: input.outcome,
      error_message: input.errorMessage ?? null,
    };
  await admin.from("order_document_deliveries").insert(payload);
}

async function emailDocument(
  apiKey: string,
  input: {
    documentType: DocumentType;
    recipientEmail: string;
    filename: string;
    content: Uint8Array;
    reference: string;
  },
) {
  const subject = `${
    input.documentType === "quote" ? "Quote" : "Invoice"
  } ${input.reference} from IKKO HOMES`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "IKKO HOMES <accounts@ikkohomes.com>",
      to: [input.recipientEmail],
      subject,
      html:
        `<p>Your IKKO HOMES ${input.documentType} is attached.</p><p>Please contact our studio if you have any questions.</p>`,
      attachments: [{
        filename: input.filename,
        content: toBase64(input.content),
      }],
    }),
  });
  const responseData = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      asString(asRecord(responseData).message) ||
        "The email provider rejected the document.",
    );
  }
  return asString(asRecord(responseData).id) || null;
}

if (import.meta.main) {
  Deno.serve(async (request) => {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }
    try {
      const admin = await requireAdmin(request);
      const { action, documentType, documentId } = parsePayload(
        await request.json(),
      );
      const loaded = documentType === "quote"
        ? await loadQuotePdfInput(admin, documentId)
        : await loadInvoicePdfInput(admin, documentId);
      const document = await buildOrderPdf(loaded.input);
      if (action === "download") {
        return json({
          filename: document.filename,
          content_base64: toBase64(document.bytes),
        });
      }
      const apiKey = Deno.env.get("RESEND_API_KEY");
      if (!apiKey) throw new Error("Email delivery is not configured.");
      try {
        const providerMessageId = await emailDocument(apiKey, {
          documentType,
          recipientEmail: loaded.recipientEmail,
          filename: document.filename,
          content: document.bytes,
          reference: loaded.input.number,
        });
        await logDelivery(admin, {
          documentType,
          documentId,
          orderId: loaded.orderId,
          recipientEmail: loaded.recipientEmail,
          outcome: "sent",
          providerMessageId,
        });
        return json({ sent: true });
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "Unable to send the document.";
        await logDelivery(admin, {
          documentType,
          documentId,
          orderId: loaded.orderId,
          recipientEmail: loaded.recipientEmail,
          outcome: "failed",
          errorMessage: message,
        });
        throw new Error(message);
      }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Unable to prepare the document.";
      const status = message === "Unauthorised." ? 401 : 400;
      return json({ error: message }, status);
    }
  });
}
