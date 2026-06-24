type CountryAlias = readonly [name: string, code: string]

const COUNTRY_ALIASES: CountryAlias[] = [
  ['Afghanistan', 'AF'],
  ['Albania', 'AL'],
  ['Algeria', 'DZ'],
  ['Andorra', 'AD'],
  ['Angola', 'AO'],
  ['Argentina', 'AR'],
  ['Armenia', 'AM'],
  ['Australia', 'AU'],
  ['Austria', 'AT'],
  ['Azerbaijan', 'AZ'],
  ['Bahrain', 'BH'],
  ['Belgium', 'BE'],
  ['Bolivia', 'BO'],
  ['Bosnia and Herzegovina', 'BA'],
  ['Brazil', 'BR'],
  ['Bulgaria', 'BG'],
  ['Cameroon', 'CM'],
  ['Canada', 'CA'],
  ['Cape Verde', 'CV'],
  ['Cabo Verde', 'CV'],
  ['Chile', 'CL'],
  ['China', 'CN'],
  ['Colombia', 'CO'],
  ['Congo DR', 'CD'],
  ['DR Congo', 'CD'],
  ['Costa Rica', 'CR'],
  ['Croatia', 'HR'],
  ['Czech Republic', 'CZ'],
  ['Czechia', 'CZ'],
  ['Denmark', 'DK'],
  ['Dominican Republic', 'DO'],
  ['Ecuador', 'EC'],
  ['Egypt', 'EG'],
  ['El Salvador', 'SV'],
  ['England', 'GB-ENG'],
  ['Finland', 'FI'],
  ['France', 'FR'],
  ['Georgia', 'GE'],
  ['Germany', 'DE'],
  ['Ghana', 'GH'],
  ['Greece', 'GR'],
  ['Guatemala', 'GT'],
  ['Haiti', 'HT'],
  ['Honduras', 'HN'],
  ['Hungary', 'HU'],
  ['Iceland', 'IS'],
  ['India', 'IN'],
  ['Indonesia', 'ID'],
  ['Iran', 'IR'],
  ['IR Iran', 'IR'],
  ['Iraq', 'IQ'],
  ['Ireland', 'IE'],
  ['Republic of Ireland', 'IE'],
  ['Israel', 'IL'],
  ['Italy', 'IT'],
  ['Ivory Coast', 'CI'],
  ["Cote d'Ivoire", 'CI'],
  ['Jamaica', 'JM'],
  ['Japan', 'JP'],
  ['Jordan', 'JO'],
  ['Korea DPR', 'KP'],
  ['Korea Republic', 'KR'],
  ['Korea Rep', 'KR'],
  ['Kuwait', 'KW'],
  ['Mali', 'ML'],
  ['Mexico', 'MX'],
  ['Montenegro', 'ME'],
  ['Morocco', 'MA'],
  ['Netherlands', 'NL'],
  ['New Zealand', 'NZ'],
  ['Nigeria', 'NG'],
  ['North Macedonia', 'MK'],
  ['Norway', 'NO'],
  ['Oman', 'OM'],
  ['Panama', 'PA'],
  ['Paraguay', 'PY'],
  ['Peru', 'PE'],
  ['Poland', 'PL'],
  ['Portugal', 'PT'],
  ['Qatar', 'QA'],
  ['Romania', 'RO'],
  ['Saudi Arabia', 'SA'],
  ['Scotland', 'GB-SCT'],
  ['Senegal', 'SN'],
  ['Serbia', 'RS'],
  ['Slovakia', 'SK'],
  ['Slovenia', 'SI'],
  ['South Africa', 'ZA'],
  ['South Korea', 'KR'],
  ['Spain', 'ES'],
  ['Sweden', 'SE'],
  ['Switzerland', 'CH'],
  ['Tunisia', 'TN'],
  ['Turkey', 'TR'],
  ['Turkiye', 'TR'],
  ['Ukraine', 'UA'],
  ['United Arab Emirates', 'AE'],
  ['UAE', 'AE'],
  ['United States', 'US'],
  ['United States of America', 'US'],
  ['USA', 'US'],
  ['Uruguay', 'UY'],
  ['Uzbekistan', 'UZ'],
  ['Venezuela', 'VE'],
  ['Vietnam', 'VN'],
  ['Wales', 'GB-WLS'],
]

const COUNTRY_CODE_BY_NAME = new Map(
  COUNTRY_ALIASES.map(([name, code]) => [normalizeCountryName(name), code])
)

const SUBDIVISION_TAG_BY_CODE: Record<string, string> = {
  'GB-ENG': 'gbeng',
  'GB-SCT': 'gbsct',
  'GB-WLS': 'gbwls',
}

function normalizeCountryName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function regionalFlag(code: string): string | null {
  const upperCode = code.toUpperCase()
  if (!/^[A-Z]{2}$/.test(upperCode)) return null

  return String.fromCodePoint(
    ...[...upperCode].map(char => 0x1f1e6 + char.charCodeAt(0) - 65)
  )
}

function subdivisionFlag(tag: string): string {
  return String.fromCodePoint(
    0x1f3f4,
    ...[...tag.toLowerCase()].map(char => 0xe0000 + char.charCodeAt(0)),
    0xe007f
  )
}

export function countryCodeForName(name: string): string | null {
  return COUNTRY_CODE_BY_NAME.get(normalizeCountryName(name)) ?? null
}

export function countryFlagIconClassForName(name: string): string | null {
  const code = countryCodeForName(name)
  return code ? `fi fi-${code.toLowerCase()}` : null
}

export function countryFlagForName(name: string): string | null {
  const code = countryCodeForName(name)
  if (!code) return null

  const subdivisionTag = SUBDIVISION_TAG_BY_CODE[code]
  if (subdivisionTag) return subdivisionFlag(subdivisionTag)

  return regionalFlag(code)
}

export function formatCountryName(name: string): string {
  const flag = countryFlagForName(name)
  return flag ? `${flag} ${name}` : name
}
