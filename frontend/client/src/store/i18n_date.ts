// eslint-disable-next-line import/no-duplicates
import {format} from 'date-fns'
// eslint-disable-next-line import/no-duplicates
import {enGB, enUS, fr} from 'date-fns/locale'

// Exported to keep in sync with i18n module.
export const locales = {
  'en': {locale: enUS},
  'en_UK': {locale: enGB},
  'fr': {locale: fr},
  'fr@tu': {locale: fr},
} as const
type SupportedLng = keyof typeof locales

const formatDate = (value: Date, dateFormat: string, lng: string): string => {
  return format(value, dateFormat, locales[lng as SupportedLng] || fr)
}

export default formatDate
