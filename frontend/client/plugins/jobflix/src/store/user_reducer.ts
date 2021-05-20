import Storage from 'local-storage-fallback'

import {AllActions} from 'store/actions'
import user, {updateProject} from 'store/user_reducer'

import {AllUpskillingActions} from './actions'

const DEPARTEMENT_LOCAL_STORAGE_KEY = 'upskilling:departement-id'

const initialUser = {
  projects: [{city: {departementId: Storage.getItem(DEPARTEMENT_LOCAL_STORAGE_KEY) || undefined}}],
}

export default (state: bayes.bob.User = initialUser, action: AllUpskillingActions):
bayes.bob.User => {
  switch (action.type) {
    case 'SET_LOCAL_USER':
      if (action.user.projects?.[0]?.city?.departementId) {
        Storage.setItem(DEPARTEMENT_LOCAL_STORAGE_KEY,
          action.user.projects?.[0]?.city?.departementId)
      }
      return action.user
    case 'UPSKILLING_SET_DEPARTEMENT':
      Storage.setItem(DEPARTEMENT_LOCAL_STORAGE_KEY, action.departementId)
      return updateProject(state, {city: {departementId: action.departementId}})
  }
  return user(state, action as AllActions)
}
