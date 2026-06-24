import { countryFlagIconClassForName } from '@/lib/country-flags'

interface CountryNameProps {
  name: string
  className?: string
  reverse?: boolean
}

export function CountryName({ name, className = '', reverse = false }: CountryNameProps) {
  const flagClassName = countryFlagIconClassForName(name)

  if (!flagClassName) {
    return <span className={className}>{name}</span>
  }

  const flagNode = (
    <span aria-hidden="true" className={`${flagClassName} country-flag shrink-0`} />
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
