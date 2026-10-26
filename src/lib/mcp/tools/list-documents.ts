import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "list_documents",
  title: "List documents",
  description:
    "List HR documents (contracts, bons de sortie, autorisations d'absence, avertissements, etc.). Optionally filter by worker or type.",
  inputSchema: {
    worker_id: z.string().uuid().optional().describe("Filter to a single employee."),
    document_type: z
      .string()
      .trim()
      .optional()
      .describe("Filter by document type (e.g. contract, bon_sortie, autorisation_absence, avertissement)."),
    limit: z.number().int().positive().optional().describe("Max rows (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ worker_id, document_type, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = supabaseForUser(ctx)
      .from("documents")
      .select("id, title, document_type, worker_id, created_at, status")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (worker_id) q = q.eq("worker_id", worker_id);
    if (document_type) q = q.eq("document_type", document_type);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { documents: data ?? [] },
    };
  },
});
