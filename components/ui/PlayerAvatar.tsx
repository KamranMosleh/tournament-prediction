import { avatarColor, initials } from '@/lib/utils'

interface Props {
  name: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: { box: 'w-7 h-7 text-xs', font: 'text-xs' },
  md: { box: 'w-9 h-9 text-sm', font: 'text-sm' },
  lg: { box: 'w-11 h-11 text-base', font: 'text-base' },
}

export function PlayerAvatar({ name, size = 'md' }: Props) {
  const color = avatarColor(name)
  const s = sizes[size]

  return (
    <div
      className={`${s.box} rounded-full flex items-center justify-center font-bold shrink-0 select-none`}
      style={{ backgroundColor: color + '22', color, border: `1.5px solid ${color}44` }}
    >
      <span className={s.font}>{initials(name)}</span>
    </div>
  )
}
