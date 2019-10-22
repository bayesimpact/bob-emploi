import React from 'react'

import {TestimonialCard} from 'components/testimonials'
import picto from 'images/advices/picto-events.svg'

import {AdviceDetail, AdvicePageProps, AdviceSection, CardProps, StaticAdviceCardBase,
  StaticAdvicePage} from './base'


const adviceId = 'evenements'


const name = 'Meilleurs évènements emploi'


const TESTIMONIALS = [
  <TestimonialCard
    author={{age: 40, jobName: 'Coordinatrice de formation', name: 'Sabine'}}
    isLong={true}
    key="testimonial-1">
    Je crois que vous avez raison. Je suis en train d'essayer, j'ai communiqué à des amis
    que je <strong>recherche</strong> et je suis allée à un évènement pour
    y <strong>postuler</strong> ensuite. Il faut que je sois plus active et tente ma chance.
    J'ai des rdv la semaine prochaine...<br />
    A bientôt
  </TestimonialCard>,
  <TestimonialCard
    author={{age: 27, isMan: true, jobName: 'Gestionnaire comptable', name: 'Karim'}}
    isLong={true}
    key="testimonial-2">
    Dans Bob, ce que j'ai surtout aimé c'est l'info sur les <strong>actions locales </strong>
    même si j'étais plutôt à l'affut, j'ai pu en découvrir.
  </TestimonialCard>,
  <TestimonialCard
    author={{age: 40, isMan: true, jobName: 'Responsable marketing', name: 'Julien'}}
    isLong={true}
    key="testimonial-3">
    <strong>J'ai trouvé un emploi</strong>, en partie grâce à votre site et aux très bons
    conseils que vous donnez.<br />
    Comment puis-je indiquer que je ne suis plus en recherche&nbsp;?<br />
    Merci pour tout.
  </TestimonialCard>,
]


class Page extends React.PureComponent<AdvicePageProps> {
  public render(): React.ReactNode {
    return <StaticAdvicePage
      adviceId={adviceId} {...this.props}
      testimonials={TESTIMONIALS}
      title={`Trouvez les meilleurs évènements emploi avec ${config.productName}`}>
      <AdviceSection
        adviceId={adviceId} title="rencontrer des gens à des évènements">
        <AdviceDetail>
          Une sélection d'évènements et de <strong>salons de l'emploi</strong> près de chez vous.
        </AdviceDetail>
        <AdviceDetail>
          Des astuces pour aller vers les gens pendant l'évènement et
          des <strong>exemples de mails</strong> pour garder le contact après.
        </AdviceDetail>
        <AdviceDetail>
          Une sélection des meilleurs <strong>outils gratuits</strong> pour trouver des
          évènements près de chez vous.
        </AdviceDetail>
      </AdviceSection>
    </StaticAdvicePage>
  }
}


class StaticAdviceCard extends React.PureComponent<CardProps> {
  public render(): React.ReactNode {
    return <StaticAdviceCardBase picto={picto} name={name} {...this.props} >
      Des <strong>évènements emploi</strong> sélectionnés pour vous
    </StaticAdviceCardBase>
  }
}


export default {Page, StaticAdviceCard, adviceId, name}
