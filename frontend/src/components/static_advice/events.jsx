import React from 'react'

import picto from 'images/advices/picto-events.png'

import {AdviceDetail, AdviceSection, StaticAdviceCardBase,
  StaticAdvicePage} from 'components/static_advice'
import {TestimonialCard, TestimonialStaticSection} from 'components/testimonials'


const adviceId = 'evenements'


const name = 'Meilleurs évènements emploi'


class Page extends React.Component {
  render() {
    return <StaticAdvicePage
      adviceId={adviceId}
      title="Trouvez les meilleurs évènements emploi avec Bob">
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
      <TestimonialStaticSection visualElement="events">
        <TestimonialCard
          author={{age: 40, jobName: 'Coordinatrice de formation', name: 'Sabine'}}
          isLong={true}>
          Je crois que vous avez raison. Je suis en train d'essayer, j'ai communiqué à des amis
          que je <strong>recherche</strong> et je suis allée à un évènement pour
          y <strong>postuler</strong> ensuite. Il faut que je sois plus active et tente ma chance.
          J'ai des rdv la semaine prochaine...<br />
          A bientôt
        </TestimonialCard>
        <TestimonialCard
          author={{age: 27, isMan: true, jobName: 'Gestionnaire comptable', name: 'Karim'}}
          isLong={true}>
          Dans Bob, ce que j'ai surtout aimé c'est l'info sur les <strong>actions locales </strong>
          même si j'étais plutôt à l'affut, j'ai pu en découvrir.
        </TestimonialCard>
        <TestimonialCard
          author={{age: 40, isMan: true, jobName: 'Responsable marketing', name: 'Julien'}}
          isLong={true}>
          <strong>J'ai trouvé un emploi</strong>, en partie grâce à votre site et aux très bons
          conseils que vous donnez.<br />
          Comment puis-je indiquer que je ne suis plus en recherche&nbsp;?<br />
          Merci pour tout.
        </TestimonialCard>
      </TestimonialStaticSection>
    </StaticAdvicePage>
  }
}


class StaticAdviceCard extends React.Component {
  render() {
    return <StaticAdviceCardBase picto={picto} name={name} {...this.props} >
      Des <strong>évènements emploi</strong> sélectionnés pour vous
    </StaticAdviceCardBase>
  }
}


export default {Page, StaticAdviceCard, adviceId, name}
