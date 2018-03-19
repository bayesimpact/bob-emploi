import React from 'react'

import picto from 'images/advices/picto-body-language.png'

import {AdviceDetail, AdviceSection, StaticAdviceCardBase,
  StaticAdvicePage} from 'components/static_advice'
import {TestimonialCard, TestimonialStaticSection} from 'components/testimonials'


const adviceId = 'confiance'


const name = 'Confiance en soi'


class Page extends React.Component {
  render() {
    return <StaticAdvicePage
      adviceId={adviceId}
      title="Boostez votre confiance en vous avec Bob">
      <AdviceSection
        adviceId={adviceId} title="avoir plus confiance en vous">
        <AdviceDetail>
          Des <strong>mini-conférences</strong> inspirantes pour vous aider à reprendre confiance
          en vous.
        </AdviceDetail>
        <AdviceDetail>
          Des <strong>tests de personnalités</strong> pour mieux vous connaître et identifier
          vos forces.
        </AdviceDetail>
        <AdviceDetail>
          Des conseils pour vous sentir d'attaque avant un <strong>entretien</strong>.
        </AdviceDetail>
      </AdviceSection>
      <TestimonialStaticSection visualElement="self-confidence">
        <TestimonialCard
          author={{age: 32, isMan: true, jobName: 'Développeur informatique', name: 'Vincent'}}
          isLong={true}>
          Un infini «&nbsp;merci&nbsp;» à toute l'équipe de Bob. Votre accompagnement m'a aidé
          à <strong>changer de métier</strong>.<br />
          Au-delà de vos outils, déconcertants d'efficacité, c'est de la vie et de l'envie que vous
          m'avez redonné.
          J'ai ré-appris à regarder, écouter autour de moi. Et j'y ai découvert des choses
          fabuleuses.<br />
          Merci encore.
        </TestimonialCard>
        <TestimonialCard
          author={{age: 26, jobName: 'Responsable juridique', name: 'Marion'}} isLong={true}>
          Cela m'a appris plus sur ma <strong>personnalité</strong>, les points à améliorer et
          les directions à prendre.
        </TestimonialCard>
        <TestimonialCard
          author={{age: 35, jobName: "Responsable d'association à caractère social", name: 'Léa'}}
          isLong={true}>
          Le destin fait vraiment bien les choses puisqu'il s'avère que j'ai
          un <strong>entretien d'embauche</strong> cet après-midi&nbsp;! Je vais donc pouvoir
          m'y mettre cet après-midi et vous faire un retour à chaud sur la façon dont
          j'ai vécu l'expérience.
        </TestimonialCard>
      </TestimonialStaticSection>
    </StaticAdvicePage>
  }
}


class StaticAdviceCard extends React.Component {
  render() {
    return <StaticAdviceCardBase picto={picto} name={name} {...this.props} >
      Des techniques pour renforcer <strong>votre confiance en vous</strong>
    </StaticAdviceCardBase>
  }
}


export default {Page, StaticAdviceCard, adviceId, name}
