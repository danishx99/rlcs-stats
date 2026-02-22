import { Link } from "react-router-dom";
import { proxyImageUrl } from "../utils/normalize";

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
        {image ? <img src={image} alt={label} loading="lazy" /> : label.charAt(0)}
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
