import type { Metadata } from "next";

import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "API Documentation",
  description: "HTTP endpoints exposed by the PicTools backend.",
};

const METHOD_CLASS: Record<string, string> = {
  GET: "bg-primary/10 text-primary",
  POST: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

function Endpoint({ method, path, children }: { method: string; path: string; children: string }) {
  return (
    <li className="flex flex-col gap-1 rounded-xl border border-outline-variant/30 bg-surface-container-high/40 px-3.5 py-3 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="flex items-center gap-2">
        <span
          className={`inline-flex w-12 shrink-0 justify-center rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${METHOD_CLASS[method] ?? "bg-muted text-on-surface-variant"}`}
        >
          {method}
        </span>
        <code className="font-mono text-[13px] font-semibold text-foreground">{path}</code>
      </span>
      <span className="text-sm text-on-surface-variant">{children}</span>
    </li>
  );
}

export default function DocsRoute() {
  return (
    <LegalPage
      title="API Documentation"
      updated="October 2026"
      intro="The PicTools backend exposes a JSON HTTP API consumed by the web and mobile clients. All processing endpoints require a signed-in session when accounts are enabled."
    >
      <LegalSection heading="Authentication">
        <p>
          Sessions are issued as an HTTP-only cookie for browsers, or as a bearer token returned in
          the body for native clients and replayed via the <code className="font-mono">X-Session-Token</code>{" "}
          header. If <code className="font-mono">API_KEYS</code> is set, requests must also send an{" "}
          <code className="font-mono">Authorization: Bearer &lt;key&gt;</code> header.
        </p>
        <ul className="space-y-2">
          <Endpoint method="POST" path="/api/auth/register">Create an account and start a session.</Endpoint>
          <Endpoint method="POST" path="/api/auth/login">Sign in and start a session.</Endpoint>
          <Endpoint method="POST" path="/api/auth/token/register">Create an account, returning a token.</Endpoint>
          <Endpoint method="POST" path="/api/auth/token/login">Sign in, returning a token.</Endpoint>
          <Endpoint method="POST" path="/api/auth/logout">End the current session.</Endpoint>
          <Endpoint method="GET" path="/api/auth/me">Return the signed-in user.</Endpoint>
        </ul>
      </LegalSection>

      <LegalSection heading="Image tools">
        <p>
          Upload one file as <code className="font-mono">multipart/form-data</code> with a{" "}
          <code className="font-mono">file</code> field and a JSON{" "}
          <code className="font-mono">settings</code> field. Each returns a job id to poll.
        </p>
        <ul className="space-y-2">
          <Endpoint method="POST" path="/api/resize">Resize by physical size or pixels.</Endpoint>
          <Endpoint method="POST" path="/api/convert">Convert to images or multi-size .ico icons.</Endpoint>
          <Endpoint method="POST" path="/api/compress">Compress to a target file size.</Endpoint>
          <Endpoint method="POST" path="/api/enhance">Auto or manual enhance and upscale.</Endpoint>
          <Endpoint method="POST" path="/api/remove-bg">Remove the background from a photo.</Endpoint>
          <Endpoint method="POST" path="/api/watermark">Stamp a text watermark.</Endpoint>
        </ul>
      </LegalSection>

      <LegalSection heading="Documents">
        <ul className="space-y-2">
          <Endpoint method="POST" path="/api/scan">Scan photos into a corrected multi-page PDF.</Endpoint>
          <Endpoint method="POST" path="/api/scan/detect">Detect document edges in one page.</Endpoint>
          <Endpoint method="POST" path="/api/pdf">Run a PDF operation (merge, split, convert, edit).</Endpoint>
          <Endpoint method="POST" path="/api/pdf/preview">Render page previews for the editor.</Endpoint>
        </ul>
      </LegalSection>

      <LegalSection heading="Video">
        <ul className="space-y-2">
          <Endpoint method="POST" path="/api/video">Compress, trim, or export GIF, thumbnail, audio or frames.</Endpoint>
        </ul>
      </LegalSection>

      <LegalSection heading="Jobs and downloads">
        <ul className="space-y-2">
          <Endpoint method="GET" path="/api/jobs/:id">Poll a job's status and result.</Endpoint>
          <Endpoint method="GET" path="/api/download/:id">Download the output of a completed job.</Endpoint>
          <Endpoint method="GET" path="/api/download-all">Download several job outputs as a ZIP.</Endpoint>
          <Endpoint method="POST" path="/api/contact">Submit the contact form.</Endpoint>
        </ul>
      </LegalSection>
    </LegalPage>
  );
}
