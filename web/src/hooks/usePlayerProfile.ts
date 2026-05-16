import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import type { PlayerProfile } from "../types/api";

export function usePlayerProfile(uniqueId: string | undefined, spotlightKey: string) {
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const profileRef = useRef<PlayerProfile | null>(null);

  useEffect(() => {
    profileRef.current = playerProfile;
  }, [playerProfile]);

  const spotlightKeys = useMemo(
    () => (spotlightKey ? spotlightKey.split(",").filter(Boolean) : []),
    [spotlightKey]
  );

  useEffect(() => {
    if (!uniqueId) return;
    const playerId = uniqueId;

    const requestId = ++requestRef.current;
    const existing = profileRef.current;
    const samePlayerInBackground = existing !== null && existing.id === playerId;

    async function loadProfile() {
      if (!samePlayerInBackground) {
        setPlayerProfile(null);
        setLoading(true);
      }
      setError(null);
      try {
        const response = await api.playerProfile(
          playerId,
          undefined,
          spotlightKeys.length ? { spotlight: spotlightKeys } : undefined
        );
        if (requestRef.current !== requestId) return;
        setPlayerProfile(response.player);
      } catch (loadError) {
        if (requestRef.current !== requestId) return;
        console.error(loadError);
        setPlayerProfile(null);
        const message = loadError instanceof Error ? loadError.message.toLowerCase() : "";
        if (message.includes("player not found") || message.includes("api error 404")) {
          setError("Player profile not found.");
        } else {
          setError("Failed to load player profile");
        }
      } finally {
        if (requestRef.current !== requestId) return;
        setLoading(false);
      }
    }

    void loadProfile();
  }, [uniqueId, spotlightKeys]);

  return { playerProfile, playerProfileLoading: loading, playerProfileError: error };
}
