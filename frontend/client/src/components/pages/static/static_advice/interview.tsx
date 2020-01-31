import React from 'react'

import {prepareT} from 'store/i18n'

import {TestimonialCard} from 'components/testimonials'
import picto from 'images/advices/picto-improve-interview.svg'

import {AdviceDetail, AdvicePageProps, AdviceSection, CardProps, StaticAdviceCardBase,
  StaticAdvicePage} from './base'


const adviceId = 'entretien'


// i18next-extract-mark-ns-next-line staticAdviceTitle
const name = prepareT("Entretien d'embauche")


const TESTIMONIALS = [
  <TestimonialCard
    author={{age: 55, isMan: true, jobName: 'Dessinateur de la construction', name: 'Marc'}}
    isLong={true}
    key="testimonial-1">
    Plein de <strong>bons conseils</strong> pour l'entretien que je vais mettre en
    œuvre. Merci de ces conseils.
  </TestimonialCard>,
  <TestimonialCard
    author={{age: 21, jobName: 'Secrétaire médicale', name: 'Élodie'}}
    isLong={true}
    key="testimonial-2">
    Les conseils personnalisés et les recommandations de sites vraiment utiles dans
    ma <strong>recherche d'emploi</strong>. Ça me motive et j'ai l'impression que je ne suis
    pas toute seule dans cette démarche qui est assez lourde pour moi. Merci&nbsp;!
  </TestimonialCard>,
  <TestimonialCard
    author={{age: 26, jobName: 'Assistante ressources humaines', name: 'Rose'}}
    isLong={true}
    key="testimonial-3">
    Je souhaiterais vous remercier pour tout ce que vous faites, j'ai découvert votre
    site hier et je me demande pourquoi on ne m'en as pas parlé avant&nbsp;!!! (…) je veux
    vous remercier parce que <strong>votre site est incroyable&nbsp;!!!</strong>
  </TestimonialCard>,
]


const Page: React.FC<AdvicePageProps> = (props: AdvicePageProps): React.ReactElement =>
  <StaticAdvicePage
    adviceId={adviceId} {...props}
    testimonials={TESTIMONIALS}
    title={`Préparez vos entretiens d'embauche avec ${config.productName}`}>
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
  </StaticAdvicePage>


const StaticAdviceCard: React.FC<CardProps> = (props: CardProps): React.ReactElement =>
  <StaticAdviceCardBase picto={picto} name={name} {...props} >
    Les bonnes questions à préparer avant un <strong>entretien d'embauche</strong>
  </StaticAdviceCardBase>


export default {
  Page: React.memo(Page),
  StaticAdviceCard: React.memo(StaticAdviceCard),
  adviceId,
  name,
}
