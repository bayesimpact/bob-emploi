import React, {useMemo} from 'react'

import {prepareT} from 'store/i18n'

import picto from 'images/advices/picto-find-a-jobboard.svg'

import Trans from 'components/i18n_trans'
import type {AdvicePageProps, CardProps} from 'components/static'
import {TestimonialCard} from 'components/testimonials'

import {AdviceDetail, AdviceSection, StaticAdviceCardBase, StaticAdvicePage} from './base'


const adviceId = 'offres'


// i18next-extract-mark-ns-next-line staticAdviceTitle
const name = prepareT("Plus d'offres d'emploi")


type TestimonialCardProps = React.ComponentProps<typeof TestimonialCard>


const Page: React.FC<AdvicePageProps> = (props: AdvicePageProps): React.ReactElement => {
  const {t} = props
  const testimonials = useMemo((): readonly React.ReactElement<TestimonialCardProps>[] => [
    <TestimonialCard
      author={{age: 28, isMan: true, jobName: t('Data scientist'), name: t('Jean-Christophe')}}
      isLong={true}
      key="testimonial-1">
      <Trans t={t} parent={null}>
        Je cherchais à <strong>changer d'entreprise</strong> et je l'ai fait en partie grâce
        aux conseils de {{product: config.productName}}.<br />
        J'ai vraiment trouvé l'idée de <strong>{{product: config.productName}} géniale</strong>. (…)
        J'ai même envisagé de <strong>postuler</strong> en candidat libre chez vous. <br />
        J'ai finalement trouvé un super poste avant d'avoir eu l'occasion de le faire.
      </Trans>
    </TestimonialCard>,
    <TestimonialCard
      author={{age: 55, jobName: t('Formatrice'), name: t('Nadia')}}
      isLong={true}
      key="testimonial-2">
      <Trans t={t} parent={null}>
        Pour ma part, je trouve votre site plutôt extraordinaire, en tout cas un outil vraiment
        utile dans une recherche d'informations liées à <strong>un métier, un emploi</strong> et
        le <strong>marché</strong> qui gravite autour.
      </Trans>
    </TestimonialCard>,
    <TestimonialCard
      author={{age: 48, jobName: t('Animatrice nature environnement'), name: t('Simone')}}
      isLong={true}
      key="testimonial-3">
      <Trans t={t} parent={null}>
        Ho whaooooo...<br />
        je viens de trouver 6 <strong>sites spécialisés pour mon métier</strong>&nbsp;! Je vais
        donner un coup d'œil aux différents sites et imprimer tout ce que je trouverai d'utile
        pour défendre mon cas et faire repartir le dossier 😊<br />
        Merci vraiment beaucoup pour cette plateforme si intéressante que j'ai hate
        de voir se développer.
      </Trans>
    </TestimonialCard>,
  ], [t])
  return <StaticAdvicePage
    adviceId={adviceId} {...props}
    testimonials={testimonials}
    title={t("Trouvez des offres d'emploi, qu'elles soient publiées ou pas")}>
    <AdviceSection
      adviceId={adviceId} title={t("trouver des offres d'emploi")}>
      <AdviceDetail>
        <Trans t={t} parent={null}>
          Des conseils pour dénicher des offres et vous attaquer au <strong>marché caché</strong>.
        </Trans>
      </AdviceDetail>
      <AdviceDetail>
        <Trans t={t} parent={null}>
          Une sélection des <strong>meilleurs sites d'offres</strong> pour trouver des offres dans
          votre domaine.
        </Trans>
      </AdviceDetail>
      <AdviceDetail>
        <Trans t={t} parent={null}>
          Des conseils pour pouvoir lire entre les lignes et analyser ce
          que <strong>recherchent les recruteurs</strong>.
        </Trans>
      </AdviceDetail>
    </AdviceSection>
  </StaticAdvicePage>
}


const StaticAdviceCard: React.FC<CardProps> = (props: CardProps): React.ReactElement =>
  <StaticAdviceCardBase picto={picto} name={name} {...props} >
    <Trans t={props.t}>
      Les meilleurs sites de <strong>recherche d'emploi</strong> pour trouver
      des <strong>offres</strong>
    </Trans>
  </StaticAdviceCardBase>


export default {
  Page,
  StaticAdviceCard,
  adviceId,
  isTranslated: true,
  name,
}
