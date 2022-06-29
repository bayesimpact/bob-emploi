import React, {useMemo} from 'react'

import {prepareT} from 'store/i18n'

import Trans from 'components/i18n_trans'
import type {AdvicePageProps, CardProps} from 'components/static'
import {TestimonialCard} from 'components/testimonials'
import picto from 'images/advices/picto-relocate.svg'

import {AdviceDetail, AdviceSection, StaticAdviceCardBase, StaticAdvicePage} from './base'


const adviceId = 'relocalisation'


// i18next-extract-mark-ns-next-line staticAdviceTitle
const name = prepareT('Meilleures opportunités')


type TestimonialCardProps = React.ComponentProps<typeof TestimonialCard>


const Page: React.FC<AdvicePageProps> = (props: AdvicePageProps): React.ReactElement => {
  const {t} = props
  const testimonials = useMemo((): readonly React.ReactElement<TestimonialCardProps>[] => [
    <TestimonialCard
      author={{age: 28, isMan: true, jobName: t('Data scientist'), name: t('Jean-Christophe')}}
      isLong={true}
      key="testimonial-1">
      <Trans parent={null} t={t}>
        Je cherchais à <strong>changer d'entreprise</strong> et je l'ai fait en partie grâce
        aux conseils de {{product: config.productName}}.<br />
        J'ai vraiment trouvé l'idée de <strong>{{product: config.productName}} géniale</strong>. (…)
        J'ai même envisagé de <strong>postuler</strong> en candidat libre chez vous. <br />
        J'ai finalement trouvé un super poste avant d'avoir eu l'occasion de le faire.
      </Trans>
    </TestimonialCard>,
    <TestimonialCard
      author={{age: 21, jobName: t('Secrétaire médicale'), name: t('Élodie')}}
      isLong={true}
      key="testimonial-2">
      <Trans parent={null} t={t}>
        Les conseils personnalisés et les recommandations de sites vraiment utiles dans
        ma <strong>recherche d'emploi</strong>. Ça me motive et j'ai l'impression que je ne suis
        pas toute seule dans cette démarche qui est assez lourde pour moi. Merci&nbsp;!
      </Trans>
    </TestimonialCard>,
    <TestimonialCard
      author={{age: 48, jobName: t('Animatrice nature et environnement'), name: t('Simone')}}
      isLong={true}
      key="testimonial-3">
      <Trans parent={null} t={t}>
        Ho whaooooo...<br />
        je viens de trouver 6 <strong>sites spécialisés pour mon métier</strong>&nbsp;! Je vais
        donner un coup d'œil aux différents sites et imprimer tout ce que je trouverai d'utile
        pour défendre mon cas et faire repartir le dossier 😊<br />
        Merci vraiment beaucoup pour cette plateforme si intéressante que j'ai hâte
        de voir se développer.
      </Trans>
    </TestimonialCard>,
  ], [t])
  return <StaticAdvicePage
    adviceId={adviceId} {...props}
    testimonials={testimonials}
    title={t(
      'Identifiez les meilleures opportunités avec {{productName}}',
      {productName: config.productName})}>
    <AdviceSection
      adviceId={adviceId} title={t('trouver les meilleures opportunités')}>
      <AdviceDetail>
        La liste des villes avec le plus d'<strong>entreprises</strong> qui recherchent des
        profils proches du vôtre.
      </AdviceDetail>
      <AdviceDetail>
        La liste des villes qui offrent le plus d'opportunités dans votre région
        ou à moins de 30 min de chez vous.
      </AdviceDetail>
      <AdviceDetail>
        Des informations sur les métiers à plus fort potentiel
        de <strong>retour à l'emploi rapide</strong>.
      </AdviceDetail>
    </AdviceSection>
  </StaticAdvicePage>
}


const StaticAdviceCard: React.FC<CardProps> = (props: CardProps): React.ReactElement =>
  <StaticAdviceCardBase picto={picto} name={prepareT('CV percutant')} {...props} >
    <Trans parent={null} t={props.t}>
      Les <strong>villes</strong> avec le plus d'opportunités pour vous
    </Trans>
  </StaticAdviceCardBase>


export default {
  Page: React.memo(Page),
  StaticAdviceCard: React.memo(StaticAdviceCard),
  adviceId,
  isTranslated: true,
  name,
}
