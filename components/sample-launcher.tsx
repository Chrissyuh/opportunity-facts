"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import {
  SAMPLE_ROTATION_STORAGE_KEY,
  parseSampleRotationState,
} from "@/lib/sample-analysis/selection";

function subscribeToSampleHistory(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === SAMPLE_ROTATION_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}

function hasSeenSampleSnapshot() {
  try {
    return parseSampleRotationState(
      window.localStorage.getItem(SAMPLE_ROTATION_STORAGE_KEY),
    ).seen.length > 0;
  } catch {
    return false;
  }
}

export function SampleLauncher() {
  const hasSeenSample = useSyncExternalStore(
    subscribeToSampleHistory,
    hasSeenSampleSnapshot,
    () => false,
  );

  return (
    <Link className="home-sample-link" href="/analyze?sample=next">
      {hasSeenSample ? "Try another sample" : "Try a sample"}{" "}
      <span aria-hidden="true">→</span>
    </Link>
  );
}
