
export const STATS_PAGE = 'stats'

const ROOT = '/'

const BOOTSTRAP_ROOT = ROOT + 'conseiller/'
const NEW_PROJECT_PAGE = ROOT + 'nouveau-projet'
const PROFILE_PAGE = ROOT + 'profil'
const PROJECT_PAGE = ROOT + 'projet'
const PROJECT_PATH = `${PROJECT_PAGE}/:projectId` as const
const STATIC_ADVICE_PAGE = ROOT + 'conseil'
const STRATEGY_PATH = PROJECT_PATH + '/:strategyId'

const Routes = {
  ACTION_PLAN_ACTION_PATH: `${PROJECT_PATH}/action/:actionId`,
  ACTION_PLAN_ACTION_PREVIEW_PATH: `${PROJECT_PATH}/previsualiser-action/:actionId`,
  ACTION_PLAN_INTRO_PAGE: `${PROJECT_PATH}/intro-plan-action`,
  ACTION_PLAN_PLAN_PAGE: `${PROJECT_PATH}/plan-action`,
  ACTION_PLAN_RECAP_PAGE: `${PROJECT_PATH}/resume-plan-action`,
  ACTION_PLAN_STRAT_PATH: `${PROJECT_PATH}/strategie-plan-action/:strategyId?`,
  ADVICE_PATH: STRATEGY_PATH + '/:adviceId',
  BOOTSTRAP_PAGE: BOOTSTRAP_ROOT + 'nouveau-profil-et-projet',
  BOOTSTRAP_ROOT,
  CONTRIBUTION_PAGE: ROOT + 'contribuer',
  COOKIES_PAGE: ROOT + 'cookies',
  COVID_PAGE: ROOT + 'covid-19',
  EMAILS_PAGE: PROFILE_PAGE + '/emails',
  IMILO_INTEGRATION_PAGE: BOOTSTRAP_ROOT + 'integration-imilo',
  INTRO_PAGE: ROOT + 'intro',
  INVITE_PATH: ROOT + 'invite',
  JOB_SIGNUP_PAGE: ROOT + 'metier/:romeId/:specificJobName',
  NEW_PROJECT_ONBOARDING_PAGES: NEW_PROJECT_PAGE + '/:stepName?',
  NEW_PROJECT_PAGE,
  PARTNERS_PAGE: ROOT + 'partenaires',
  PRIVACY_PAGE: ROOT + 'vie-privee',
  PROFESSIONALS_PAGE: ROOT + 'professionnels',
  PROFILE_ONBOARDING_PAGES: PROFILE_PAGE + '/:stepName?',
  PROFILE_PAGE,
  PROJECT_PAGE,
  PROJECT_PATH,
  RESOURCES_PAGE: BOOTSTRAP_ROOT + 'ressources',
  ROOT,
  SIGNUP_PAGE: ROOT + 'connexion',
  STATIC_ADVICE_PAGE,
  STATIC_ADVICE_PATH: STATIC_ADVICE_PAGE + '/:adviceId?',
  STATS_PATH: PROJECT_PATH + '/' + STATS_PAGE,
  STRATEGY_PATH,
  TEAM_PAGE: ROOT + 'equipe',
  TERMS_AND_CONDITIONS_PAGE: ROOT + 'conditions-generales',
  TRANSPARENCY_PAGE: ROOT + 'transparence',
  VIDEO_SIGNUP_PAGE: ROOT + 'inscription',
  VISION_PAGE: ROOT + 'notre-mission',
  WAITING_PAGE: ROOT + 'chargement',
} as const

export const staticPages = [
  Routes.CONTRIBUTION_PAGE,
  Routes.COOKIES_PAGE,
  Routes.COVID_PAGE,
  Routes.PARTNERS_PAGE,
  Routes.PRIVACY_PAGE,
  Routes.PROFESSIONALS_PAGE,
  Routes.STATIC_ADVICE_PATH,
  Routes.TEAM_PAGE,
  Routes.TERMS_AND_CONDITIONS_PAGE,
  Routes.TRANSPARENCY_PAGE,
  Routes.VIDEO_SIGNUP_PAGE,
  Routes.VISION_PAGE,
]

export const NEW_PROJECT_ID = 'nouveau'

// Sub pages of the project page.
export const ACHIEVEMENTS_PAGE = 'bravo'
export const CONVINCE_PAGE = 'priorite'

export const STRAT_PREVIEW_PAGE = 'comment'


export const SIGNUP_HASH = '#inscription'


// Builds an absolute URL from a relative URL, as given in the Routes object.
export const getAbsoluteUrl = (relativeUrl: string): string => {
  const {protocol, host} = window.location
  return `${protocol}//${host}${relativeUrl}`
}


export {Routes}
