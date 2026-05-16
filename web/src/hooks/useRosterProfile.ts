import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { RosterProfile } from "../types/api";
import { useAsyncResource } from "./useAsyncResource";

const ROSTER_MODE = "3s" as const;

export function useRosterProfile(rosterId: string | undefined, seasonHint: string) {
  const [selectedSeason, setSelectedSeason] = useState("");

  const { data, loading, error } = useAsyncResource(
    async () => {
      if (!rosterId) return null;
      const response = await api.rosterProfile(rosterId, {
        gameMode: ROSTER_MODE
      });
      return response.roster;
    },
    [rosterId]
  );

  const rosterProfile = data as RosterProfile | null;

  useEffect(() => {
    if (!rosterProfile) {
      setSelectedSeason("");
      return;
    }
    const available = rosterProfile.seasonsCompeted
      ?? rosterProfile.seasonRosters?.map((entry) => entry.season)
      ?? [];
    const hintValid = seasonHint && available.includes(seasonHint);
    const initialSeason = hintValid
      ? seasonHint
      : rosterProfile.defaultSeason
        ?? available[0]
        ?? "";
    setSelectedSeason(initialSeason);
  }, [rosterProfile, seasonHint]);

  const seasonOptions = useMemo(() => {
    if (!rosterProfile) return [] as string[];
    if (rosterProfile.seasonsCompeted?.length) return rosterProfile.seasonsCompeted;
    return (rosterProfile.seasonRosters ?? []).map((entry) => entry.season);
  }, [rosterProfile]);

  return {
    rosterProfile,
    rosterProfileLoading: loading,
    rosterProfileError: error ? "Failed to load team profile." : null,
    selectedSeason,
    setSelectedSeason,
    seasonOptions
  };
}
