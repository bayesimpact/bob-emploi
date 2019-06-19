import React from 'react'
import PropTypes from 'prop-types'
import VisibilitySensor from 'react-visibility-sensor'

import budgetImage from 'images/budget.png'
import demographyImage from 'images/demography.png'
import downloadImage from 'images/download-picto.svg'
import loveMessageImage from 'images/love-message-picto.svg'
import loveHeartIcon from 'images/love-heart-picto.svg'
import userPositiveFeedbacksImage from 'images/positive-feedbacks.png'
import userFeedbackPositiveImage from 'images/user-feedback-positive.png'
import userFeedbackNegativeImage from 'images/user-feedback-negative.png'
import npsImage from 'images/nps.png'

import {isMobileVersion} from 'components/mobile'
import {StaticPage} from 'components/static'
import {ExternalLink, MAX_CONTENT_WIDTH, SmoothTransitions, colorToAlpha} from 'components/theme'

const textSectionStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  display: 'flex',
  flexDirection: 'column',
  fontSize: 16,
  lineHeight: 1.63,
  paddingBottom: 50,
}
const titleStyle: React.CSSProperties = {
  fontSize: 36,
  fontWeight: 'bold',
  lineHeight: 1,
  maxWidth: MAX_CONTENT_WIDTH,
  padding: '50px 0 40px',
  textAlign: 'center',
}
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 'bold',
  marginBottom: 15,
  marginTop: 40,
}
const graphStyle: React.CSSProperties = {
  marginLeft: 'auto',
  marginRight: 'auto',
  maxWidth: MAX_CONTENT_WIDTH,
  padding: '10px 20px',
}
const excerptStyle: React.CSSProperties = {
  fontStyle: 'italic',
  textAlign: 'center',
}
const milestoneExcerptStyle: React.CSSProperties = {
  ...excerptStyle,
  margin: '30px 20px 0px',
}
const milestoneSubtitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 'normal',
  marginTop: 3,
}
const milestoneSurtitle: React.CSSProperties = {
  color: colors.COOL_GREY,
  fontSize: 10,
  lineHeight: 1,
  textTransform: 'uppercase',
}
const bulletStyle: React.CSSProperties = {
  marginBottom: 20,
}
const subtitleStyle: React.CSSProperties = {
  fontStyle: 'italic',
  fontWeight: 'bold',
  margin: '0 0 10px',
}
const imageStats: React.CSSProperties = {
  height: 'auto',
  width: '100%',
}


const userStats = {
  // To get these numbers, update the dates and run the script
  // analytics/manual/stats_for_feedback_scores.js
  feedbackScores: [
    {name: 'Mauvais', value: .07},
    {name: 'Peu intéressant', value: .07},
    {color: colors.GREENISH_TEAL, name: 'Intéressant', value: .28},
    {color: colors.GREENISH_TEAL, name: 'Utile', value: .25},
    {color: colors.GREENISH_TEAL, name: 'Très utile', value: .33},
  ],
  // Recomupted just below.
  positiveFeedbackPercentage: 0,
  // To get this number, update the dates and run the script analytics/manual/count_new_users.js
  totalUserCount: 165679,
  updatedAt: <span>au 1<sup>er</sup> janvier 2019</span>,
}
userStats.positiveFeedbackPercentage =
  Math.round(userStats.feedbackScores.slice(2).
    reduce((sum, {value}): number => sum + value, 0) * 100)


export default class TransparencyPage extends React.PureComponent<{}> {
  private getTextStyle(): React.CSSProperties {
    return {
      color: colors.CHARCOAL_GREY,
      lineHeight: 1.63,
      marginBottom: 10,
      padding: isMobileVersion ? '0 20px' : '0 140px',
    }
  }

  private makeLink(content: React.ReactNode, href: string): React.ReactNode {
    const linkStyle: React.CSSProperties = {
      color: colors.BOB_BLUE,
      textDecoration: 'none',
    }
    return <ExternalLink style={linkStyle} href={href}>{content}</ExternalLink>
  }

