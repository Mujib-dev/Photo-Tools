"use client";

import * as React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          fontFamily: "system-ui, sans-serif",
          gap: "1rem",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>Something went wrong</h1>
        <p style={{ color: "#64748b", margin: 0, maxWidth: "32rem" }}>
          The app hit an unexpected error. Reloading usually fixes it.
        </p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#2563eb",
              border: 0,
              borderRadius: "0.5rem",
              color: "#fff",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 600,
              padding: "0.625rem 1rem",
            }}
          >
            Try again
          </button>
          <a
            href="/"
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: "0.5rem",
              color: "inherit",
              fontSize: "0.875rem",
              fontWeight: 600,
              padding: "0.625rem 1rem",
              textDecoration: "none",
            }}
          >
            Back to home
          </a>
        </div>
      </body>
    </html>
  );
}
