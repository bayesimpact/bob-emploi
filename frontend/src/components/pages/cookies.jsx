import React from 'react'

import {StaticPage, StrongTitle} from 'components/static'


class CookiesPage extends React.Component {
  render() {
    return <StaticPage page="cookies" title={<span>
      Qu'est ce qu'un <StrongTitle>cookie</StrongTitle>&nbsp;?
    </span>} style={{fontSize: 16, lineHeight: 1.63, padding: '90px 150px'}}>
      <strong>Qu'est-ce que sont les cookies ?</strong><br />
      Les cookies sont des fichiers stockés dans votre navigateur par les sites
      que vous visitez. C'est une pratique courante utilisée par la majorité
      des sites webs. Notre site utilise les cookies pour améliorer votre
      expérience en se rappelant de vos préférences et en activant d'autres
      fonctionnalités basées sur les cookies (ex : outils d'analyse).

      <br /><br />

      <strong>Nos cookies 🍪</strong><br />
      Lorsque vous soumettez des données via un formulaire, tel que les
      formulaires de contact ou de commentaires, les cookies peuvent servir à
      sauver certaines informations vous concernant pour un usage futur.

      <br /><br />

      Dans le but de nous souvenir de vos préférences afin d'améliorer votre
      expérience, nous devons utiliser des cookies. Les informations stockées
      dans les cookies nous permettent de retrouver vos informations chaque
      fois que vous interagissez avec une page.

      <br /><br />

      <strong>Cookies tierce-parties</strong><br />
      Dans certains cas, nous utilisons aussi des cookies provenant de
      tierce-parties comme Amplitude. Ces services d'analyse nous fournissent
      des données concernant votre navigation, ce qui nous permet d'améliorer
      notre contenu.

      <br /><br />

      <strong>Comment désactiver les cookies ?</strong><br />
      La plupart des navigateurs vous offrent la possibilité de refuser l'usage
      des cookies. Consultez la rubrique "outils" ou "aide" de votre
      navigateur. Désactiver les cookies pourrait cependant affecter certaines
      fonctionnalités de ce site ou d'autres. C'est pourquoi nous vous
      recommandons de ne pas les désactiver.
    </StaticPage>
  }
}

export {CookiesPage}