  private renderPageDescription(): React.ReactNode {
    const overTitleStyle: React.CSSProperties = {
      fontStyle: 'italic',
      margin: isMobileVersion ? 50 : '50px 140px 0 140px',
      textAlign: 'center',
    }
    return <div style={{...textSectionStyle, paddingBottom: 0}}>
      <div style={overTitleStyle}>
        Nous sommes attachés à inscrire nos travaux dans une démarche
        transparente et collaborative.<br />
        Cette page répertorie ainsi publiquement les informations liées au développement
        de {config.productName}.
      </div>
      <div style={titleStyle}><strong>Impact et métriques</strong></div>
      <div style={this.getTextStyle()}>
        En France, seulement une reprise d'emploi sur 10 se fait via une offre d'emploi en
        ligne. Plus que du simple matching, l'enjeu est surtout humain : accompagner chacun
        dans ses choix stratégiques.
        <div style={{fontWeight: 'bold', marginTop: 25}}>
          Notre objectif à travers {config.productName}&nbsp;:
        </div>
        Permettre à chaque individu de prendre le contrôle sur sa stratégie de recherche
        d'emploi, en lui fournissant des pistes de réflexion personnalisées et fondées sur
        les données.
      </div>
    </div>
  }

  private renderGeneralMetrics(): React.ReactNode {
    const silverBorder = `solid 1px ${colors.SILVER}`
    const flexRowOnDesktop: React.CSSProperties = {
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
    }
    const userCountGraphStyle: React.CSSProperties = {
      alignItems: 'center',
      border: silverBorder,
      borderRadius: 4,
      display: 'flex',
      flexDirection: 'column',
      fontSize: 14,
      justifyContent: 'center',
      lineHeight: 1,
      marginBottom: isMobileVersion ? 20 : 'initial',
      marginRight: isMobileVersion ? 'initial' : 20,
      padding: '30px 0',
      width: isMobileVersion ? 'initial' : 312,
    }
    const helpfulRateStyle: React.CSSProperties = {
      color: colors.GREENISH_TEAL,
      fontSize: 60,
      fontWeight: 'bold',
      lineHeight: 1,
    }
    const npsBoxStyle: React.CSSProperties = {
      border: silverBorder,
      borderRadius: 4,
      display: 'flex',
      fontSize: 14,
      lineHeight: 1,
      textAlign: 'center',
      ...flexRowOnDesktop,
    }
    const npsStarStyle: React.CSSProperties = {
      color: colors.COOL_GREY,
      fontSize: 13,
      fontStyle: 'oblique',
      lineHeight: 1.31,
      marginBottom: -27,
      marginLeft: '50%',
    }
    const npsSumsBoxStyle: React.CSSProperties = {
      borderLeft: isMobileVersion ? 'initial' : silverBorder,
      borderTop: isMobileVersion ? silverBorder : 'initial',
      display: 'flex',
      flexDirection: isMobileVersion ? 'row-reverse' : 'column',
      width: isMobileVersion ? 'initial' : 186,
    }
    const npsSumBoxStyle: React.CSSProperties = {
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      justifyContent: 'center',
      padding: 10,
    }
    const npsSumFirstBoxStyle: React.CSSProperties = {
      ...npsSumBoxStyle,
      borderBottom: isMobileVersion ? 'initial' : silverBorder,
      borderLeft: isMobileVersion ? silverBorder : 'initial',
    }
    const npsSumStyle: React.CSSProperties = {
      color: colors.BOB_BLUE,
      display: 'block',
      fontSize: 50,
    }
    const percentBarChartStyle: React.CSSProperties = {
      height: 250,
      marginRight: isMobileVersion ? 0 : 10,
      overflow: 'hidden',
      width: isMobileVersion ? '100%' : 500,
    }
    return <div style={textSectionStyle}>
      <div style={this.getTextStyle()}>
        <div style={sectionTitleStyle}>Métriques générales ({userStats.updatedAt})</div>
      </div>
      <div style={{marginBottom: 10, textAlign: 'center'}}>
        <div style={{fontWeight: 'bold', marginBottom: 20}}>Impact sur le retour à l'emploi</div>
        <div style={helpfulRateStyle}>42%</div>
        <div style={this.getTextStyle()}>
          des personnes nous ayant indiqué avoir <strong>retrouvé un emploi</strong><br />
          et ayant testé {config.productName}, considèrent que <strong>{config.productName} y
          a contribué</strong>.
        </div>
      </div>
      <div style={{...graphStyle, ...flexRowOnDesktop}}>
        <div style={userCountGraphStyle}>
          <strong style={{color: colors.BOB_BLUE, fontSize: 60}}>
            {(userStats.totalUserCount).toLocaleString('fr')}
          </strong>
          <span>
            comptes créés depuis novembre 2016
          </span>
        </div>
        <div style={npsBoxStyle}>
          <div>
            <div style={{fontSize: 13, fontWeight: 500, margin: 12, textAlign: 'left'}}>
              Que pensez-vous de {config.productName}&nbsp;?
            </div>
            <PercentBarChart values={userStats.feedbackScores} style={percentBarChartStyle} />
          </div>
          <div style={npsSumsBoxStyle}>
            <div style={npsSumFirstBoxStyle}>
              <strong>{config.productName} m'a aidé*</strong>
              <strong style={{...npsSumStyle, color: colors.GREENISH_TEAL}}>
                {userStats.positiveFeedbackPercentage}%
              </strong>
              <span style={{fontSize: 11}}>
                * intéressant, pertinent ou très pertinent
              </span>
            </div>
            <div style={npsSumBoxStyle}>
              <strong>{config.productName} ne m'a pas aidé*</strong>
              <strong style={{...npsSumStyle, color: colors.RED_PINK}}>
                {100 - userStats.positiveFeedbackPercentage}%
              </strong>
              <span style={{fontSize: 11}}>
                * vraiment inutile ou peu intéressant
              </span>
            </div>
          </div>
        </div>
      </div>
      <div style={npsStarStyle}>* Via le formulaire de feedback au sein de l'application</div>
    </div>
  }

