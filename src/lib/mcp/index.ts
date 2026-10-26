import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listWorkers from "./tools/list-workers";
import getWorker from "./tools/get-worker";
import listDocuments from "./tools/list-documents";
import listAbsences from "./tools/list-absences";
import whoami from "./tools/whoami";

const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "rh-doc-gen-mcp",
  title: "Rh Doc Gen (ERCM)",
  version: "0.1.0",
  instructions:
    "Tools for the ERCM Rh Doc Gen HR app. Look up employees, HR documents (contracts, bons de sortie, autorisations d'absence, avertissements), and absences for the signed-in user. All calls respect the user's role and department permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoami, listWorkers, getWorker, listDocuments, listAbsences],
});
