import React from 'react'

import picto from 'images/advices/picto-improve-interview.png'

import {AdviceDetail, AdviceSection, StaticAdviceCardBase,
  StaticAdvicePage} from 'components/static_advice'
import {TestimonialCard, TestimonialStaticSection} from 'components/testimonials'


const adviceId = 'entretien'


const name = "Entretien d'embauche"


class Page extends React.Component {
  render() {
    return <StaticAdvicePage
      adviceId={adviceId}
      title="Préparez vos entretiens d'embauche avec Bob">
      <AdviceSection
        adviceId={adviceId} title="réussir vos entretiens d'embauche">
        <AdviceDetail>
          La liste des qualités à mettre en avant <strong>selon votre métier</strong> pour vous
          aider à réussir vos entretiens.
        </AdviceDetail>
        <AdviceDetail>
          Une sélection de réponses à préparer et de bonnes questions à poser
          au <strong>recruteur</strong> à la fin de vos entretiens.
        </AdviceDetail>
        <AdviceDetail>
          Des exemples de <strong>mails de remerciement</strong> à envoyer après l'entretien.
        </AdviceDetail>
      </AdviceSection>
      <TestimonialStaticSection visualElement="improve-interview">
        <TestimonialCard
          author={{age: 55, isMan: true, jobName: 'Dessinateur de la construction', name: 'Marc'}}
          isLong={true}>
          Plein de <strong>bons conseils</strong> pour l'entretien que je vais mettre en
          œuvre. Merci de ces conseils.
        </TestimonialCard>
        <TestimonialCard
          author={{age: 21, jobName: 'Secrétaire médicale', name: 'Élodie'}} isLong={true}>
          Les conseils personnalisés et les recommandations de sites vraiment utiles dans
          ma <strong>recherche d'emploi</strong>. Ça me motive et j'ai l'impression que je ne suis
          pas toute seule dans cette démarche qui est assez lourde pour moi. Merci&nbsp;!
        </TestimonialCard>
        <TestimonialCard
          author={{age: 26, jobName: 'Assistante ressources humaines', name: 'Rose'}} isLong={true}>
          Je souhaiterais vous remercier pour tout ce que vous faites, j'ai découvert votre
          site hier et je me demande pourquoi on ne m'en as pas parlé avant&nbsp;!!! (…) je veux
          vous remercier parce que <strong>votre site est incroyable&nbsp;!!!</strong>
        </TestimonialCard>
      </TestimonialStaticSection>
    </StaticAdvicePage>
  }
}


class StaticAdviceCard extends React.Component {
  render() {
    return <StaticAdviceCardBase picto={picto} name={name} {...this.props} >
      Les bonnes questions à préparer avant un <strong>entretien d'embauche</strong>
    </StaticAdviceCardBase>
  }
}


export default {Page, StaticAdviceCard, adviceId, name}