  private renderLove(sectionStyle: React.CSSProperties): React.ReactNode {
    const containerStyle: React.CSSProperties = {
      backgroundColor: colorToAlpha(colors.BOB_BLUE, .1),
      overflow: 'hidden',
      position: 'relative',
    }
    const backgroundImageStyle: React.CSSProperties = {
      bottom: 180,
      position: 'absolute',
      right: 0,
    }
    const loveStyle: React.CSSProperties = {
      fontFamily: 'Droid Serif',
      fontSize: 21,
      fontStyle: 'italic',
      lineHeight: 1.9,
      marginTop: 50,
      position: 'relative',
    }
    const bigQuoteStyle: React.CSSProperties = {
      color: colorToAlpha(colors.BOB_BLUE, .2),
      fontSize: 200,
      marginRight: 5,
      position: 'absolute',
      right: '100%',
      top: '-.6em',
    }
    const loveMarkerStyle: React.CSSProperties = {
      marginRight: 25,
      position: 'absolute',
      right: '100%',
      top: 0,
    }
    return <div style={{...textSectionStyle, ...containerStyle, paddingBottom: 54}}>
      {isMobileVersion ? null : <img src={loveMessageImage} alt="" style={backgroundImageStyle} />}
      <div style={{...sectionStyle, ...this.getTextStyle()}}>
        <div style={{fontSize: 20, marginBottom: 20, marginTop: 50}}>
          <strong>Notre message préféré</strong>
        </div>
        <div>
          Nous recevons régulièrement des retours d'utilisateurs qui nous
          touchent. C'est ce qui nous motive pour avancer
          {' '}<span role="img" aria-label="content">😊</span>.<br /><br />

          Celui-ci en particulier nous est allé droit au cœur, car il
          représente l'impact fondamentalement humain pour lequel nous nous
          battons : <em>empowerer</em> chaque individu en utilisant la
          technologie pour montrer qu'il y a toujours des solutions et de l'espoir.
        </div>
        <div style={loveStyle}>
          <div style={bigQuoteStyle}>“</div>
          <div>
            Bonjour,<br />
            Je vous dirais tout simplement Ouahouh !<br />
            Ça fait grand plaisir de recevoir un soutien comme le vôtre.<br />
            Alors, un Grand merci à vous de me rebooster …<br /><br />

            Je vais, par cette échange, suivre votre conseil et j'aimerais rester
            en contact avec vous car tout le monde avant vous me disait ; “vous
            savez, je n'ai pas de baguette magique”.<br />
            Vous, vous avez une baguette magique ; le mérite de me redonner foi
            en ma recherche d'emploi et des billes <span role="img"
              style={{fontStyle: 'normal'}} aria-label="sourire">😬</span><br />
            Le message est bien passé et dans une bonne oreille !<br />
            Vous me redonner confiance, là où d'autres ont échoué, et vous suis
            très reconnaissante.<br />
            Ma situation change, je pense me retourner vers un autre domaine de
            travail car physiquement, j'ai des problèmes de dos qui me décourage
            parfois à me retrouver un travail.<br /><br />

            En tout cas, je fais le nécessaire pour me réadapter dans un autre domaine.
            J'espère avoir prochainement de vos nouvelles et conseils,<br />
            Un grand merci à vous !<br />
            Cordialement et Sincèrement,<br /><br />

            <div style={{position: 'relative'}}>
              <div style={loveMarkerStyle}><img src={loveHeartIcon} alt="" /></div>
              PS : “Parfois notre lumière s'éteint, puis elle est rallumée par un
              autre être humain. Chacun de nous doit de sincères remerciements à ceux
              qui ont ravivé leur flamme.”
            </div>
          </div>
        </div>
      </div>
    </div>
  }

