import React, {useMemo} from 'react'
import {useSelector} from 'react-redux'

import type {RootState} from 'store/actions'
import {removeAuthDataAction} from 'store/actions'
import isMobileVersion from 'store/mobile'
import {prepareT} from 'store/i18n'

import type {CookieProps} from 'components/cookies_explanation'
import CookiesExplanation, {CookiesTitle} from 'components/cookies_explanation'
import {StaticPage, blueStyle} from 'components/static'


const style = {
  fontSize: 16,
  lineHeight: 1.63,
  padding: isMobileVersion ? '60px 20px' : '90px 150px',
}


const headerStyle: React.CSSProperties = {
  fontSize: '1em',
  fontWeight: 'bold',
  margin: 0,
}


const accountIdCookie = {
  clearAction: removeAuthDataAction,
  clearCaption: prepareT('Déconnecter mon compte'),
  description: prepareT(
    "Ce cookie permet de se souvenir de votre compte {{productName}} pour éviter d'avoir à vous " +
    'réidentifier à chaque visite.'),
  id: 'auth',
  selector: ({app, user}: RootState): boolean => !!user.userId || !!app.authToken,
  title: prepareT('Identifiants {{productName}}'),
}
const guestAccountCookie = {
  clearAction: removeAuthDataAction,
  clearCaption: prepareT('Supprimer toutes mes données'),
  description: prepareT(
    'Ce cookie permet de se souvenir de vos réponses aux questions de {{productName}} pour ' +
    'éviter de recommencer à zéro si vous fermez votre navigateur'),
  id: 'auth',
  selector: ({app, user}: RootState): boolean => !!user.userId || !!app.authToken,
  title: prepareT("Données de recherche d'emploi"),
}

const CookiesPage: React.FC = (): React.ReactElement => {
  const user = useSelector(({user}: RootState) => user)
  const {hasAccount} = user
  const bobCookies = useMemo((): readonly CookieProps[] => [
    hasAccount ? accountIdCookie : guestAccountCookie,
  ], [hasAccount])
  return <StaticPage page="cookies" title={<CookiesTitle strongStyle={blueStyle} />} style={style}>
    <CookiesExplanation headerStyle={headerStyle} cookies={bobCookies} />
  </StaticPage>
}


export default React.memo(CookiesPage)
