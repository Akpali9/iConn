import { avatarColor } from '../hooks/useChat'

export default function Avatar({ name = '', src, size = 48, style = {} }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
  const bg = avatarColor(name)
  if (src) return <img className="av-img" src={src} alt={name} style={{ width: size, height: size, ...style }} />
  return (
    <div className="av-fb" style={{ width: size, height: size, background: bg, fontSize: size * .36, ...style }}>
      {initials}
    </div>
  )
}
