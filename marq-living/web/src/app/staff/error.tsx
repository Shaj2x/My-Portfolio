"use client";

import { Button, Notice } from "@/components/ui";

export default function StaffError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <Notice tone="bad">{error.message || "Something went wrong."}</Notice>
      <Button variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
