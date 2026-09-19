"use client";

import { Suspense } from "react";
import { Studio } from "@/components/studio";

export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <Studio />
    </Suspense>
  );
}
