import { countryFlagForName } from '@/lib/country-flags'

interface CountryNameProps {
  name: string
  className?: string
  reverse?: boolean
}

export function CountryName({ name, className = '', reverse = false }: CountryNameProps) {
  const flag = countryFlagForName(name)

  if (!flag) {
    return <span className={className}>{name}</span>
  }

  const flagNode = (
    <span aria-hidden="true" className="shrink-0 leading-none">
      {flag}
    </span>
  )
  const nameNode = <span className="truncate">{name}</span>

  return (
    <span className={`inline-flex max-w-full min-w-0 items-center gap-1.5 align-baseline ${className}`}>
      {reverse ? (
        <>
          {nameNode}
          {flagNode}
        </>
      ) : (
        <>
          {flagNode}
          {nameNode}
        </>
      )}
    </span>
  )
}
