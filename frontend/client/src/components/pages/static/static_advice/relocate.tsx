import React from 'react'

import {TestimonialCard} from 'components/testimonials'
import picto from 'images/advices/picto-relocate.svg'

import {AdviceDetail, AdvicePageProps, AdviceSection, CardProps, StaticAdviceCardBase,
  StaticAdvicePage} from './base'


const adviceId = 'relocalisation'


const name = 'Meilleures opportunités'


class Page extends React.PureComponent<AdvicePageProps> {
  public render(): React.ReactNode {
    return <StaticAdvicePage
      adviceId={adviceId} {...this.props}
      testimonials={[
        <TestimonialCard
          author={{age: 28, isMan: true, jobName: 'Data scientist', name: 'Jean-Christophe'}}
          isLong={true}
          key="testimonial-1">
          Je cherchais à <strong>changer d'entreprise</strong> et je l'ai fait en partie grâce
          aux conseils de Bob.<br />
          J'ai vraiment trouvé l'idée de <strong>Bob emploi géniale</strong>. (…) J'ai même envisagé
          de <strong>postuler</strong> en candidat libre chez vous. <br />
          J'ai finalement trouvé un super poste avant d'avoir eu l'occasion de le faire.
        </TestimonialCard>,
        <TestimonialCard
          author={{age: 21, jobName: 'Secrétaire médicale', name: 'Élodie'}}
          isLong={true}
          key="testimonial-2">
          Les conseils personnalisés et les recommandations de sites vraiment utiles dans
          ma <strong>recherche d'emploi</strong>. Ça me motive et j'ai l'impression que je ne suis
          pas toute seule dans cette démarche qui est assez lourde pour moi. Merci&nbsp;!
        </TestimonialCard>,
        <TestimonialCard
          author={{age: 48, jobName: 'Animatrice nature et environnement', name: 'Simone'}}
          isLong={true}
          key="testimonial-3">
          Ho whaooooo...<br />
          je viens de trouver 6 <strong>sites spécialisés pour mon métier</strong>&nbsp;! Je vais
          donner un coup d'œil aux différents sites et imprimer tout ce que je trouverai d'utile
          pour défendre mon cas et faire repartir le dossier 😊<br />
          Merci vraiment beaucoup pour cette plateforme si intéressante que j'ai hâte
          de voir se développer.
        </TestimonialCard>,
      ]}
      title={`Identifiez les meilleures opportunités avec ${config.productName}`}>
      <AdviceSection
        adviceId={adviceId} title="trouver les meilleures opportunités">
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
}


class StaticAdviceCard extends React.PureComponent<CardProps> {
  public render(): React.ReactNode {
    return <StaticAdviceCardBase picto={picto} name="CV percutant" {...this.props} >
      Les <strong>villes</strong> avec le plus d'opportunités pour vous
    </StaticAdviceCardBase>
  }
}


export default {Page, StaticAdviceCard, adviceId, name}
