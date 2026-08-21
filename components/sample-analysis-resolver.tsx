"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  SAMPLE_ROTATION_STORAGE_KEY,
  chooseNextSample,
  parseSampleRotationState,
} from "@/lib/sample-analysis/selection";

export function SampleAnalysisResolver() {
  const router = useRouter();

  useEffect(() => {
    const current = parseSampleRotationState(window.localStorage.getItem(SAMPLE_ROTATION_STORAGE_KEY));
    const next = chooseNextSample(current);
    window.localStorage.setItem(SAMPLE_ROTATION_STORAGE_KEY, JSON.stringify(next.state));
    router.replace(`/analyze?sample=${encodeURIComponent(next.id)}`);
  }, [router]);

  return (
    <div className="notice" role="status">
      <strong>Choosing a sample analysis...</strong>
    </div>
  );
}