  private renderRoadmap(): React.ReactNode {
    const flexRowOnDesktop: React.CSSProperties = {
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
    }
    const milestonesZone: React.CSSProperties = {
      ...graphStyle,
      ...flexRowOnDesktop,
      justifyContent: 'space-between',
      marginTop: 10,
      width: '100%',
    }
    const milestone: React.CSSProperties = {
      border: 'solid 1px',
      borderColor: colors.SILVER,
      borderRadius: 4,
      flex: 1,
      margin: isMobileVersion ? '0px 0px 20px' : '0px 10px',
      padding: '30px 0',
      textAlign: 'center',
    }
    return <div style={textSectionStyle}>
      <div style={this.getTextStyle()}>
        <div style={titleStyle}><strong>Avancement du projet</strong></div>
        {config.productName} est un projet de long-terme. Nous apprenons en
        marchant, car nous pensons que c'est ainsi que nous pourrons créer une
        plate-forme toujours plus utile. Notre développement se fait de façon
        ouverte : retrouvez ci-dessous les étapes d'avancement du projet.
      </div>
      <div style={this.getTextStyle()}>
        <div style={sectionTitleStyle}>Travaux en cours</div>
        {config.productName} est en développement actif. Le code est open source et&nbsp;
        {this.makeLink('disponible sur Github', 'https://github.com/bayesimpact/bob-emploi')}.
        Vous pouvez également consulter l'{this.makeLink(
          'historique général du projet',
          'https://github.com/bayesimpact/bob-emploi/blob/master/HISTORY.md')} ainsi
        que {this.makeLink(
          'le changelog complet',
          'https://github.com/bayesimpact/bob-emploi/blob/master/CHANGELOG.md')}.
      </div>
      <div style={milestonesZone}>
        <div style={{...milestone, marginLeft: 0}}>
          <div style={milestoneSurtitle}>Étape précédente</div>
          <strong>Expérience utilisateur</strong>
          <div style={{...milestoneSubtitle, color: colors.GREENISH_TEAL}}>
            Terminé le 19 juillet 2017
          </div>
          <div style={milestoneExcerptStyle}>
            "La proposition de valeur de {config.productName} est claire,
            et l'expérience est cohérente même avec un éventail de
            recommandations plus restreint"
          </div>
        </div>
        <div style={{...milestone, borderColor: colors.BUTTERSCOTCH}}>
          <div style={milestoneSurtitle}>Étape en cours</div>
          <strong>Diversité des recommandations</strong>
          <div style={{...milestoneSubtitle}}>&nbsp;</div>
          <div style={milestoneExcerptStyle}>
            "{config.productName} est capable de recommander suffisamment de
            types de conseil pour être pertinent dans un large éventail de cas."
          </div>
        </div>
        <div style={{...milestone, marginRight: 0}}>
          <div style={milestoneSurtitle}>Étape suivante</div>
          <strong>Algorithmes de scoring</strong>
          <div style={milestoneSubtitle}>&nbsp;</div>
          <div style={milestoneExcerptStyle}>
            "Chaque conseil est contextualisé de façon très personnalisée en fonction du
            profil de la personne."
          </div>
        </div>
      </div>
      <div style={graphStyle}>
        <ExternalLink href="https://en.wikipedia.org/wiki/Net_Promoter">
          <img src={npsImage} style={imageStats} alt="évaluation par les utilisateurs" />
        </ExternalLink>
      </div>
      {this.renderWorkAxes()}
    </div>
  }

  private renderUserFeedback(sectionStyle: React.CSSProperties): React.ReactNode {
    return <div style={textSectionStyle}>
      <div style={{...this.getTextStyle(), ...sectionStyle}}>
        <div style={{...titleStyle, lineHeight: 1, marginBottom: 16}}>
          <strong>Retours utilisateurs</strong>
        </div>
        Nous travaillons à l'amélioration continue de l'impact de {config.productName} au
        contact des utilisateurs.
      </div>
      <ExternalLink href={userPositiveFeedbacksImage}>
        <div style={{...graphStyle, marginBottom: 10, ...sectionStyle}}>
          <img src={userFeedbackPositiveImage} style={imageStats} alt="retours positifs" />
        </div>
      </ExternalLink>
      <div style={{...graphStyle, marginBottom: 40, ...sectionStyle}}>
        <img src={userFeedbackNegativeImage} style={imageStats} alt="retours négatifs" />
      </div>
      {this.renderLove(sectionStyle)}
    </div>
  }

  private renderWorkAxes(): React.ReactNode {
    return <div style={this.getTextStyle()}>
      <div style={sectionTitleStyle}>
        Axes de travail principaux
      </div>
      <ul>
        <li style={bulletStyle}>
          <span style={subtitleStyle}>Produit :</span> rendre {config.productName} plus pertinent
          pour plus de types de situations différents. La tâche est rendue plus
          complexe par notre volonté de faire de {config.productName} un outil fonctionnant pour
          une large gamme de bénéficiaires, ce qui veut également dire que notre
          base d'utilisateurs est peu segmentée.
        </li>
        <li style={bulletStyle}>
          <span style={subtitleStyle}>Distribution</span> : notre stratégie de distribution
          reste embryonnaire (presse et bouche-à-oreille). Nous nous concentrons aujourd'hui
          principalement sur l'amélioration de {config.productName} avant de
          nous concentrer plus sur sa distribution, mais cette dernière conditionnera
          in fine notre impact global. Nos budgets ne nous permettant pas de
          faire de grandes campagnes marketing, l'un de nos focus sera
          d'accroître nos liens partenariaux avec les associations et organismes accompagnant les
          chercheurs d'emploi.
        </li>
        <li style={bulletStyle}>
          <span style={subtitleStyle}>Écosystème</span> : au-delà de {config.productName}, catalyser
          l'innovation au sein du service public de l'emploi représente une très forte source
          d'impact. Nous encourageons notamment la reproduction de certaines fonctionnalités
          de {config.productName} par d'autres acteurs.
        </li>
      </ul>
    </div>
  }

  private renderDemography(): React.ReactNode {
    return <div style={textSectionStyle}>
      <div style={titleStyle}><strong>Démographie des utilisateurs</strong></div>
      <div style={this.getTextStyle()}>
        La raison d'être de notre démarche associative est d'apporter de l'aide aux publics
        qui en ont le plus besoin, et pas seulement les publics plus faciles ou plus
        rentables.
        Nous suivons donc divers indicateurs liés à la diversité de la démographie des
        utilisateurs de {config.productName} afin d'identifier nos axes de progression.
      </div>
      <div style={graphStyle}>
        <img src={demographyImage} style={imageStats} alt="statistiques demographiques" />
      </div>
      <div style={this.getTextStyle()}>
        <div style={sectionTitleStyle}>
          Axes de progression
        </div>
        <ul>
          <li style={bulletStyle}>
            <strong>Se concentrer sur les publics en milieu rural</strong> :
            l'usage de {config.productName} reste concentré dans les villes, mais nous
            pensons que l'autonomisation via le numérique
            est d'autant plus pertinente dans les zones moins desservies en services publics.
          </li>
          <li style={bulletStyle}>
            <strong>Rendre {config.productName} plus accessible au regard de la
            fracture numérique</strong> : nous ne sommes pas encore capables de
            mesurer plus finement l'utilisation de {config.productName} par rapport
            aux différentes dimensions de la fracture numérique (aisance avec
            l'informatique, connectivité à internet, etc.). Nous envisageons notamment de
            nous rapprocher d'acteurs associatifs tels que les missions locales ou
            associations.
          </li>
        </ul>
      </div>
    </div>
  }

  private renderFinances(): React.ReactNode {
    const downloadButtonStyle: React.CSSProperties = {
      backgroundColor: colors.BOB_BLUE,
      borderRadius: 4,
      boxShadow: '0 2px 3px 0 rgba(0, 0, 0, 0.2)',
      color: '#fff',
      margin: isMobileVersion ? '30px auto' : '100px auto 200px',
      padding: '15px 20px',
      textAlign: 'center',
      textDecoration: 'none',
      width: isMobileVersion ? 280 : 430,
    }
    return <div style={textSectionStyle}>
      <div style={titleStyle}><strong>Financement de {config.productName}</strong></div>
      <div style={this.getTextStyle()}>
        <div>
          Bayes Impact est une association de loi 1901 à but non lucratif. En raison de
          notre volonté  d'inscrire notre initiative dans une démarche citoyenne de service
          public, {config.productName} ne dispose d'aucun business model et fonctionne de manière
          indépendante. Nous finançons ainsi notre équipe uniquement par des dons et
          subventions, répertoriés ici.
        </div>
        <div style={{marginTop: 20}}>
          Afin d'assurer l'indépendance du projet, aucune contribution philanthropique,
          qu'elle soit en financement ou en nature, ne peut être acceptée si elle fait
          l'objet d'une contrepartie.
        </div>
        <div style={sectionTitleStyle}>
          Sources de Financement
        </div>
        <div style={subtitleStyle}>
          Amorçage
        </div>
        Entre fin 2015 et 2016, des individus, fondations, ainsi que deux acteurs publics ont
        contribué ensemble 740&nbsp;000&nbsp;€ de donations et subventions afin
        de financer l'amorçage du projet et les deux premières années
        d'expérimentation.
        <FundingTable
          style={{marginBottom: 40, marginTop: 30}} items={[
            {amount: 200000, distributionYears: 2, name: 'PIA'},
            {amount: 300000, distributionYears: 2, name: 'Fondation JP Morgan Chase'},
            {amount: 10000, distributionYears: 1, name: 'Prix Publicis 90'},
            {amount: 185000, distributionYears: 1, name: 'Subvention Pôle emploi'},
            {amount: 5000, distributionYears: 1, name: 'Five by five'},
            {amount: 10000, distributionYears: 1, name: 'Iron Capital'},
            {amount: 30000, distributionYears: 2, name: 'BPI'},
          ]} />
        <div style={subtitleStyle}>
          Croissance de l'impact et pérennisation
        </div>
        En 2017, la fondation La France s'engage (label d'innovation sociale dont Bayes Impact est
        lauréat) et la fondation Google.org ainsi que la direction RSE du groupe Lafayette ont
        contribué ensemble 1&nbsp;665&nbsp;000&nbsp;€ en donations
        philanthropiques réparties sur plusieurs années afin de pérenniser les
        travaux d'amélioration continue de {config.productName} et démultiplier notre impact
        dans la durée.
        <FundingTable
          style={{marginTop: 30}} items={[
            {amount: 565000, distributionYears: 1, name: "La France s'engage"},
            {amount: 1000000, distributionYears: 3, name: 'Google.org'},
            {amount: 100000, distributionYears: 1, name: 'Galeries Lafayette'},
          ]} />
        <div style={sectionTitleStyle}>
          Utilisation du budget
        </div>
      </div>
      <div style={graphStyle}>
        <img src={budgetImage} style={imageStats} alt="budget" />
      </div>
      <div style={downloadButtonStyle}>
        <ExternalLink
          style={{color: '#fff', padding: 20, textDecoration: 'none'}}
          href="https://www.bob-emploi.fr/assets/rapport-annuel-2017.pdf">
          Télécharger le rapport annuel de 2017&nbsp;&nbsp;
          <img src={downloadImage} alt="download" />
        </ExternalLink>
      </div>
    </div>
  }

  private renderLinks(): React.ReactNode {
    return <div style={textSectionStyle}>
      <div style={titleStyle}><strong>En savoir plus</strong></div>
      <div style={this.getTextStyle()}>
        <ul>
          <li>
            Pourquoi nous faisons ça {this.makeLink(
              '(vidéo, 10 minutes)', 'https://www.youtube.com/watch?v=mMBCNR9uIpE')}
          </li>
          <li>
            Notre démarche et vision pour {config.productName} {this.makeLink(
              '(podcast, 1 heure)',
              'http://nouvelleecole.org/ep-20-paul-duan-disruption-bienveillante/')}
          </li>
          <li>
            Notre culture d'ingénierie {this.makeLink(
              '(vidéo, 30 minutes)', 'https://www.youtube.com/watch?v=n3zO78sOcCo')}
          </li>
          <li>
            Notre culture de la bienveillance {this.makeLink(
              '(vidéo, 30 minutes)', 'https://www.youtube.com/watch?v=xeAWNrgYCgA')}
          </li>
        </ul>
      </div>
    </div>
  }

  public render(): React.ReactNode {
    const sectionStyle: React.CSSProperties = {
      marginLeft: 'auto',
      marginRight: 'auto',
      maxWidth: MAX_CONTENT_WIDTH,
    }
    return <StaticPage page="transparency" style={{backgroundColor: '#fff'}}>
      <div style={sectionStyle}>
        {this.renderPageDescription()}
        {this.renderGeneralMetrics()}
      </div>
      {this.renderUserFeedback(sectionStyle)}
      <div style={sectionStyle}>
        {this.renderRoadmap()}
        {this.renderDemography()}
        {this.renderFinances()}
        {this.renderLinks()}
      </div>
    </StaticPage>
  }
}


