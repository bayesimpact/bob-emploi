import React from 'react'

import {TestimonialCard} from 'components/testimonials'
import motivationEmailPicto from 'images/advices/picto-motivation-email.svg'

import {AdviceDetail, AdvicePageProps, AdviceSection, CardProps, StaticAdviceCardBase,
  StaticAdvicePage} from './base'


const adviceId = 'lettre-motivation'


const name = 'Lettre de motivation'


const TESTIMONIALS = [
  <TestimonialCard
    author={{age: 45, jobName: 'Manutentionnaire', name: 'Sandrine'}}
    isLong={true}
    key="testimonial-1">
    Bonjour,<br />J'ai apprécié les conseils de Bob pour le
    <strong> mail de motivation</strong>.<br />Et la <strong>relance </strong>
    à faire aux recruteurs. Il est vrai que je n'osais pas le faire car j'avais peur
    de déranger.
  </TestimonialCard>,
  <TestimonialCard
    author={{age: 29, isMan: true, jobName: 'Community manager', name: 'Julien'}}
    isLong={true}
    key="testimonial-2">
    J'ai décroché un <strong>entretien</strong> conseil et un entretien courant octobre.
    Il est vrai que je pourrais m'inspirer de votre texte concernant une première
    <strong> prise de contact</strong>. Je passe
    énormément de temps à mes <strong>recherches d'emplois</strong> (cibler, adapter,
    relancer, chercher) et j'espère que cela va payer dans peu
    de temps&nbsp;!<br />Merci à vous
  </TestimonialCard>,
  <TestimonialCard
    author={{age: 27, isMan: true, jobName: "Ingénieur d'études", name: 'Gaëtan'}}
    isLong={true}
    key="testimonial-3">
    Je pensais qu'il s'agissait d'un site d'offres d'emploi. En réalité, il s'agit d'un outil
    pour aider à développer son <strong>projet professionnel</strong>. J'ai été surpris car
    les suggestions sont parfois très précises.
  </TestimonialCard>,
]


class StaticAdviceCard extends React.PureComponent<CardProps> {
  public render(): React.ReactNode {
    return <StaticAdviceCardBase
      name="Lettre de motivation" picto={motivationEmailPicto} {...this.props}>
      Des <strong>exemples de mails de motivation</strong> et de relance pour obtenir
      des <strong>réponses</strong>.
    </StaticAdviceCardBase>
  }
}


class Page extends React.PureComponent<AdvicePageProps> {
  public render(): React.ReactNode {
    return <StaticAdvicePage
      {...this.props}
      adviceId={adviceId}
      testimonials={TESTIMONIALS}
      title={`Réussir vos mails et lettres de motivation avec ${config.productName}`}>
      <AdviceSection
        adviceId={adviceId} title="réussir votre lettre de motivation">
        <AdviceDetail>
          Trouver des modèles de <strong>mails de motivation</strong>.
        </AdviceDetail>
        <AdviceDetail>
          Trouver les meilleurs outils gratuits pour générer des
          <strong> exemples de lettres de motivation</strong>.
        </AdviceDetail>
        <AdviceDetail>
          Trouver des astuces pour <strong>adapter vos mails et lettres de motivation </strong>
          en fonction de la situation.
        </AdviceDetail>
      </AdviceSection>
    </StaticAdvicePage>
  }
}


export default {Page, StaticAdviceCard, adviceId, name}
