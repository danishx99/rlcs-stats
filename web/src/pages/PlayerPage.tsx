import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { StatCategory, StatOption } from "../types/api";
import SocialIconLink from "../components/SocialIconLink";
import SpotlightTile from "../components/SpotlightTile";
import StatPicker from "../components/StatPicker";
import TeamNameWithLogo from "../components/TeamNameWithLogo";
import PlayerResultsPanel from "../components/player/PlayerResultsPanel";
import PlayerSeasonPanel from "../components/player/PlayerSeasonPanel";
import { useMeta } from "../hooks/useMeta";
import { formatAliases } from "../utils/aliases";
import { computeAge, formatDate } from "../utils/date";
import { normalizeSocialLink, proxyImageUrl, DEFAULT_PLAYER_PHOTO } from "../utils/normalize";
import { resolveTeamRosterId } from "../utils/team-routing";
import PanelState from "../components/ui/PanelState";
import SkeletonBlock from "../components/ui/SkeletonBlock";
import PageBackActions from "../components/PageBackActions";
import { usePlayerProfile } from "../hooks/usePlayerProfile";
import { usePlayerSeason } from "../hooks/usePlayerSeason";
import { usePlayerResults } from "../hooks/usePlayerResults";

const DEFAULT_SPOTLIGHT_KEYS = ["goals", "assists", "saves", "demos"] as const;
type DefaultSpotlightKey = (typeof DEFAULT_SPOTLIGHT_KEYS)[number];