interface FundingTableProps {
  items: {
    amount: number
    distributionYears?: number
    name: string
  }[]
  style: React.CSSProperties
}


class FundingTable extends React.PureComponent<FundingTableProps> {
  public static propTypes = {
    items: PropTypes.arrayOf(PropTypes.shape({
      amount: PropTypes.number.isRequired,
      distributionYears: PropTypes.number,
      name: PropTypes.string.isRequired,
    }).isRequired).isRequired,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {items, style, ...extraProps} = this.props
    const containerStyle = {
      borderSpacing: 0,
      fontSize: 13,
      fontWeight: 500,
      width: '100%',
      ...style,
    }
    const rowStyle = (index: number): React.CSSProperties => ({
      backgroundColor: index % 2 ? 'transparent' : colorToAlpha(colors.BOB_BLUE, .1),
    })
    const nameColumnStyle: React.CSSProperties = {
      paddingLeft: 30,
      textAlign: 'left',
    }
    const numberColumnStyle: React.CSSProperties = {
      paddingRight: 30,
      textAlign: 'right',
    }
    const distributionYearsStyle: React.CSSProperties = {
      ...numberColumnStyle,
      fontStyle: 'italic',
      fontWeight: 'normal',
    }
    const totalRowStyle: React.CSSProperties = {
      backgroundColor: colors.BOB_BLUE,
      color: '#fff',
      fontSize: 16,
    }
    return <table {...extraProps} style={containerStyle}>
      <thead>
        <tr style={rowStyle(0)}>
          <th style={{...nameColumnStyle, paddingBottom: 8, paddingTop: 8}}>Nom</th>
          <th style={numberColumnStyle}>Montant</th>
          <th style={numberColumnStyle}>Réparti sur</th>
        </tr>
      </thead>
      <tbody>
        {items.map(({name, amount, distributionYears}, index): React.ReactNode => <tr
          key={`item-${index}`} style={rowStyle(index + 1)}>
          <td style={{...nameColumnStyle, paddingBottom: 8, paddingTop: 8}}>{name}</td>
          <td style={numberColumnStyle}>{amount.toLocaleString('fr')} €</td>
          <td style={distributionYearsStyle}>
            {distributionYears ? `${distributionYears} an${distributionYears > 1 ? 's' : ''}` : ''}
          </td>
        </tr>)}
        <tr style={totalRowStyle}>
          <td style={{...nameColumnStyle, paddingBottom: 10, paddingTop: 10}}>Total</td>
          <td style={numberColumnStyle}><strong>
            {items.reduce((total, {amount}): number => amount + total, 0).toLocaleString('fr')} €
          </strong></td>
          <td />
        </tr>
      </tbody>
    </table>
  }
}


