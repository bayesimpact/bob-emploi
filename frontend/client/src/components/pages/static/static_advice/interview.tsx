import React, {useMemo} from 'react'

import {prepareT} from 'store/i18n'

import Trans from 'components/i18n_trans'
import type {AdvicePageProps, CardProps} from 'components/static'
import {TestimonialCard} from 'components/testimonials'
import picto from 'images/advices/picto-improve-interview.svg'

import {AdviceDetail, AdviceSection, StaticAdviceCardBase, StaticAdvicePage} from './base'


const adviceId = 'entretien'


// i18next-extract-mark-ns-next-line staticAdviceTitle
const name = prepareT("Entretien d'embauche")


type TestimonialCardProps = React.ComponentProps<typeof TestimonialCard>


const Page: React.FC<AdvicePageProps> = (props: AdvicePageProps): React.ReactElement => {
  const {t} = props
  const testimonials = useMemo((): readonly React.ReactElement<TestimonialCardProps>[] => [
    <TestimonialCard
      author={{age: 55, isMan: true, jobName: t('Dessinateur de la construction'), name: 'Marc'}}
      isLong={true}
      key="testimonial-1">
      <Trans t={t} parent={null}>
        Plein de <strong>bons conseils</strong> pour l'entretien que je vais mettre en
        œuvre. Merci de ces conseils.
      </Trans>
    </TestimonialCard>,
    <TestimonialCard
      author={{age: 21, jobName: t('Secrétaire médicale'), name: 'Élodie'}}
      isLong={true}
      key="testimonial-2">
      <Trans t={t} parent={null}>
        Les conseils personnalisés et les recommandations de sites vraiment utiles dans
        ma <strong>recherche d'emploi</strong>. Ça me motive et j'ai l'impression que je ne suis
        pas toute seule dans cette démarche qui est assez lourde pour moi. Merci&nbsp;!
      </Trans>
    </TestimonialCard>,
    <TestimonialCard
      author={{age: 26, jobName: t('Assistante ressources humaines'), name: 'Rose'}}
      isLong={true}
      key="testimonial-3">
      <Trans t={t} parent={null}>
        Je souhaiterais vous remercier pour tout ce que vous faites, j'ai découvert votre
        site hier et je me demande pourquoi on ne m'en as pas parlé avant&nbsp;!!! (…) je veux
        vous remercier parce que <strong>votre site est incroyable&nbsp;!!!</strong>
      </Trans>
    </TestimonialCard>,
  ], [t])
  return <StaticAdvicePage
    adviceId={adviceId} {...props}
    testimonials={testimonials}
    title={t(
      "Préparez vos entretiens d'embauche avec {{productName}}",
      {productName: config.productName})}>
    <AdviceSection
      adviceId={adviceId} title={t("réussir vos entretiens d'embauche")}>
      <AdviceDetail><Trans parent={null} t={t}>
        La liste des qualités à mettre en avant <strong>selon votre métier</strong> pour vous
        aider à réussir vos entretiens.
      </Trans></AdviceDetail>
      <AdviceDetail><Trans parent={null} t={t}>
        Une sélection de réponses à préparer et de bonnes questions à poser
        au <strong>recruteur</strong> à la fin de vos entretiens.
      </Trans></AdviceDetail>
      <AdviceDetail><Trans parent={null} t={t}>
        Des exemples de <strong>mails de remerciement</strong> à envoyer après l'entretien.
      </Trans></AdviceDetail>
    </AdviceSection>
  </StaticAdvicePage>
}

const StaticAdviceCard: React.FC<CardProps> = (props: CardProps): React.ReactElement =>
  <StaticAdviceCardBase picto={picto} name={name} {...props}>
    <Trans parent={null} t={props.t}>
      Les bonnes questions à préparer avant un <strong>entretien d'embauche</strong>
    </Trans>
  </StaticAdviceCardBase>


export default {
  Page: React.memo(Page),
  StaticAdviceCard: React.memo(StaticAdviceCard),
  adviceId,
  isTranslated: true,
  name,
}
