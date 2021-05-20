import React from 'react'

import {prepareT} from 'store/i18n'

import picto from 'images/advices/picto-resume.png'

import {TestimonialCard} from 'components/testimonials'

import {AdviceDetail, AdvicePageProps, AdviceSection, CardProps, StaticAdviceCardBase,
  StaticAdvicePage} from './base'


const adviceId = 'cv-percutant'


// i18next-extract-mark-ns-next-line staticAdviceTitle
const name = prepareT('CV plus percutant')


const TESTIMONIALS = [
  <TestimonialCard
    author={{age: 55, jobName: 'Assistante administrative', name: 'Sylvie'}}
    isLong={true}
    key="testimonial-1">
    Merci pour ces précieux conseils qui feront que les donneurs de leçon, qui ne sont là que
    pour dicter aux autres la façon de se comporter qui ne leur correspond qu'à eux, ont
    beaucoup à apprendre&nbsp;!<br />Je mets à exécution votre plan d'action dès que je me
    sens prête et je fonce&nbsp;!
  </TestimonialCard>,
  <TestimonialCard
    author={{age: 29, jobName: 'Agente de voyages', name: 'Katia'}}
    isLong={true}
    key="testimonial-2">
    Bonjour, Je viens de m'inscrire sur votre site ce matin. Grâce à vos précieux conseils je
    viens déjà d'obtenir une réponse positive pour un <strong>entretien</strong>.<br />
    Merci beaucoup Bob&nbsp;!
  </TestimonialCard>,
  <TestimonialCard
    author={{age: 50, jobName: 'Coiffeuse', name: 'Nathalie'}}
    isLong={true}
    key="testimonial-3">
    Je découvre cette application et suis agréablement surprise par la quantité et la qualité
    des informations proposées. J'avais l'impression d'avoir en main tous les
    <strong>outils</strong> adéquats et d'avoir exploré toutes les pistes mais j'en découvre
    là de nouvelles.
  </TestimonialCard>,
]


const Page: React.FC<AdvicePageProps> = (props: AdvicePageProps): React.ReactElement =>
  <StaticAdvicePage
    adviceId={adviceId} {...props}
    testimonials={TESTIMONIALS}
    title={`Rendez votre CV plus percutant avec ${config.productName}`}>
    <AdviceSection
      adviceId={adviceId} title="réussir son CV">
      <AdviceDetail>
        Identifier les <strong>qualités</strong> importantes à mettre
        dans votre <strong>CV</strong>.
      </AdviceDetail>
      <AdviceDetail>
        Trouver les meilleurs outils gratuits pour générer
        des <strong>exemples de CV</strong>.
      </AdviceDetail>
      <AdviceDetail>
        Trouver des astuces pour repérer les bons <strong>mots-clés</strong> et
        <strong> adapter vos CV</strong> en fonction <strong>des offres d'emploi</strong>.
      </AdviceDetail>
    </AdviceSection>
  </StaticAdvicePage>


const StaticAdviceCard: React.FC<CardProps> = (props: CardProps): React.ReactElement =>
  <StaticAdviceCardBase picto={picto} name={prepareT('CV percutant')} {...props} >
    Les qualités indispensables à mettre dans votre <strong>CV</strong> selon
    votre <strong>métier</strong>
  </StaticAdviceCardBase>


export default {
  Page: React.memo(Page),
  StaticAdviceCard: React.memo(StaticAdviceCard),
  adviceId,
  name,
}
