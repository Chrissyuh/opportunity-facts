"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ANALYSIS_URL_HANDOFF_KEY } from "@/lib/opportunity/browser-storage";
import { normalizeAnalysisUrlInput } from "@/lib/opportunity/url-input";

export function UrlQuickstart() {
  const [error, setError] = useState("");
  const router = useRouter();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const normalized = normalizeAnalysisUrlInput(String(data.get("url") ?? ""));
    if (!normalized.ok) {
      setError(normalized.message);
      return;
    }
    try {
      sessionStorage.setItem(ANALYSIS_URL_HANDOFF_KEY, normalized.url);
      router.push("/analyze?start=1");
    } catch {
      setError("This browser could not start the analysis. Refresh the page and try again.");
    }
  }

  return (
    <form className="url-quickstart" onSubmit={submit}>
      <label className="sr-only" htmlFor="homepage-url">Paste an opportunity URL</label>
      <div className="url-quickstart-row">
        <input
          id="homepage-url"
          name="url"
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="Paste an opportunity URL"
          required
        />
        <button className="button" type="submit">Analyze</button>
      </div>
      {error ? <p className="action-message" role="alert">{error}</p> : null}
    </form>
  );
}
