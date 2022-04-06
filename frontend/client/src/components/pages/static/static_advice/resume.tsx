import React, {useMemo} from 'react'

import {prepareT} from 'store/i18n'

import picto from 'images/advices/picto-resume.png'

import Trans from 'components/i18n_trans'
import type {AdvicePageProps, CardProps} from 'components/static'
import {TestimonialCard} from 'components/testimonials'

import {AdviceDetail, AdviceSection, StaticAdviceCardBase, StaticAdvicePage} from './base'


const adviceId = 'cv-percutant'


// i18next-extract-mark-ns-next-line staticAdviceTitle
const name = prepareT('CV plus percutant')


type TestimonialCardProps = React.ComponentProps<typeof TestimonialCard>


const Page: React.FC<AdvicePageProps> = (props: AdvicePageProps): React.ReactElement => {
  const {t} = props
  const testimonials = useMemo((): readonly React.ReactElement<TestimonialCardProps>[] => [
    <TestimonialCard
      author={{age: 55, jobName: t('Assistante administrative'), name: 'Sylvie'}}
      isLong={true}
      key="testimonial-1">
      <Trans t={t} parent={null}>
        Merci pour ces précieux conseils qui feront que les donneurs de leçon, qui ne sont là que
        pour dicter aux autres la façon de se comporter qui ne leur correspond qu'à eux, ont
        beaucoup à apprendre&nbsp;!<br />Je mets à exécution votre plan d'action dès que je me
        sens prête et je fonce&nbsp;!
      </Trans>
    </TestimonialCard>,
    <TestimonialCard
      author={{age: 29, jobName: t('Agente de voyages'), name: 'Katia'}}
      isLong={true}
      key="testimonial-2">
      <Trans t={t} parent={null}>
        Bonjour, Je viens de m'inscrire sur votre site ce matin. Grâce à vos précieux conseils je
        viens déjà d'obtenir une réponse positive pour un <strong>entretien</strong>.<br />
        Merci beaucoup {{productName: config.productName}}&nbsp;!
      </Trans>
    </TestimonialCard>,
    <TestimonialCard
      author={{age: 50, jobName: t('Coiffeuse'), name: 'Nathalie'}}
      isLong={true}
      key="testimonial-3">
      <Trans t={t} parent={null}>
        Je découvre cette application et suis agréablement surprise par la quantité et la qualité
        des informations proposées. J'avais l'impression d'avoir en main tous les
        <strong>outils</strong> adéquats et d'avoir exploré toutes les pistes mais j'en découvre
        là de nouvelles.
      </Trans>
    </TestimonialCard>,
  ], [t])
  return <StaticAdvicePage
    adviceId={adviceId} {...props}
    testimonials={testimonials}
    title={t(
      'Rendez votre CV plus percutant avec {{productName}}',
      {productName: config.productName})}>
    <AdviceSection
      adviceId={adviceId} title={t('réussir son CV')}>
      <AdviceDetail><Trans t={t} parent={null}>
        Identifier les <strong>qualités</strong> importantes à mettre
        dans votre <strong>CV</strong>.
      </Trans></AdviceDetail>
      <AdviceDetail><Trans t={t} parent={null}>
        Trouver les meilleurs outils gratuits pour générer
        des <strong>exemples de CV</strong>.
      </Trans></AdviceDetail>
      <AdviceDetail><Trans t={t} parent={null}>
        Trouver des astuces pour repérer les bons <strong>mots-clés</strong> et
        <strong> adapter vos CV</strong> en fonction <strong>des offres d'emploi</strong>.
      </Trans></AdviceDetail>
    </AdviceSection>
  </StaticAdvicePage>
}


const StaticAdviceCard: React.FC<CardProps> = (props: CardProps): React.ReactElement =>
  <StaticAdviceCardBase picto={picto} name={prepareT('CV percutant')} {...props} >
    <Trans parent={null} t={props.t}>
      Les qualités indispensables à mettre dans votre <strong>CV</strong> selon
      votre <strong>métier</strong>
    </Trans>
  </StaticAdviceCardBase>


export default {
  Page: React.memo(Page),
  StaticAdviceCard: React.memo(StaticAdviceCard),
  adviceId,
  isTranslated: true,
  name,
}
