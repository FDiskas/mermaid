import { useCallback, useEffect, useRef, useState } from "react";

/** A short-lived message ("Link copied"). */
export function useFlash(durationMs = 2000) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = useCallback(
    (text: string) => {
      setMessage(text);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), durationMs);
    },
    [durationMs],
  );
  return [message, flash] as const;
}

export function Flash({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="status" data-testid="flash" className="bg-foreground text-background pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm shadow-lg">
      {message}
    </div>
  );
}
