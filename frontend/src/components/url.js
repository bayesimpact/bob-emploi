const Routes = {
  ROOT: '/',
}

Routes.COOKIES_PAGE = Routes.ROOT + 'cookies'
Routes.VISION_PAGE = Routes.ROOT + 'notre-mission'
Routes.CONTRIBUTION_PAGE = Routes.ROOT + 'contribuer'
Routes.PROFILE_PAGE = Routes.ROOT + 'profil'
Routes.PROFILE_ONBOARDING_PAGES = Routes.ROOT + 'profil/:stepName'
Routes.DASHBOARD_PAGE = Routes.ROOT + 'actions'
Routes.DASHBOARD_ACTION_PAGE = Routes.ROOT + 'actions/:actionId'
Routes.DISCOVERY_PAGE = Routes.ROOT + 'explorer'
Routes.PROJECT_PAGE = Routes.ROOT + 'projet'
Routes.DASHBOARD_EXPORT_FOLDER = Routes.ROOT + 'historique-des-actions'
// Keep in sync with the same URL on the server.
Routes.DASHBOARD_EXPORT = Routes.DASHBOARD_EXPORT_FOLDER + '/:dashboardExportId'
Routes.WAITING_PAGE = Routes.ROOT + 'chargement'
Routes.TERMS_AND_CONDITIONS_PAGE = Routes.ROOT + 'conditions-generales'
Routes.PRIVACY_PAGE = Routes.ROOT + 'vie-privee'
Routes.APP_NOT_AVAILABLE_PAGE = Routes.ROOT + 'indisponible'


export {Routes}
