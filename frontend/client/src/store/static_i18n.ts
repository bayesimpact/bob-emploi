// Initialize i18next for server side rendering.
// Do not use this file in the React app.
import type {ReadCallback, TFunction} from 'i18next'
import i18next from 'i18next'
import {initReactI18next} from 'react-i18next'

import {defaultInitOptions} from './i18n'

// Backend for i18next to load resources directly from static files.
class StaticI18nBackend {
  public static type = 'backend' as const

  public read(language: string, namespace: string, callback: ReadCallback): void {
    try {
      // TODO(cyrille): Try and use a dynamic import instead.
      // eslint-disable-next-line unicorn/prefer-module
      const resources = require(`translations/${language}/${namespace}.json`)
      callback(null, resources)
    } catch {
      callback(null, {})
    }
  }
}

export default (): Promise<TFunction> => {
  const i18nConfig = i18next.
    use(initReactI18next).
    use(StaticI18nBackend)
  return i18nConfig.init({
    ...defaultInitOptions,
    lng: config.defaultLang,
    react: {
      ...defaultInitOptions.react,
      useSuspense: false,
    },
    saveMissing: false,
  })
}
