import Storage from 'local-storage-fallback'

import type {AllActions} from 'store/actions'
import {parseQueryString} from 'store/parse'
import user, {updateProject} from 'store/user_reducer'

import type {AllUpskillingActions} from './actions'

export const CITY_LOCAL_STORAGE_KEY = 'upskilling:departement-id'
const ALPHA_LOCAL_STORAGE_KEY = 'upskilling:alpha'

const getIsAlphaUser = (): boolean => {
  const {alpha} = parseQueryString(window.location.search)
  if (alpha) {
    const isAlphaUser = alpha !== '0' && alpha.toLowerCase() !== 'false'
    if (isAlphaUser) {
      // TODO(pascal): Re-enable once we have the user's consent.
      // Storage.setItem(ALPHA_LOCAL_STORAGE_KEY, '1')
      return true
    }
    Storage.removeItem(ALPHA_LOCAL_STORAGE_KEY)
    return false
  }
  return !!Storage.getItem(ALPHA_LOCAL_STORAGE_KEY)
}

function safeJsonParse<T>(jsonValue: string|null, defaultValue: T): T {
  if (!jsonValue) {
    return defaultValue
  }
  try {
    return JSON.parse(jsonValue)
  } catch {
    return defaultValue
  }
}

const initialUser = {
  projects: [{
    city: safeJsonParse<bayes.bob.FrenchCity|undefined>(
      Storage.getItem(CITY_LOCAL_STORAGE_KEY), undefined),
  }],
  ...getIsAlphaUser() ? {featuresEnabled: {alpha: true}} : undefined,
}

export default (state: bayes.bob.User = initialUser, action: AllUpskillingActions):
bayes.bob.User => {
  switch (action.type) {
    case 'SET_LOCAL_USER':
      return action.user
    case 'SET_LOCAL_USER_LOCALE':
      return {
        ...state,
        profile: {
          ...state?.profile,
          locale: action.locale,
        },
      }
    case 'UPSKILLING_SET_CITY':
      if (action.isPersistent) {
        Storage.setItem(CITY_LOCAL_STORAGE_KEY, JSON.stringify(action.city))
      } else {
        Storage.removeItem(CITY_LOCAL_STORAGE_KEY)
      }
      if (action.status === 'success') {
        return updateProject(state, {city: action.response})
      }
      if (config.areaSuggest === 'DEPARTEMENT' || action.city.name) {
        return updateProject(state, {city: action.city})
      }
      return updateProject(state, {city: action.city})
    case 'UPSKILLING_CLEAR_CITY':
      Storage.removeItem(CITY_LOCAL_STORAGE_KEY)
      return updateProject(state, {city: undefined})
    case 'SAVE_UPSKILLING_USER':
      return {
        ...state,
        profile: {
          ...state.profile,
          email: action.user.profile?.email,
        },
        projects: [
          ...state.projects || [],
          ...action.user.projects || [],
        ],
      }
  }
  return user(state, action as AllActions)
}
