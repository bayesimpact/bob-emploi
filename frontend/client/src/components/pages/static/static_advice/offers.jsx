import React from 'react'

import picto from 'images/advices/picto-find-a-jobboard.png'

import {TestimonialCard} from 'components/testimonials'

import {AdviceDetail, AdviceSection, StaticAdviceCardBase, StaticAdvicePage} from './base'


const adviceId = 'offres'


const name = "Plus d'offres d'emploi"


class Page extends React.Component {
  render() {
    return <StaticAdvicePage
      adviceId={adviceId} {...this.props}
      testimonials={[
        <TestimonialCard
          author={{age: 28, isMan: true, jobName: 'Data scientist', name: 'Jean-Christophe'}}
          isLong={true}
          key="testimonial-1">
          Je cherchais à <strong>changer d'entreprise</strong> et je l'ai fait en partie grâce
          aux conseils de Bob.<br />
          J'ai vraiment trouvé l'idée de <strong>Bob emploi géniale</strong>. (…) J'ai même envisagé
          de <strong>postuler</strong> en candidat libre chez vous. <br />
          J'ai finalement trouvé un super poste avant d'avoir eu l'occasion de le faire.
        </TestimonialCard>,
        <TestimonialCard
          author={{age: 55, jobName: 'Formatrice', name: 'Nadia'}}
          isLong={true}
          key="testimonial-2">
          Pour ma part, je trouve votre site plutôt extraordinaire, en tout cas un outil vraiment
          utile dans une recherche d'informations liées à <strong>un métier, un emploi</strong> et
          le <strong>marché</strong> qui gravite autour.
        </TestimonialCard>,
        <TestimonialCard
          author={{age: 48, jobName: 'Animatrice nature environnement', name: 'Simone'}}
          isLong={true}
          key="testimonial-3">
          Ho whaooooo...<br />
          je viens de trouver 6 <strong>sites spécialisés pour mon métier</strong>&nbsp;! Je vais
          donner un coup d'œil aux différents sites et imprimer tout ce que je trouverai d'utile
          pour défendre mon cas et faire repartir le dossier 😊<br />
          Merci vraiment beaucoup pour cette plateforme si intéressante que j'ai hate
          de voir se développer.
        </TestimonialCard>,
      ]}
      title="Trouvez des offres d'emploi, qu'elles soient publiées ou pas">
      <AdviceSection
        adviceId={adviceId} title="trouver des offres d'emploi">
        <AdviceDetail>
          Des conseils pour dénicher des offres et vous attaquer au <strong>marché caché</strong>.
        </AdviceDetail>
        <AdviceDetail>
          Une sélection des <strong>meilleurs sites d'offres</strong> pour trouver des offres dans
          votre domaine.
        </AdviceDetail>
        <AdviceDetail>
          Des conseils pour pouvoir lire entre les lignes et analyser ce
          que <strong>recherchent les recruteurs</strong>.
        </AdviceDetail>
      </AdviceSection>
    </StaticAdvicePage>
  }
}


class StaticAdviceCard extends React.Component {
  render() {
    return <StaticAdviceCardBase picto={picto} name={name} {...this.props} >
      Les meilleurs sites de <strong>recherche d'emploi</strong> pour trouver
      des <strong>offres</strong>
    </StaticAdviceCardBase>
  }
}


export default {Page, StaticAdviceCard, adviceId, name}
