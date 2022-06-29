import React, {useCallback} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'
import type {Action} from 'redux'

import type {RootState} from 'store/actions'
import type {LocalizableString} from 'store/i18n'
import {combineTOptions} from 'store/i18n'

import Button from 'components/button'
import Trans from 'components/i18n_trans'

interface TitleProps {
  strongStyle?: React.CSSProperties
}

const CookiesTitleBase = ({strongStyle}: TitleProps): React.ReactElement =>
  <Trans parent="span" ns="components">
    Qu'est ce qu'un <strong style={strongStyle}>cookie</strong>&nbsp;?
  </Trans>
export const CookiesTitle = React.memo(CookiesTitleBase)

export interface CookieProps {
  clearAction: Action
  clearCaption?: LocalizableString
  description: LocalizableString
  id: string
  selector: (reduxState: RootState) => boolean
  title: LocalizableString
}

const CookieDescriptionBase = (props: CookieProps): React.ReactElement => {
  const {clearAction, clearCaption, description, id, selector, title} = props
  const {t, t: translate} = useTranslation('components')
  const isCookieEnabled = useSelector(selector)
  const dispatch = useDispatch()
  const clearCookie = useCallback(() => dispatch(clearAction), [clearAction, dispatch])
  return <li id={id}>
    <h3>{translate(...combineTOptions(title, {productName: config.productName}))}</h3>
    <p>{t('État du cookie\u00A0:')} {isCookieEnabled ?
      t('Activé') : t("Non utilisé pour l'instant")}</p>
    <p>{translate(...combineTOptions(description, {productName: config.productName}))}</p>
    {isCookieEnabled ? <Button onClick={clearCookie}>
      {clearCaption ? translate(...clearCaption) : t('Supprimer ce cookie')}
    </Button> : null}
  </li>
}
const CookieDescription = React.memo(CookieDescriptionBase)

const cookiesListStyle: React.CSSProperties = {
  listStyleType: 'none',
  margin: 0,
  padding: 0,
}

interface Props {
  cookies?: readonly CookieProps[]
  headerStyle?: React.CSSProperties
}

const CookiesExplanation = ({cookies, headerStyle}: Props): React.ReactElement => {
  return <React.Fragment>
    <Trans style={headerStyle} parent="h2" ns="components">
      Qu'est-ce que sont les cookies&nbsp;?
    </Trans>
    <Trans ns="components">
      Les cookies sont des fichiers stockés dans votre navigateur par les sites
      que vous visitez. C'est une pratique courante utilisée par la majorité
      des sites webs. Notre site utilise les cookies pour améliorer votre
      expérience en se rappelant de vos préférences et en activant d'autres
      fonctionnalités basées sur les cookies (ex&nbsp;: outils d'analyse).
    </Trans>

    <br />

    <Trans style={headerStyle} parent="h2" ns="components">
      Nos cookies <span aria-hidden={true}>🍪</span>
    </Trans>
    {cookies?.length ? <ul style={cookiesListStyle}>
      {cookies.map(cookie => <CookieDescription key={cookie.id} {...cookie} />)}
    </ul> : <React.Fragment>
      <Trans ns="components">
        Lorsque vous soumettez des données via un formulaire, tel que les
        formulaires de contact ou de commentaires, les cookies peuvent servir à
        sauver certaines informations vous concernant pour un usage futur.
      </Trans>

      <br />

      <Trans ns="components">
        Dans le but de nous souvenir de vos préférences afin d'améliorer votre
        expérience, nous devons utiliser des cookies. Les informations stockées
        dans les cookies nous permettent de retrouver vos informations chaque
        fois que vous interagissez avec une page.
      </Trans>
    </React.Fragment>}

    <br />

    <Trans style={headerStyle} parent="h2" ns="components">
      Cookies tierce-parties
    </Trans>
    <Trans ns="components">
      Dans certains cas, nous utilisons aussi des cookies provenant de
      tierce-parties comme Amplitude. Ces services d'analyse nous fournissent
      des données concernant votre navigation, ce qui nous permet d'améliorer
      notre contenu.
    </Trans>

    <br />

    <Trans style={headerStyle} parent="h2" ns="components">
      Comment désactiver les cookies&nbsp;?
    </Trans>
    <Trans ns="components">
      La plupart des navigateurs vous offrent la possibilité de refuser l'usage
      des cookies. Consultez la rubrique "outils" ou "aide" de votre
      navigateur. Désactiver les cookies pourrait cependant affecter certaines
      fonctionnalités de ce site ou d'autres. C'est pourquoi nous vous
      recommandons de ne pas les désactiver.
    </Trans>
  </React.Fragment>
}

export default React.memo(CookiesExplanation)
