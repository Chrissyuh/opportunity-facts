"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ANALYSIS_URL_HANDOFF_KEY } from "@/lib/opportunity/browser-storage";

export function UrlQuickstart() {
  const [error, setError] = useState("");
  const router = useRouter();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const url = String(data.get("url") ?? "").trim().slice(0, 2_048);
    try {
      sessionStorage.setItem(ANALYSIS_URL_HANDOFF_KEY, url);
      router.push("/analyze");
    } catch {
      setError("This browser could not transfer the URL privately. Open Analyze and paste it there.");
    }
  }

  return (
    <form className="url-quickstart" onSubmit={submit}>
      <label htmlFor="homepage-url">Paste a public opportunity URL</label>
      <div className="url-quickstart-row">
        <input
          id="homepage-url"
          name="url"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://program.example/apply"
          required
        />
        <button className="button" type="submit">Analyze</button>
      </div>
      <p className="field-help">Use a public page you can open without signing in. Never paste an application or personal information.</p>
      {error ? <p className="action-message" role="alert">{error}</p> : null}
    </form>
  );
}
