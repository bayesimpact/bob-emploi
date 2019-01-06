const Routes = {
  ROOT: '/',
}

Routes.COOKIES_PAGE = Routes.ROOT + 'cookies'
Routes.VISION_PAGE = Routes.ROOT + 'notre-mission'
Routes.CONTRIBUTION_PAGE = Routes.ROOT + 'contribuer'
Routes.PROFILE_PAGE = Routes.ROOT + 'profil'
Routes.PROFILE_ONBOARDING_PAGES = Routes.PROFILE_PAGE + '/:stepName?'
Routes.NEW_PROJECT_PAGE = Routes.ROOT + 'nouveau-projet'
Routes.NEW_PROJECT_ONBOARDING_PAGES = Routes.NEW_PROJECT_PAGE + '/:stepName?'
Routes.PROJECT_PAGE = Routes.ROOT + 'projet'
Routes.PROJECT_PATH = Routes.PROJECT_PAGE + '/:projectId?'
Routes.ADVICE_SUB_PAGE = '/conseil'
Routes.ADVICE_PATH = Routes.PROJECT_PATH + Routes.ADVICE_SUB_PAGE + '/:adviceId'
Routes.WAITING_PAGE = Routes.ROOT + 'chargement'
Routes.TERMS_AND_CONDITIONS_PAGE = Routes.ROOT + 'conditions-generales'
Routes.PRIVACY_PAGE = Routes.ROOT + 'vie-privee'
Routes.APP_UPDATED_PAGE = Routes.ROOT + 'mise-a-jour'
Routes.PROFESSIONALS_PAGE = Routes.ROOT + 'professionnels'
Routes.TRANSPARENCY_PAGE = Routes.ROOT + 'transparence'
Routes.TEAM_PAGE = Routes.ROOT + 'equipe'
Routes.VIDEO_SIGNUP_PAGE = Routes.ROOT + 'inscription'
Routes.JOB_SIGNUP_PAGE = Routes.ROOT + 'metier/:romeId/:specificJobName'
Routes.EVAL_PAGE = Routes.ROOT + 'eval'
Routes.EVAL_PATH = Routes.EVAL_PAGE + '/:useCaseId?'
Routes.BOOTSTRAP_PAGE = Routes.ROOT + 'conseiller/nouveau-profil-et-projet'
Routes.RESOURCES_PAGE = Routes.ROOT + 'conseiller/ressources'
Routes.INVITE_PATH = Routes.ROOT + 'invite'
Routes.STATIC_ADVICE_PAGE = Routes.ROOT + 'conseil'
Routes.STATIC_ADVICE_PATH = Routes.STATIC_ADVICE_PAGE + '/:adviceId?'
Routes.IMILO_INTEGRATION_PAGE = Routes.ROOT + 'conseiller/integration-imilo'
// TODO(cyrille): Drop the following 4 urls.
Routes.OLD_MAYDAY_PAGE = Routes.ROOT + 'bob-action'
Routes.MAYDAY_PAGE = Routes.ROOT + 'BobAction'
Routes.MAYDAY_THANK_YOU_PAGE = Routes.MAYDAY_PAGE + '/merci'
Routes.MAYDAY_COFFEE_PAGE = Routes.MAYDAY_PAGE + '/formulaire-cafe'
Routes.QUICK_DIAGNOSTIC_PAGE = Routes.ROOT + 'diagnostic'
Routes.QUICK_DIAGNOSTIC_PATH = Routes.QUICK_DIAGNOSTIC_PAGE + '/:jobName/:cityName'

export const NEW_PROJECT_ID = 'nouveau'

export const FEEDBACK_TAB = 'evaluer'


// Builds an absolute URL from a relative URL, as given in the Routes object.
export const getAbsoluteUrl = relativeUrl => {
  const {protocol, host} = window.location
  return `${protocol}//${host}${relativeUrl}`
}


export {Routes}
