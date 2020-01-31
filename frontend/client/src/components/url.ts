const Routes: {[varName: string]: string} = {
  ROOT: '/',
}

export const STATS_PAGE = 'stats'

Routes.CONTRIBUTION_PAGE = Routes.ROOT + 'contribuer'
Routes.COOKIES_PAGE = Routes.ROOT + 'cookies'
Routes.IMILO_INTEGRATION_PAGE = Routes.ROOT + 'conseiller/integration-imilo'
Routes.PRIVACY_PAGE = Routes.ROOT + 'vie-privee'
Routes.PROFESSIONALS_PAGE = Routes.ROOT + 'professionnels'
Routes.STATIC_ADVICE_PAGE = Routes.ROOT + 'conseil'
Routes.STATIC_ADVICE_PATH = Routes.STATIC_ADVICE_PAGE + '/:adviceId?'
Routes.TEAM_PAGE = Routes.ROOT + 'equipe'
Routes.TERMS_AND_CONDITIONS_PAGE = Routes.ROOT + 'conditions-generales'
Routes.TRANSPARENCY_PAGE = Routes.ROOT + 'transparence'
Routes.VIDEO_SIGNUP_PAGE = Routes.ROOT + 'inscription'
Routes.VISION_PAGE = Routes.ROOT + 'notre-mission'
export const staticPages = [
  Routes.CONTRIBUTION_PAGE,
  Routes.COOKIES_PAGE,
  Routes.IMILO_INTEGRATION_PAGE,
  Routes.PRIVACY_PAGE,
  Routes.PROFESSIONALS_PAGE,
  Routes.STATIC_ADVICE_PATH,
  Routes.TEAM_PAGE,
  Routes.TERMS_AND_CONDITIONS_PAGE,
  Routes.TRANSPARENCY_PAGE,
  Routes.VIDEO_SIGNUP_PAGE,
  Routes.VISION_PAGE,
]

Routes.PROFILE_PAGE = Routes.ROOT + 'profil'
Routes.PROFILE_ONBOARDING_PAGES = Routes.PROFILE_PAGE + '/:stepName?'
Routes.NEW_PROJECT_PAGE = Routes.ROOT + 'nouveau-projet'
Routes.NEW_PROJECT_ONBOARDING_PAGES = Routes.NEW_PROJECT_PAGE + '/:stepName?'
Routes.PROJECT_PAGE = Routes.ROOT + 'projet'
Routes.PROJECT_PATH = Routes.PROJECT_PAGE + '/:projectId'
Routes.STATS_PATH = Routes.PROJECT_PATH + '/' + STATS_PAGE
Routes.STRATEGY_PATH = Routes.PROJECT_PATH + '/:strategyId'
Routes.ADVICE_PATH = Routes.STRATEGY_PATH + '/:adviceId'
Routes.WAITING_PAGE = Routes.ROOT + 'chargement'
Routes.JOB_SIGNUP_PAGE = Routes.ROOT + 'metier/:romeId/:specificJobName'
Routes.EVAL_PAGE = Routes.ROOT + 'eval'
Routes.CONCEPT_EVAL_PAGE = Routes.EVAL_PAGE + '/concept'
Routes.EVAL_PATH = Routes.EVAL_PAGE + '/:useCaseId?'
Routes.BOOTSTRAP_PAGE = Routes.ROOT + 'conseiller/nouveau-profil-et-projet'
Routes.RESOURCES_PAGE = Routes.ROOT + 'conseiller/ressources'
Routes.INVITE_PATH = Routes.ROOT + 'invite'
Routes.INTRO_PAGE = Routes.ROOT + 'intro'
Routes.SIGNUP_PAGE = Routes.ROOT + 'connexion'

export const NEW_PROJECT_ID = 'nouveau'

export const FEEDBACK_TAB = 'evaluer'

export const SIGNUP_HASH = '#inscription'


// Builds an absolute URL from a relative URL, as given in the Routes object.
export const getAbsoluteUrl = (relativeUrl: string): string => {
  const {protocol, host} = window.location
  return `${protocol}//${host}${relativeUrl}`
}


export {Routes}
