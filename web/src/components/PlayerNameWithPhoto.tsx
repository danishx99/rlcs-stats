import { Link } from "react-router-dom";
import { proxyImageUrl, DEFAULT_PLAYER_PHOTO } from "../utils/normalize";

type PlayerNameWithPhotoProps = {
  name: string | null | undefined;
  playerId?: string | null;
  photoUrl?: string | null;
  className?: string;
  link?: boolean;
};

export default function PlayerNameWithPhoto({
  name,
  playerId = null,
  photoUrl,
  className = "",
  link = true
}: PlayerNameWithPhotoProps) {
  const label = name?.trim() || "—";
  const image = proxyImageUrl(photoUrl ?? null);
  const canLink = link && Boolean(playerId);
  const content = (
    <span className={`identity-inline ${className}`.trim()}>
      <span className="identity-avatar identity-avatar--player">
        <img src={image ?? proxyImageUrl(DEFAULT_PLAYER_PHOTO)!} alt={label} loading="lazy" />
      </span>
      <span>{label}</span>
    </span>
  );

  if (!canLink) return content;

  return (
    <Link
      className="identity-inline-link"
      to={`/players/${encodeURIComponent(playerId!)}`}
      onClick={(event) => event.stopPropagation()}
      title={`View ${label}`}
    >
      {content}
    </Link>
  );
}
