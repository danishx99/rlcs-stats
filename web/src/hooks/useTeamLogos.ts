import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { proxyImageUrl } from "../utils/normalize";

const logoCache = new Map<string, string | null>();
const pendingCache = new Map<string, Promise<string | null>>();

function normalizeTeamKey(team: string) {
  return team.trim().toUpperCase();
}

async function resolveTeamLogo(team: string): Promise<string | null> {
  const key = normalizeTeamKey(team);
  const cached = logoCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const pending = pendingCache.get(key);
  if (pending) {
    return pending;
  }

  const task = (async () => {
    try {
      const response = await api.search({ q: team, limit: 10 });
      const options = [...(response.teams ?? []), ...(response.rosters ?? [])];
      const exact = options.find((entry) => normalizeTeamKey(entry.label) === key);
      const best = exact ?? options[0];
      const image = proxyImageUrl(best?.meta?.photoUrl ?? null, { size: 128 });
      logoCache.set(key, image);
      return image;
    } catch (error) {
      console.error("Failed to resolve team logo", team, error);
      logoCache.set(key, null);
      return null;
    } finally {
      pendingCache.delete(key);
    }
  })();

  pendingCache.set(key, task);
  return task;
}

export function useTeamLogos(teams: Array<string | null | undefined>) {
  const keys = useMemo(
    () =>
      Array.from(
        new Set(
          teams
            .map((team) => (team ? normalizeTeamKey(team) : ""))
            .filter(Boolean)
        )
      ),
    [teams]
  );

  const [logos, setLogos] = useState<Record<string, string | null>>(() => {
    const seed: Record<string, string | null> = {};
    for (const key of keys) {
      if (logoCache.has(key)) {
        seed[key] = logoCache.get(key) ?? null;
      }
    }
    return seed;
  });

  useEffect(() => {
    let cancelled = false;
    const missing = keys.filter((key) => logos[key] === undefined);
    if (missing.length === 0) return;

    Promise.all(
      missing.map(async (key) => {
        const logo = await resolveTeamLogo(key);
        return { key, logo };
      })
    ).then((entries) => {
      if (cancelled) return;
      setLogos((prev) => {
        const next = { ...prev };
        for (const entry of entries) {
          next[entry.key] = entry.logo;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [keys, logos]);

  return useMemo(() => {
    const map = new Map<string, string | null>();
    for (const key of keys) {
      map.set(key, logos[key] ?? null);
    }
    return map;
  }, [keys, logos]);
}
