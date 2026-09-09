import { useEffect, useState } from "react";
import { PersonStanding, UserRound } from "lucide-react";

export default function UserAvatar({ profile = {}, size = 42, className = "" }: any) {
  const source = String(profile.photoURL || "").trim();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [source]);
  const gender = String(profile.gender || "").toLowerCase();
  const tone = gender === "female" ? "female" : gender === "male" ? "male" : "neutral";
  const name = profile.name || profile.displayName || profile.email || "Customer";
  return (
    <span
      className={`userAvatar userAvatar-${tone} ${className}`.trim()}
      style={{ width: size, height: size, flexBasis: size }}
      aria-hidden="true"
      title={name}
    >
      {source && !failed ? (
        <img src={source} alt="" onError={() => setFailed(true)} />
      ) : tone === "male" ? (
        <PersonStanding />
      ) : (
        <UserRound />
      )}
    </span>
  );
}
