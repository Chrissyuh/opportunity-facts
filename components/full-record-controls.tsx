"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Filter = "all" | "disclosed" | "unresolved" | "not_applicable";

export function FullRecordControls({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const rows = root.current?.querySelectorAll<HTMLElement>(".fact-row") ?? [];
    const needle = query.trim().toLowerCase();
    rows.forEach((row) => {
      const matchesText = !needle || (row.textContent ?? "").toLowerCase().includes(needle);
      const matchesStatus = filter === "all" ||
        (filter === "unresolved" && ["fact-row-not_found", "fact-row-unclear", "fact-row-conflicting", "fact-row-unassessed"].some((name) => row.classList.contains(name))) ||
        (filter !== "unresolved" && row.classList.contains(`fact-row-${filter}`));
      row.hidden = !(matchesText && matchesStatus);
    });
  }, [query, filter]);

  function setEvidence(open: boolean) {
    root.current?.querySelectorAll<HTMLDetailsElement>(".evidence-disclosure").forEach((details) => { details.open = open; });
  }

  return <div ref={root}>
    <div className="record-tools no-print" aria-label="Filter full record">
      <label><span>Search facts</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try refund, deadline, university…" /></label>
      <label><span>Status</span><select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}><option value="all">All facts</option><option value="disclosed">Disclosed</option><option value="unresolved">Needs resolution</option><option value="not_applicable">Not applicable</option></select></label>
      <div className="record-evidence-buttons"><button type="button" className="button-quiet" onClick={() => setEvidence(true)}>Expand evidence</button><button type="button" className="button-quiet" onClick={() => setEvidence(false)}>Collapse evidence</button></div>
    </div>
    {children}
  </div>;
}
