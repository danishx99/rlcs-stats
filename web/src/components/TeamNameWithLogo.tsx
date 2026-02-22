import { useMemo } from "react";
import { useTeamLogos } from "../hooks/useTeamLogos";
import { proxyImageUrl } from "../utils/normalize";

type TeamNameWithLogoProps = {
  team: string | null | undefined;
  logoUrl?: string | null;
  className?: string;
};

export default function TeamNameWithLogo({ team, logoUrl, className = "" }: TeamNameWithLogoProps) {
  const label = team?.trim() || "—";
  const logos = useTeamLogos([team ?? ""]);
  const key = useMemo(() => (team ? team.trim().toUpperCase() : ""), [team]);
  const resolved = key ? logos.get(key) ?? null : null;
  const direct = proxyImageUrl(logoUrl ?? null);
  const image = direct ?? resolved;

  return (
    <span className={`identity-inline ${className}`.trim()}>
      <span className="identity-avatar identity-avatar--team">
        {image ? <img src={image} alt={label} loading="lazy" /> : label.charAt(0)}
      </span>
      <span>{label}</span>
    </span>
  );
}
