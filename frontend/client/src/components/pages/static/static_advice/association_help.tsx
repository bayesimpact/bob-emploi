import React from 'react'

import {TestimonialCard} from 'components/testimonials'
import picto from 'images/advices/picto-association-help.svg'

import {AdviceDetail, AdvicePageProps, AdviceSection, CardProps, StaticAdviceCardBase,
  StaticAdvicePage} from './base'


const adviceId = 'soutien-association'


const name = 'Plus de soutien'


class Page extends React.PureComponent<AdvicePageProps> {
  public render(): React.ReactNode {
    return <StaticAdvicePage
      adviceId={adviceId} {...this.props}
      testimonials={[
        <TestimonialCard
          author={{age: 40, jobName: 'Assistante qualité', name: 'Camille'}}
          isLong={true}
          key="testimonial-1">
          Bonjour, les messages que vous m'envoyez déjà représentent un <strong>soutien </strong>
          pour moi, qui me booste à <strong>élargir mes recherches</strong>, je sens que je suis
          sur la bonne voie…
        </TestimonialCard>,
        <TestimonialCard
          author={{age: 23, isMan: true, jobName: "Ingénieur d'études en industrie", name: 'Abdel'}}
          isLong={true}
          key="testimonial-2">
          La plateforme <strong>Bob Emploi</strong> donne des <strong>conseils</strong> pertinents
          auxquels je n'aurais pas forcément pensé, comme se mettre dans une association pour
          chercher avec d'autres personnes.
        </TestimonialCard>,
        <TestimonialCard
          author={{age: 32, isMan: true, jobName: 'Développeur informatique', name: 'Marc-Antoine'}}
          isLong={true}
          key="testimonial-3">
          C'est amusant, je suis exactement dans cette démarche depuis 2 jours tout juste. Merci
          pour le mail, les conseils et témoignages qu'il contient. Merci pour le mail
          "clé en main" et les suggestions d'utilisation. Trop bien.<br />
          Je me sens regonflé d'envie et de <strong>motivation</strong>.<br />
          Merci Bob, Je suis fan de vous.
        </TestimonialCard>,
      ]}
      title={`Restez bien entouré pendant votre recherche avec ${config.productName}`}>
      <AdviceSection
        adviceId={adviceId} title="bien s'entourer pendant sa recherche">
        <AdviceDetail>
          Le <strong>soutien</strong> de l'équipe de {config.productName}&nbsp;! On trouve un bon
          conseil pour vous, un membre de l'équipe vous l'envoie par mail.
        </AdviceDetail>
        <AdviceDetail>
          Une séléction d'<strong>associations</strong> près de chez vous pour vous accompagner
          dans votre recherche.
        </AdviceDetail>
        <AdviceDetail>
          Des conseils pour trouver et rejoindre une association en tant que bénévole.
        </AdviceDetail>
      </AdviceSection>
    </StaticAdvicePage>
  }
}


class StaticAdviceCard extends React.PureComponent<CardProps> {
  public render(): React.ReactNode {
    return <StaticAdviceCardBase picto={picto} name={name} {...this.props} >
      Des solutions pour être <strong>bien entouré</strong> dans votre recherche
    </StaticAdviceCardBase>
  }
}


export default {Page, StaticAdviceCard, adviceId, name}
