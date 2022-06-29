import React from 'react'

import {prepareT} from 'store/i18n'
import isMobileVersion from 'store/mobile'

import CookiesExplanation, {CookiesTitle} from 'components/cookies_explanation'

import {clearCityAction, clearFavoritesAction} from '../../store/actions'

const pageStyle: React.CSSProperties = {
  margin: 'auto',
  maxWidth: 1200,
  overflowX: 'hidden',
}
const separatorStyle: React.CSSProperties = {
  backgroundColor: colors.BACKGROUND_GREY,
  border: 'none',
  height: 1,
  width: '100%',
}

const footerSectionHeaderStyle: React.CSSProperties = {
  alignItems: 'center',
  alignSelf: 'center',
  display: 'flex',
  fontSize: 50,
  fontWeight: 'normal',
  justifyContent: 'center',
  lineHeight: 1,
  minHeight: 200,
  padding: isMobileVersion ? '20px 0' : 'initial',
  textAlign: 'center',
}
const contentStyle: React.CSSProperties = {
  flex: 1,
  padding: isMobileVersion ? 20 : 100,
}

const favoriteCookies = {
  clearAction: clearFavoritesAction,
  clearCaption: prepareT('Supprimer ma liste de favoris'),
  description: prepareT(
    'Cette fonctionnalité vous permet de choisir certains métiers au cours de votre exploration ' +
    "et de les mettre dans une liste de favoris afin d'y revenir plus tard."),
  id: 'favorite',
  selector: ({app}: {app: AppState}): boolean =>
    !!app.upskillingEvaluatedJobs?.length || !!app.upskillingSelectedJobs?.length,
  title: prepareT('Vos métiers favoris'),
}
const departementCookies = {
  clearAction: clearCityAction,
  // i18next-extract-mark-context-next-line ["fr_DEPARTEMENT", "uk_CITY", "fr_CITY"]
  clearCaption: prepareT('Oublier mon département'),
  // i18next-extract-mark-context-next-line ["fr_DEPARTEMENT", "uk_CITY", "fr_CITY"]
  description: prepareT(
    'Vous pouvez conserver votre département dans un cookie pour éviter de le re-saisir à chaque ' +
    'visite.'),
  id: 'departement',
  selector: ({app}: {app: AppState}): boolean => !!app.upskillingIsCityPersistent,
  // i18next-extract-mark-context-next-line ["fr_DEPARTEMENT", "uk_CITY", "fr_CITY"]
  title: prepareT('Votre département'),
}

const jobflixCookies = [favoriteCookies, departementCookies]

const CookiesPage = () => {
  return <div>
    <div style={pageStyle}>
      <h1 style={footerSectionHeaderStyle}>
        <CookiesTitle />
      </h1>

      <hr style={separatorStyle} />

      <div style={contentStyle}>
        <CookiesExplanation cookies={jobflixCookies} />
      </div>
    </div>
  </div>
}

export default React.memo(CookiesPage)
