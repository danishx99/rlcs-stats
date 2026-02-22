import { proxyImageUrl } from "../utils/normalize";

type PlayerNameWithPhotoProps = {
  name: string | null | undefined;
  photoUrl?: string | null;
  className?: string;
};

export default function PlayerNameWithPhoto({
  name,
  photoUrl,
  className = ""
}: PlayerNameWithPhotoProps) {
  const label = name?.trim() || "—";
  const image = proxyImageUrl(photoUrl ?? null);

  return (
    <span className={`identity-inline ${className}`.trim()}>
      <span className="identity-avatar identity-avatar--player">
        {image ? <img src={image} alt={label} loading="lazy" /> : label.charAt(0)}
      </span>
      <span>{label}</span>
    </span>
  );
}
