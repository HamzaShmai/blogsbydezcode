"use client";

import { useRouter } from "next/navigation";

export function RetryJobButton({
  websiteId,
  type,
}: {
  websiteId: string;
  type: string;
}) {
  const router = useRouter();
  return (
    <button
      className="btn secondary"
      type="button"
      onClick={async () => {
        await fetch(`/api/websites/${websiteId}/jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, payload: { retry: true, at: Date.now() } }),
        });
        router.refresh();
      }}
    >
      Retry
    </button>
  );
}
