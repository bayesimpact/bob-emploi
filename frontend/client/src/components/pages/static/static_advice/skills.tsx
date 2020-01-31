import React from 'react'

import {prepareT} from 'store/i18n'

import {TestimonialCard} from 'components/testimonials'
import picto from 'images/advices/picto-skill-for-future.svg'

import {AdviceDetail, AdvicePageProps, AdviceSection, CardProps, StaticAdviceCardBase,
  StaticAdvicePage} from './base'


const adviceId = 'competences'


// i18next-extract-mark-ns-next-line staticAdviceTitle
const name = prepareT('Compétences clés')


const TESTIMONIALS = [
  <TestimonialCard
    author={{age: 22, isMan: true, jobName: 'Agent de voyage', name: 'Ludovic'}}
    isLong={true}
    key="testimonial-1">
    Grâce à Bob&nbsp;! Voir qu'il n'y a jamais d'impasse&nbsp;!
  </TestimonialCard>,
  <TestimonialCard
    author={{age: 46, isMan: true, jobName: 'Commercial', name: 'Charles'}}
    isLong={true}
    key="testimonial-2">
    Je suis un nouvel utilisateur de votre outil <strong>Bob Emploi</strong> et je le trouve
    très utile, très pertinent. Tout simplifier et résumer en une
    <strong>statistique</strong> est en effet une idée brillante.
  </TestimonialCard>,
  <TestimonialCard
    author={{age: 38, jobName: 'Chargée de communication', name: 'Émilie'}}
    isLong={true}
    key="testimonial-3">
    Le principe est très sympa. Et même quand on est autonome comme je le suis dans
    ma <strong>recherche d'emploi</strong>, cela apporte une vision extérieure
    très importante.
  </TestimonialCard>,
]


const Page: React.FC<AdvicePageProps> = (props: AdvicePageProps): React.ReactElement =>
  <StaticAdvicePage
    adviceId={adviceId} {...props}
    testimonials={TESTIMONIALS}
    title={
      `Identifiez les compétences clés pour booster votre carrière avec ${config.productName}`
    }>
    <AdviceSection
      adviceId={adviceId} title="anticiper l'avenir de votre métier">
      <AdviceDetail>
        Un <strong>diagnostic</strong> pour analyser des <strong>perspectives d'avenir </strong>
        offertes par votre métier.
      </AdviceDetail>
      <AdviceDetail>
        Une liste des <strong>compétences</strong> qui peuvent faire la différence dans votre
        domaine.
      </AdviceDetail>
      <AdviceDetail>
        Des idées de <strong>formations</strong> à suivre pour vous épanouir et booster
        votre <strong>carrière</strong>.
      </AdviceDetail>
    </AdviceSection>
  </StaticAdvicePage>


const StaticAdviceCard: React.FC<CardProps> = (props: CardProps): React.ReactElement =>
  <StaticAdviceCardBase picto={picto} name={name} {...props} >
    Les <strong>compétences clés</strong> pour booster votre carrière
  </StaticAdviceCardBase>


export default {
  Page: React.memo(Page),
  StaticAdviceCard: React.memo(StaticAdviceCard),
  adviceId,
  name,
}
