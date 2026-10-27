// The inside of an avatar circle: the profile photo when the person has one, the initials
// otherwise. The circle itself (size, color) stays with the caller's class (.ha-avatar,
// .ha-msg-avatar…); app/ds/cells.css makes the photo fill it.
export function AvatarFace({ initials, url }: { initials: string; url?: string | null }) {
  // eslint-disable-next-line @next/next/no-img-element -- public derivative of the profile photo
  return url ? <img className="ha-avatar__img" src={url} alt="" /> : <>{initials}</>
}
