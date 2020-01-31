import React from 'react'

import {Trans} from 'components/i18n'
import {isMobileVersion} from 'components/mobile'
import {StaticPage, StrongTitle} from 'components/static'


const style = {
  fontSize: 16,
  lineHeight: 1.63,
  padding: isMobileVersion ? '60px 20px' : '90px 150px',
}


const strongStyle: React.CSSProperties = {
  fontWeight: 'bold',
}


const CookiesPage: React.FC = (): React.ReactElement => {
  return <StaticPage page="cookies" title={<Trans parent="span">
    Qu'est ce qu'un <StrongTitle>cookie</StrongTitle>&nbsp;?
  </Trans>} style={style}>
    <Trans style={strongStyle}>
      Qu'est-ce que sont les cookies&nbsp;?
    </Trans>
    <Trans>
      Les cookies sont des fichiers stockés dans votre navigateur par les sites
      que vous visitez. C'est une pratique courante utilisée par la majorité
      des sites webs. Notre site utilise les cookies pour améliorer votre
      expérience en se rappelant de vos préférences et en activant d'autres
      fonctionnalités basées sur les cookies (ex&nbsp;: outils d'analyse).
    </Trans>

    <br />

    <Trans style={strongStyle}>
      Nos cookies <span role="img" aria-label="">🍪</span>
    </Trans>
    <Trans>
      Lorsque vous soumettez des données via un formulaire, tel que les
      formulaires de contact ou de commentaires, les cookies peuvent servir à
      sauver certaines informations vous concernant pour un usage futur.
    </Trans>

    <br />

    <Trans>
      Dans le but de nous souvenir de vos préférences afin d'améliorer votre
      expérience, nous devons utiliser des cookies. Les informations stockées
      dans les cookies nous permettent de retrouver vos informations chaque
      fois que vous interagissez avec une page.
    </Trans>

    <br />

    <Trans style={strongStyle}>
      Cookies tierce-parties
    </Trans>
    <Trans>
      Dans certains cas, nous utilisons aussi des cookies provenant de
      tierce-parties comme Amplitude. Ces services d'analyse nous fournissent
      des données concernant votre navigation, ce qui nous permet d'améliorer
      notre contenu.
    </Trans>

    <br />

    <Trans style={strongStyle}>
      Comment désactiver les cookies&nbsp;?
    </Trans>
    <Trans>
      La plupart des navigateurs vous offrent la possibilité de refuser l'usage
      des cookies. Consultez la rubrique "outils" ou "aide" de votre
      navigateur. Désactiver les cookies pourrait cependant affecter certaines
      fonctionnalités de ce site ou d'autres. C'est pourquoi nous vous
      recommandons de ne pas les désactiver.
    </Trans>
  </StaticPage>
}


export default React.memo(CookiesPage)
