import type { Metadata } from "next";

import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "API Documentation",
  description: "HTTP endpoints exposed by the PicTools backend.",
};

const METHOD_CLASS: Record<string, string> = {
  GET: "bg-primary/10 text-primary",
  POST: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  PATCH: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  PUT: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  DELETE: "bg-destructive/10 text-destructive",
};

function Endpoint({ method, path, children }: { method: string; path: string; children: React.ReactNode }) {
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
      intro="The PicTools backend exposes a JSON HTTP API consumed by the web and mobile clients. Every endpoint lives under /api; processing endpoints need a signed-in account when accounts are enabled."
    >
      <LegalSection heading="Authentication">
        <p>
          Sign-in issues a short-lived JWT access token plus a rotating refresh token. Browsers
          receive both as HTTP-only cookies — the access cookie rides along on every request, and
          the refresh cookie is exchanged silently when the access token expires. Native clients
          receive both tokens in the response body and replay the access token via the{" "}
          <code className="font-mono">X-Access-Token</code> header. Login attempts are throttled
          per IP and email (HTTP <code className="font-mono">429</code>). If{" "}
          <code className="font-mono">API_KEYS</code> is set, requests must also send an{" "}
          <code className="font-mono">Authorization: Bearer &lt;key&gt;</code> header.
        </p>
        <ul className="space-y-2">
          <Endpoint method="POST" path="/api/auth/register">Create an account and sign in.</Endpoint>
          <Endpoint method="POST" path="/api/auth/login">Sign in; sets access + refresh cookies.</Endpoint>
          <Endpoint method="POST" path="/api/auth/token/register">Create an account, returning a token pair.</Endpoint>
          <Endpoint method="POST" path="/api/auth/token/login">Sign in, returning a token pair.</Endpoint>
          <Endpoint method="POST" path="/api/auth/refresh">Rotate the refresh token and mint a new access token.</Endpoint>
          <Endpoint method="POST" path="/api/auth/logout">Revoke the refresh token and clear cookies.</Endpoint>
          <Endpoint method="GET" path="/api/auth/me">Return the signed-in user and access-token expiry.</Endpoint>
          <Endpoint method="PATCH" path="/api/auth/me">Update your email or password (current password required).</Endpoint>
          <Endpoint method="PUT" path="/api/auth/me/avatar">Set or clear your profile photo with an image data URL.</Endpoint>
          <Endpoint method="POST" path="/api/auth/recover">Start a password recovery flow.</Endpoint>
          <Endpoint method="POST" path="/api/auth/recover/verify">Verify a recovery code.</Endpoint>
          <Endpoint method="POST" path="/api/auth/reset-password">Set a new password with a recovery code.</Endpoint>
          <Endpoint method="POST" path="/api/auth/recover/email">Email a recovery link.</Endpoint>
          <Endpoint method="POST" path="/api/auth/google">Sign in with a Google id token.</Endpoint>
          <Endpoint method="POST" path="/api/auth/token/google">Sign in with Google, returning a token pair.</Endpoint>
        </ul>
      </LegalSection>

      <LegalSection heading="API keys &amp; presets">
        <p>
          API keys are minted with a full token shown once and stored hashed; the prefix is
          returned on every read. Presets are saved tool-settings bundles scoped to one operation.
        </p>
        <ul className="space-y-2">
          <Endpoint method="GET" path="/api/keys">List your API keys (prefix only).</Endpoint>
          <Endpoint method="POST" path="/api/keys">Create an API key; the token is returned once.</Endpoint>
          <Endpoint method="DELETE" path="/api/keys/:id">Revoke an API key.</Endpoint>
          <Endpoint method="GET" path="/api/presets">List your saved presets, optionally by operation.</Endpoint>
          <Endpoint method="POST" path="/api/presets">Create or update a preset.</Endpoint>
          <Endpoint method="DELETE" path="/api/presets/:id">Delete a preset.</Endpoint>
        </ul>
      </LegalSection>

      <LegalSection heading="Image tools">
        <p>
          Upload files as <code className="font-mono">multipart/form-data</code> with a{" "}
          <code className="font-mono">file</code> field and a JSON{" "}
          <code className="font-mono">settings</code> field. Supports JPG, PNG, WEBP, TIFF, BMP, GIF,
          and Apple iPhone HEIC photos. Each returns a job id to poll.
        </p>
        <ul className="space-y-2">
          <Endpoint method="POST" path="/api/resize">Resize by physical size or pixels.</Endpoint>
          <Endpoint method="POST" path="/api/convert">Convert to images or multi-size .ico icons.</Endpoint>
          <Endpoint method="POST" path="/api/compress">Compress to a target file size.</Endpoint>
          <Endpoint method="POST" path="/api/enhance">Auto or manual enhance and upscale.</Endpoint>
          <Endpoint method="POST" path="/api/remove-bg">Remove the background from a photo.</Endpoint>
          <Endpoint method="POST" path="/api/watermark">Stamp text or custom logo image watermark.</Endpoint>
        </ul>
      </LegalSection>

      <LegalSection heading="Documents">
        <ul className="space-y-2">
          <Endpoint method="POST" path="/api/scan">Scan photos into a corrected multi-page PDF.</Endpoint>
          <Endpoint method="POST" path="/api/scan/detect">Detect document edges in one page.</Endpoint>
          <Endpoint method="POST" path="/api/pdf">Run a PDF operation (merge, split, convert, compress, img2pdf, edit).</Endpoint>
          <Endpoint method="POST" path="/api/pdf/preview">Render page previews for the editor.</Endpoint>
          <Endpoint method="GET" path="/api/pdf/preview/:token/:file">Fetch one rendered preview file.</Endpoint>
          <Endpoint method="GET" path="/api/ocr/languages">List installed Windows Media OCR recognition languages.</Endpoint>
          <Endpoint method="POST" path="/api/ocr/analyze">Analyze image or PDF to extract text and word bounding boxes.</Endpoint>
          <Endpoint method="POST" path="/api/ocr">Export extracted text to Word (.docx), plain text (.txt), or structured JSON.</Endpoint>
        </ul>
      </LegalSection>

      <LegalSection heading="Audio &amp; Voice">
        <ul className="space-y-2">
          <Endpoint method="POST" path="/api/audio">Convert, trim, adjust volume, and change sample rate across MP3, WAV, AAC, FLAC, M4A, OGG, and OPUS.</Endpoint>
          <Endpoint method="GET" path="/api/tts/voices">List 320+ natural neural voices across all languages.</Endpoint>
          <Endpoint method="POST" path="/api/tts">Synthesize text into spoken MP3 or WAV audio.</Endpoint>
          <Endpoint method="POST" path="/api/stt">Transcribe audio or video into text with language code.</Endpoint>
        </ul>
      </LegalSection>

      <LegalSection heading="Video &amp; URLs">
        <ul className="space-y-2">
          <Endpoint method="POST" path="/api/video">Compress, trim, or export GIF, thumbnail, audio or frames.</Endpoint>
          <Endpoint method="POST" path="/api/url-download/analyze">Inspect a remote URL before downloading it.</Endpoint>
          <Endpoint method="POST" path="/api/url-download">Download a remote file and queue it as a job.</Endpoint>
        </ul>
      </LegalSection>

      <LegalSection heading="Batch processing">
        <p>
          Run one operation over many files in a single request. Send the files as{" "}
          <code className="font-mono">files</code> (up to 50), an optional JSON{" "}
          <code className="font-mono">settings</code> field and an optional{" "}
          <code className="font-mono">renameTemplate</code>. The response lists one job per
          file; a file that cannot be read is reported as failed without cancelling the rest of
          the batch.
        </p>
        <ul className="space-y-2">
          <Endpoint method="POST" path="/api/batch/:operation">
            Batch an operation: resize, convert, enhance, removebg, compress, watermark, video,
            audio or ocr.
          </Endpoint>
        </ul>
        <p className="text-xs text-muted-foreground">
          <code className="font-mono">renameTemplate</code> accepts the tokens{" "}
          <code className="font-mono">{"{name}"}</code>, <code className="font-mono">{"{index}"}</code>{" "}
          and <code className="font-mono">{"{ext}"}</code>. Without a template, the operation
          suffix is appended to the original name.
        </p>
      </LegalSection>

      <LegalSection heading="Jobs and downloads">
        <ul className="space-y-2">
          <Endpoint method="GET" path="/api/jobs/:id">Poll a job's status and result.</Endpoint>
          <Endpoint method="GET" path="/api/jobs/:id/events">Server-sent events stream of a job's progress.</Endpoint>
          <Endpoint method="GET" path="/api/download/:id">Download the output of a completed job.</Endpoint>
          <Endpoint method="GET" path="/api/download-all">Download several job outputs as a ZIP.</Endpoint>
          <Endpoint method="GET" path="/api/health">Liveness probe with backend and queue status.</Endpoint>
          <Endpoint method="POST" path="/api/contact">Submit the contact form.</Endpoint>
        </ul>
      </LegalSection>

      <LegalSection heading="Credits, usage &amp; promo codes">
        <p>
          Accounts are metered in credits: every job costs a fixed number, refunded in full when
          the job fails. A plan grants a monthly allowance that is re-granted lazily once the
          30-day cycle elapses. Promo codes are matched case-insensitively.
        </p>
        <ul className="space-y-2">
          <Endpoint method="GET" path="/api/credits">Balance, plan, allowance and the 7-day usage summary.</Endpoint>
          <Endpoint method="GET" path="/api/usage">Usage breakdown by operation, category and day.</Endpoint>
          <Endpoint method="POST" path="/api/promo/validate">Check a promo code without redeeming it.</Endpoint>
          <Endpoint method="POST" path="/api/promo/redeem">Redeem a credit or plan promo code.</Endpoint>
        </ul>
      </LegalSection>

      <LegalSection heading="Billing">
        <p>
          Paid tiers are billed through Stripe Checkout; card details never touch this app. The
          browser returns from Checkout with a session id and the server re-fetches the session
          from Stripe, so the activation cannot be faked client-side.
        </p>
        <ul className="space-y-2">
          <Endpoint method="GET" path="/api/billing/config">Whether checkout is enabled on this deployment.</Endpoint>
          <Endpoint method="GET" path="/api/billing/plans">The public plan catalogue with both billing cycles.</Endpoint>
          <Endpoint method="POST" path="/api/billing/checkout">Start a checkout, optionally with a discount promo code.</Endpoint>
          <Endpoint method="POST" path="/api/billing/verify">Confirm a completed checkout session.</Endpoint>
          <Endpoint method="POST" path="/api/billing/portal">Open the Stripe Customer Portal.</Endpoint>
        </ul>
      </LegalSection>

      <LegalSection heading="Admin &amp; Management">
        <p>Accessible only by accounts with administrator privileges (<code className="font-mono">role: admin</code>).</p>
        <ul className="space-y-2">
          <Endpoint method="GET" path="/api/admin/overview">Headline counts for the console overview.</Endpoint>
          <Endpoint method="GET" path="/api/admin/activity">Recent administrative activity.</Endpoint>
          <Endpoint method="GET" path="/api/admin/analytics">Job analytics over a rolling window.</Endpoint>
          <Endpoint method="GET" path="/api/admin/users">List accounts with credits, plan and referral state.</Endpoint>
          <Endpoint method="POST" path="/api/admin/users">Create an account.</Endpoint>
          <Endpoint method="PATCH" path="/api/admin/users/:id">Change a role or reset a password.</Endpoint>
          <Endpoint method="POST" path="/api/admin/users/:id/revoke">Revoke every session of an account.</Endpoint>
          <Endpoint method="DELETE" path="/api/admin/users/:id">Delete an account and its credentials.</Endpoint>
          <Endpoint method="POST" path="/api/admin/users/:id/credits">Adjust a credit balance (negative to remove).</Endpoint>
          <Endpoint method="POST" path="/api/admin/users/:id/plan">Move an account to another plan.</Endpoint>
          <Endpoint method="GET" path="/api/admin/jobs">List and inspect recent processing jobs.</Endpoint>
          <Endpoint method="DELETE" path="/api/admin/jobs/:id">Remove a job record.</Endpoint>
          <Endpoint method="GET" path="/api/admin/promos">List promo codes.</Endpoint>
          <Endpoint method="POST" path="/api/admin/promos">Create a promo code.</Endpoint>
          <Endpoint method="PATCH" path="/api/admin/promos/:id">Edit, pause or extend a promo code.</Endpoint>
          <Endpoint method="DELETE" path="/api/admin/promos/:id">Delete a promo code and its redemptions.</Endpoint>
          <Endpoint method="GET" path="/api/admin/promos/:id/redemptions">List who redeemed a promo code.</Endpoint>
          <Endpoint method="POST" path="/api/admin/digests/run">Send the weekly usage digests now.</Endpoint>
          <Endpoint method="POST" path="/api/admin/maintenance/sweep">Delete expired jobs and sessions now.</Endpoint>
          <Endpoint method="GET" path="/api/admin/audit">Security audit trail of auth and administrative actions.</Endpoint>
          <Endpoint method="GET" path="/api/admin/config">Read-only snapshot of the server configuration.</Endpoint>
          <Endpoint method="GET" path="/api/admin/contact">Inbound user support and feedback messages.</Endpoint>
          <Endpoint method="DELETE" path="/api/admin/contact/:id">Delete a contact submission.</Endpoint>
        </ul>
      </LegalSection>
    </LegalPage>
  );
}