interface PercentBarChartProps {
  style?: React.CSSProperties
  values: {
    color?: string
    name: string
    value: number
  }[]
}


class PercentBarChart extends React.PureComponent<PercentBarChartProps, {hasAppeared: boolean}> {
  public static propTypes = {
    style: PropTypes.object,
    values: PropTypes.arrayOf(PropTypes.shape({
      color: PropTypes.string,
      name: PropTypes.string.isRequired,
      value: PropTypes.number.isRequired,
    }).isRequired).isRequired,
  }

  public state = {
    hasAppeared: false,
  }

  private handleVisibilityChange = (hasAppeared: boolean): void => this.setState({hasAppeared})

  private renderBars(): React.ReactNode {
    const {hasAppeared} = this.state
    const {values} = this.props
    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      position: 'relative',
      width: 50,
    }
    const barStyle = (color: string, value: number): React.CSSProperties => ({
      backgroundColor: color || colors.RED_PINK,
      height: (hasAppeared ? value * 100 : 0) + '%',
      ...SmoothTransitions,
    })
    const legendStyle: React.CSSProperties = {
      fontSize: 11,
      left: 0,
      margin: '10px -100%',
      position: 'absolute',
      right: 0,
      textAlign: 'center',
      top: '100%',
      whiteSpace: 'nowrap',
    }
    return values.map(({color, name, value}): React.ReactNode => <div
      key={`bar-${name}`} style={containerStyle}>
      <strong style={{fontSize: 16, marginBottom: 5}}>{Math.round(value * 100)}%</strong>
      <div style={barStyle(color, value)} />
      <div style={legendStyle}>
        {name}
      </div>
    </div>)
  }

  private renderHorizontalScales(): React.ReactNode {
    const scaleStyle = (index: number): React.CSSProperties => ({
      alignItems: 'center',
      display: 'flex',
      height: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: (index * 25) + '%',
    })
    const numberStyle: React.CSSProperties = {
      fontSize: 8,
      paddingRight: 4,
      paddingTop: 4,
      textAlign: 'right',
      width: '3.2em',
    }
    return new Array(5).fill(0).map(
      (unused, index): React.ReactNode => <div style={scaleStyle(index)} key={`scale-${index}`}>
        <span style={numberStyle}>{(4 - index) * 25}%</span>
        <div style={{
          backgroundColor: index < 4 ? colors.SILVER : colors.COOL_GREY,
          flex: 1,
          height: 1,
        }} />
      </div>)
  }

  public render(): React.ReactNode {
    const barContainerStyle: React.CSSProperties = {
      display: 'flex',
      flex: 1,
      justifyContent: 'space-around',
      marginBottom: 30,
      marginLeft: 21,
      marginTop: 5,
      position: 'relative',
    }
    return <div style={{display: 'flex', position: 'relative', ...this.props.style}}>
      <div style={{bottom: 30, left: 0, position: 'absolute', right: 0, top: 5}}>
        {this.renderHorizontalScales()}
      </div>
      <VisibilitySensor
        partialVisibility={true} intervalDelay={250}
        onChange={this.handleVisibilityChange}>
        <div style={barContainerStyle}>
          {this.renderBars()}
        </div>
      </VisibilitySensor>
    </div>
  }
}
