import React, {useMemo} from 'react'

import {prepareT} from 'store/i18n'

import Trans from 'components/i18n_trans'
import {TestimonialCard} from 'components/testimonials'
import picto from 'images/advices/picto-association-help.svg'

import {AdviceDetail, AdvicePageProps, AdviceSection, CardProps, StaticAdviceCardBase,
  StaticAdvicePage} from './base'


const adviceId = 'soutien-association'


// i18next-extract-mark-ns-next-line staticAdviceTitle
const name = prepareT('Plus de soutien')


type TestimonialCardProps = React.ComponentProps<typeof TestimonialCard>


const Page: React.FC<AdvicePageProps> = (props: AdvicePageProps): React.ReactElement => {
  const {t} = props
  const testimonials = useMemo((): readonly React.ReactElement<TestimonialCardProps>[] => [
    <TestimonialCard
      // TODO(pascal): Translate the jobName below.
      author={{age: 40, jobName: t('Assistante qualité'), name: 'Camille'}}
      isLong={true}
      key="testimonial-1">
      {/* TODO(pascal): Switch to a config to translate all TestimonialCard when
       https://github.com/gilbsgilbs/babel-plugin-i18next-extract/issues/33 is implemented. */}
      <Trans t={t} parent={null}>
        Bonjour, les messages que vous m'envoyez déjà représentent un <strong>soutien </strong>
        pour moi, qui me booste à <strong>élargir mes recherches</strong>, je sens que je suis
        sur la bonne voie…
      </Trans>
    </TestimonialCard>,
    <TestimonialCard
      author={{age: 23, isMan: true, jobName: t("Ingénieur d'études en industrie"), name: 'Abdel'}}
      isLong={true}
      key="testimonial-2">
      <Trans t={t} parent={null}>
        La plateforme <strong>{{productName: config.productName}}</strong> donne
        des <strong>conseils</strong> pertinents auxquels je n'aurais pas forcément pensé, comme se
        mettre dans une association pour chercher avec d'autres personnes.
      </Trans>
    </TestimonialCard>,
    <TestimonialCard
      author={{age: 32, isMan: true, jobName: t('Développeur informatique'), name: 'Marc-Antoine'}}
      isLong={true}
      key="testimonial-3">
      <Trans t={t} parent={null}>
        C'est amusant, je suis exactement dans cette démarche depuis 2 jours tout juste. Merci
        pour le mail, les conseils et témoignages qu'il contient. Merci pour le mail
        "clé en main" et les suggestions d'utilisation. Trop bien.<br />
        Je me sens regonflé d'envie et de <strong>motivation</strong>.<br />
        Merci {{productName: config.productName}}, Je suis fan de vous.
      </Trans>
    </TestimonialCard>,
  ], [t])
  return <StaticAdvicePage
    adviceId={adviceId} {...props}
    testimonials={testimonials}
    title={t(
      'Restez bien entouré·e pendant votre recherche avec {{productName}}',
      {productName: config.productName})}>
    <AdviceSection
      adviceId={adviceId} title={t("bien s'entourer pendant sa recherche")}>
      <AdviceDetail>
        <Trans parent={null} t={t}>
          Le <strong>soutien</strong> de l'équipe de {{productName: config.productName}}&nbsp;! On
          trouve un bon conseil pour vous, un membre de l'équipe vous l'envoie par mail.
        </Trans>
      </AdviceDetail>
      <AdviceDetail>
        <Trans parent={null} t={t}>
          Une séléction d'<strong>associations</strong> près de chez vous pour vous accompagner
          dans votre recherche.
        </Trans>
      </AdviceDetail>
      <AdviceDetail>
        <Trans parent={null} t={t}>
          Des conseils pour trouver et rejoindre une association en tant que bénévole.
        </Trans>
      </AdviceDetail>
    </AdviceSection>
  </StaticAdvicePage>
}


const StaticAdviceCard: React.FC<CardProps> = (props: CardProps): React.ReactElement =>
  <StaticAdviceCardBase picto={picto} name={name} {...props} >
    <Trans parent={null} t={props.t}>
      Des solutions pour être <strong>bien entouré·e</strong> dans votre recherche
    </Trans>
  </StaticAdviceCardBase>


export default {
  Page: React.memo(Page),
  StaticAdviceCard: React.memo(StaticAdviceCard),
  adviceId,
  name,
}
