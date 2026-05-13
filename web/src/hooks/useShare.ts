import { useCallback, useEffect, useState } from "react";

export interface ShareArgs {
  title: string;
  text: string;
  url: string;
}

export interface UseShareResult {
  share: (args: ShareArgs) => Promise<void>;
  busy: boolean;
  message: string | null;
}

const MESSAGE_TIMEOUT_MS = 2200;

export function useShare(): UseShareResult {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const share = useCallback(async (args: ShareArgs) => {
    setBusy(true);
    setMessage(null);
    try {
      if (navigator.share) {
        await navigator.share({
          title: args.title,
          text: args.text,
          url: args.url,
        });
        setMessage("Shared.");
        return;
      }
      await navigator.clipboard.writeText(args.url);
      setMessage("Link copied.");
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") {
        return;
      }
      console.error(shareError);
      setMessage("Could not share. Copy the URL manually.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), MESSAGE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  return { share, busy, message };
}