export default function PlayerPage() {
  const { uniqueId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { meta } = useMeta({
    mode: "3s",
    scope: "regional",
    tier: "none",
    season: "",
    split: "",
    event: ""
  });
  const spotlightParam = searchParams.get("spotlight") ?? "";
  const rawSpotlightKeys = useMemo(() => {
    if (!spotlightParam) return [] as string[];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const entry of spotlightParam.split(",")) {
      const key = entry.trim();
      if (!key) continue;
      if ((DEFAULT_SPOTLIGHT_KEYS as readonly string[]).includes(key)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(key);
    }
    return result;
  }, [spotlightParam]);
  const [statCategories, setStatCategories] = useState<StatCategory[]>([]);
  const statOptionMap = useMemo(() => {
    const map = new Map<string, StatOption>();
    for (const option of meta?.statOptions ?? []) {
      map.set(option.key, option);
    }
    for (const cat of statCategories) {
      for (const option of cat.stats) {
        if (!map.has(option.key)) map.set(option.key, option);
      }
    }
    return map;
  }, [meta, statCategories]);
  const spotlightKeys = useMemo(() => rawSpotlightKeys.filter((key) => statOptionMap.has(key)), [rawSpotlightKeys, statOptionMap]);
  const spotlightKey = spotlightKeys.join(",");
  useEffect(() => {
    let cancelled = false;
    api.metaColumns().then((res) => {
      if (!cancelled) setStatCategories(res.categories ?? []);
    }).catch((err) => {
      console.error(err);
      if (!cancelled) setStatCategories([]);
    });
    return () => { cancelled = true; };
  }, []);
  const DEFAULT_KEYS_SET = useMemo(() => new Set<string>(DEFAULT_SPOTLIGHT_KEYS), []);
  const toggleSpotlight = (key: string) => {
    if (DEFAULT_KEYS_SET.has(key)) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const current = (next.get("spotlight") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && !DEFAULT_KEYS_SET.has(s));
      const existing = current.indexOf(key);
      let updated: string[];
      if (existing >= 0) {
        updated = current.filter((k) => k !== key);
      } else {
        if (current.length >= 8) return prev;
        updated = [...current, key];
      }
      if (updated.length === 0) {
        next.delete("spotlight");
      } else {
        next.set("spotlight", updated.join(","));
      }
      return next;
    });
  };
  const spotlightDisabledKeys = useMemo(() => {
    if (spotlightKeys.length < 8) return undefined;
    const disabled = new Set<string>();
    for (const cat of statCategories) {
      for (const s of cat.stats) {
        if (!spotlightKeys.includes(s.key)) disabled.add(s.key);
      }
    }
    return disabled;
  }, [statCategories, spotlightKeys]);
  const [seasonGameMode, setSeasonGameMode] = useState<"1s" | "2s" | "3s">("3s");
  const [seasonStatMode, setSeasonStatMode] = useState<"avg" | "total">("avg");
  const [seasonIncludeLans, setSeasonIncludeLans] = useState(false);
  const [resultSeason, setResultSeason] = useState("");
  const [resultsViewMode, setResultsViewMode] = useState<"season" | "all">("season");

  const { playerProfile, playerProfileLoading, playerProfileError } = usePlayerProfile(uniqueId, spotlightKey);
  const { seasonRows, seasonLoading, seasonError, retrySeason } = usePlayerSeason(
    uniqueId,
    seasonGameMode,
    seasonStatMode,
    seasonIncludeLans
  );
  const {
    results,
    resultSeasons,
    resultsLoading,
    resultsError,
    retryResults,
    playerHasLanEvents,
    getAllEventsForTeamRouting
  } = usePlayerResults(uniqueId, resultsViewMode, resultSeason, setResultSeason);

  useEffect(() => {
    setSeasonIncludeLans(false);
  }, [uniqueId]);

  useEffect(() => {
    if (resultSeason || !seasonRows.length) return;
    const latest = seasonRows[seasonRows.length - 1]?.season ?? "";
    if (latest) setResultSeason(latest);
  }, [resultSeason, seasonRows]);

  if (playerProfileLoading) {
    return (
      <div className="page page-no-nav player-page" aria-busy="true">
        <PageBackActions />
        <h1 className="page-heading">Player Profile</h1>
        <div className="player-top-grid">
          <section className="panel player-overview-card">
            <div className="player-overview-head">
              <SkeletonBlock width={98} height={98} rounded="pill" />
              <div style={{ width: "100%", display: "grid", gap: 10 }}>
                <SkeletonBlock height={20} width="52%" />
                <SkeletonBlock height={14} width="70%" />
                <SkeletonBlock height={14} width="46%" />
              </div>
            </div>
            <div className="player-overview-list">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={`profile-skeleton-${index}`}>
                  <SkeletonBlock height={11} width={60} />
                  <SkeletonBlock height={13} width="55%" />
                </div>
              ))}
            </div>
          </section>
          <section className="panel player-season-card">
            <SkeletonBlock height={20} width={180} />
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonBlock key={`season-skeleton-${index}`} height={26} width="100%" />
              ))}
            </div>
          </section>
        </div>

        <section className="panel player-results-card">
          <div className="section-header">
            <SkeletonBlock height={20} width={90} />
            <SkeletonBlock height={30} width={160} rounded="pill" />
          </div>
          <div className="skel-table">
            <div className="skel-table-header skel-results-row">
              <SkeletonBlock height={12} width="40%" />
              <SkeletonBlock height={12} width="60%" />
              <SkeletonBlock height={12} width="50%" />
              <SkeletonBlock height={12} width="40%" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`results-init-skel-${i}`} className="skel-table-row skel-results-row">
                <SkeletonBlock height={14} width={`${70 - i * 6}%`} />
                <SkeletonBlock height={14} width="50%" />
                <SkeletonBlock height={14} width={`${60 - i * 5}%`} />
                <SkeletonBlock height={14} width="55%" />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (playerProfileError || !playerProfile) {
    return (
      <div className="page page-no-nav">
        <PageBackActions />
        <div className="empty-state">{playerProfileError || "Player not found."}</div>
      </div>
    );
  }

  const age = computeAge(playerProfile.dateOfBirth);
  const twitchLink = normalizeSocialLink(playerProfile.twitch, "twitch");
  const tiktokLink = normalizeSocialLink(playerProfile.tiktok, "tiktok");
  const currentTeam = playerProfile.teams[0] ?? null;
  const focusStatLabelMap: Record<DefaultSpotlightKey, string> = {
    goals: "Goals",
    assists: "Assists",
    saves: "Saves",
    demos: "Demos"
  };
  const navigateToTeam = async (teamName: string) => {
    const rosterId = await resolveTeamRosterId(teamName);
    const allEvents = getAllEventsForTeamRouting();
    const teamNorm = teamName.trim().toUpperCase();
    const match = allEvents.find(
      (e) => e.team && e.team.trim().toUpperCase() === teamNorm
    );
    const params = match?.season ? `?season=${encodeURIComponent(match.season)}` : "";
    navigate(`/rosters/${encodeURIComponent(rosterId)}${params}`);
  };

  return (
    <div className="page page-no-nav player-page">
      <PageBackActions />

      <h1 className="page-heading">Player Profile</h1>

      <div className="player-top-grid">
        <section className="panel player-overview-card">
          <div className="player-overview-head">
            <div className="profile-media">
              <img
                src={proxyImageUrl(playerProfile.photoUrl) ?? proxyImageUrl(DEFAULT_PLAYER_PHOTO)!}
                alt={playerProfile.handle ?? playerProfile.playerName ?? "Player"}
                loading="lazy"
                onError={(e) => { e.currentTarget.src = proxyImageUrl(DEFAULT_PLAYER_PHOTO)!; }}
              />
            </div>
            <div className="player-overview-name">
              <h2>{playerProfile.handle ?? playerProfile.playerName ?? "Player"}</h2>
              <div className="player-overview-meta">
                <div className="player-overview-meta-row">
                  <span>Country</span>
                  <strong>{playerProfile.country ?? "—"}</strong>
                </div>
                <div className="player-overview-meta-row">
                  <span>Current Team</span>
                  <strong>{currentTeam ? <TeamNameWithLogo team={currentTeam} /> : "—"}</strong>
                </div>
              </div>
            </div>
          </div>
          <div className="player-overview-list">
            <div><span>Name</span><strong>{playerProfile.realName ?? "—"}</strong></div>
            <div><span>Aliases</span><strong>{formatAliases(playerProfile.aliases)}</strong></div>
            <div>
              <span>Birthday</span>
              <strong>{playerProfile.dateOfBirth ? formatDate(playerProfile.dateOfBirth) : "—"}{age ? ` (Age ${age})` : ""}</strong>
            </div>
            <div>
              <span>Debut</span>
              <strong>
                {playerProfile.debut ?? "—"}
              </strong>
            </div>
            <div><span>Best Result</span><strong>{playerProfile.bestResult ?? "—"}</strong></div>
            <div><span>Games (W-L)</span><strong>{playerProfile.games} ({playerProfile.gamesWon}-{playerProfile.gamesLost})</strong></div>
          </div>
          <div className="profile-links">
            {twitchLink ? (
              <SocialIconLink href={twitchLink} platform="twitch" />
            ) : null}
            {tiktokLink ? (
              <SocialIconLink href={tiktokLink} platform="tiktok" />
            ) : null}
          </div>
        </section>

        <PlayerSeasonPanel
          rows={seasonRows}
          loading={seasonLoading}
          error={seasonError}
          onRetry={retrySeason}
          statMode={seasonStatMode}
          onStatModeChange={setSeasonStatMode}
          gameMode={seasonGameMode}
          onGameModeChange={setSeasonGameMode}
          includeLans={seasonIncludeLans}
          onIncludeLansChange={setSeasonIncludeLans}
          showLanToggle={playerHasLanEvents}
        />
      </div>

      <section className="panel player-career-card">
        <div className="section-header">
          <h2>Career Spotlight</h2>
          <div className="section-controls">
            <StatPicker
              categories={statCategories}
              selected={spotlightKeys}
              onToggle={toggleSpotlight}
              dropdown
              triggerLabel="+ Add Stat"
              hiddenKeys={DEFAULT_KEYS_SET}
              disabledKeys={spotlightDisabledKeys}
            />
          </div>
        </div>

        <div className="career-spotlight-grid">
          {(["goals", "assists", "saves", "demos"] as const).map((stat) => (
            <SpotlightTile
              key={stat}
              label={focusStatLabelMap[stat]}
              format="int"
              total={playerProfile.totals[stat] ?? 0}
              avg={playerProfile.averages[stat] ?? 0}
              rank={playerProfile.ranks.total[stat] ?? null}
            />
          ))}
          {spotlightKeys.map((key) => {
            const option = statOptionMap.get(key);
            if (!option) return null;
            const fmt = option.format ?? "int";
            const pending = !(key in playerProfile.totals);
            if (pending) {
              return (
                <div key={key} className="career-spotlight-stat career-spotlight-stat--pending" aria-busy="true">
                  <span>{option.label}</span>
                  <SkeletonBlock height={22} width="50%" />
                  <SkeletonBlock height={10} width="55%" />
                </div>
              );
            }
            const rank = fmt === "int"
              ? playerProfile.ranks.total[key] ?? null
              : playerProfile.ranks.avg[key] ?? null;
            return (
              <SpotlightTile
                key={key}
                label={option.label}
                format={fmt}
                total={playerProfile.totals[key] ?? null}
                avg={playerProfile.averages[key] ?? null}
                rank={rank}
                removable
                onRemove={() => toggleSpotlight(key)}
              />
            );
          })}
        </div>
      </section>

      <PlayerResultsPanel
        results={results}
        loading={resultsLoading}
        error={resultsError}
        onRetry={retryResults}
        viewMode={resultsViewMode}
        onViewModeChange={setResultsViewMode}
        resultSeasons={resultSeasons}
        resultSeason={resultSeason}
        onResultSeasonChange={setResultSeason}
      />

      <div className="profile-teams">
        <div className="section-title">Teams</div>
        {playerProfile.teams.length === 0 ? (
          <PanelState state="empty" message="No teams available for this player." />
        ) : (
          <div className="tag-list">
            {playerProfile.teams.map((team, i) => (
              <button
                key={`${team}-${i}`}
                type="button"
                className={`tag tag-button${i === 0 ? " tag-current" : ""}`}
                onClick={() => {
                  void navigateToTeam(team);
                }}
                title={`View ${team} team page`}
              >
                <TeamNameWithLogo team={team} link={false} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
