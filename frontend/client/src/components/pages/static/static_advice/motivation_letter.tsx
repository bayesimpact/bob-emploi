import React, {useMemo} from 'react'

import {prepareT} from 'store/i18n'

import Trans from 'components/i18n_trans'
import type {AdvicePageProps, CardProps} from 'components/static'
import {TestimonialCard} from 'components/testimonials'
import motivationEmailPicto from 'images/advices/picto-motivation-email.svg'

import {AdviceDetail, AdviceSection, StaticAdviceCardBase, StaticAdvicePage} from './base'


const adviceId = 'lettre-motivation'


// i18next-extract-mark-ns-next-line staticAdviceTitle
const name = prepareT('Lettre de motivation')


type TestimonialCardProps = React.ComponentProps<typeof TestimonialCard>


const StaticAdviceCard: React.FC<CardProps> = (props: CardProps): React.ReactElement =>
  <StaticAdviceCardBase
    name={name} picto={motivationEmailPicto} {...props}>
    <Trans parent={null} t={props.t}>
      Des <strong>exemples de mails de motivation</strong> et de relance pour obtenir
      des <strong>réponses</strong>.
    </Trans>
  </StaticAdviceCardBase>


const Page: React.FC<AdvicePageProps> = (props: AdvicePageProps): React.ReactElement => {
  const {t} = props
  const testimonials = useMemo((): readonly React.ReactElement<TestimonialCardProps>[] => [
    <TestimonialCard
      author={{age: 45, jobName: t('Manutentionnaire'), name: t('Sandrine')}}
      isLong={true}
      key="testimonial-1">
      <Trans t={t} parent={null}>
        Bonjour,<br />J'ai apprécié les conseils de {{productName: config.productName}} pour le
        <strong> mail de motivation</strong>.<br />Et la <strong>relance </strong>
        à faire aux recruteurs. Il est vrai que je n'osais pas le faire car j'avais peur
        de déranger.
      </Trans>
    </TestimonialCard>,
    <TestimonialCard
      author={{age: 29, isMan: true, jobName: t('Community manager'), name: t('Julien')}}
      isLong={true}
      key="testimonial-2">
      <Trans t={t} parent={null}>
        J'ai décroché un <strong>entretien</strong> conseil et un entretien courant octobre.
        Il est vrai que je pourrais m'inspirer de votre texte concernant une première
        <strong> prise de contact</strong>. Je passe
        énormément de temps à mes <strong>recherches d'emplois</strong> (cibler, adapter,
        relancer, chercher) et j'espère que cela va payer dans peu
        de temps&nbsp;!<br />Merci à vous
      </Trans>
    </TestimonialCard>,
    <TestimonialCard
      author={{age: 27, isMan: true, jobName: t("Ingénieur d'études"), name: t('Gaëtan')}}
      isLong={true}
      key="testimonial-3">
      <Trans t={t} parent={null}>
        Je pensais qu'il s'agissait d'un site d'offres d'emploi. En réalité, il s'agit d'un outil
        pour aider à développer son <strong>projet professionnel</strong>. J'ai été surpris car
        les suggestions sont parfois très précises.
      </Trans>
    </TestimonialCard>,
  ], [t])
  return <StaticAdvicePage
    {...props}
    adviceId={adviceId}
    testimonials={testimonials}
    title={t(
      'Réussir vos mails et lettres de motivation avec {{productName}}',
      {productName: config.productName})}>
    <AdviceSection adviceId={adviceId} title={t('réussir votre lettre de motivation')}>
      <AdviceDetail><Trans t={t} parent={null}>
        Trouver des modèles de <strong>mails de motivation</strong>.
      </Trans></AdviceDetail>
      <AdviceDetail><Trans t={t} parent={null}>
        Trouver les meilleurs outils gratuits pour générer des
        <strong> exemples de lettres de motivation</strong>.
      </Trans></AdviceDetail>
      <AdviceDetail><Trans t={t} parent={null}>
        Trouver des astuces pour <strong>adapter vos mails et lettres de motivation </strong>
        en fonction de la situation.
      </Trans></AdviceDetail>
    </AdviceSection>
  </StaticAdvicePage>
}


export default {
  Page: React.memo(Page),
  StaticAdviceCard: React.memo(StaticAdviceCard),
  adviceId,
  isTranslated: true,
  name,
}
