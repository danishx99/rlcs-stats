import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTeamLogos } from "../hooks/useTeamLogos";
import { proxyImageUrl } from "../utils/normalize";
import { toOrgRosterId } from "../utils/roster";

type TeamNameWithLogoProps = {
  team: string | null | undefined;
  logoUrl?: string | null;
  className?: string;
  link?: boolean;
  rosterId?: string | null;
};

export default function TeamNameWithLogo({
  team,
  logoUrl,
  className = "",
  link = true,
  rosterId = null
}: TeamNameWithLogoProps) {
  const label = team?.trim() || "—";
  const logos = useTeamLogos([team ?? ""]);
  const key = useMemo(() => (team ? team.trim().toUpperCase() : ""), [team]);
  const resolved = key ? logos.get(key) ?? null : null;
  const direct = proxyImageUrl(logoUrl ?? null);
  const image = direct ?? resolved;
  const canLink = link && label !== "—";
  const targetRosterId = rosterId?.trim() || toOrgRosterId(label);
  const content = (
    <span className={`identity-inline ${className}`.trim()}>
      <span className="identity-avatar identity-avatar--team">
        {image ? <img src={image} alt={label} loading="lazy" /> : label.charAt(0)}
      </span>
      <span>{label}</span>
    </span>
  );

  if (!canLink) return content;

  return (
    <Link
      className="identity-inline-link"
      to={`/rosters/${encodeURIComponent(targetRosterId)}`}
      onClick={(event) => event.stopPropagation()}
      title={`View ${label}`}
    >
      {content}
    </Link>
  );
}
