import React from 'react'
import PropTypes from 'prop-types'
import VisibilitySensor from 'react-visibility-sensor'

import config from 'config'

import budgetImage from 'images/budget.png'
import demographyImage from 'images/demography.png'
import downloadImage from 'images/download-picto.svg'
import loveMessageImage from 'images/love-message-picto.svg'
import loveHeartIcon from 'images/love-heart-picto.svg'
import userPositiveFeedbacksImage from 'images/positive-feedbacks.png'
import userFeedbackPositiveImage from 'images/user-feedback-positive.png'
import userFeedbackNegativeImage from 'images/user-feedback-negative.png'
import npsImage from 'images/nps.png'

import {StaticPage} from 'components/static'
import {Colors, SmoothTransitions, Styles} from 'components/theme'

const textSectionStyle = {
  backgroundColor: '#fff',
  color: Colors.DARK_TWO,
  display: 'flex',
  flexDirection: 'column',
  fontSize: 16,
  lineHeight: 1.63,
  paddingBottom: 100,
}
const titleStyle = {
  fontSize: 36,
  fontWeight: 'bold',
  padding: '45px 0 40px',
  textAlign: 'center',
}
const sectionTitleStyle = {
  fontSize: 20,
  fontWeight: 'bold',
  marginBottom: 15,
  marginTop: 40,
}
const milestone = {
  border: 'solid 1px',
  borderColor: Colors.SILVER,
  borderRadius: 4,
  flex: 1,
  margin: 5,
  padding: '30px 0',
  textAlign: 'center',
}
const graphStyle = {
  padding: '10px 20px',
}
const excerptStyle = {
  fontStyle: 'italic',
  textAlign: 'center',
}
const milestoneExcerptStyle = {
  ...excerptStyle,
  margin: '30px 20px 0px',
}
const milestoneSubtitle = {
  fontSize: 13,
  fontWeight: 'normal',
  marginTop: 3,
}
const milestoneSurtitle = {
  color: Colors.COOL_GREY,
  fontSize: 10,
  lineHeight: 1,
  textTransform: 'uppercase',
}
const bulletStyle = {
  marginBottom: 20,
}
const subtitleStyle = {
  fontStyle: 'italic',
  fontWeight: 'bold',
  margin: '0 0 10px',
}
const imageStats = {
  height: 'auto',
  width: '100%',
}


class TransparencyPage extends React.Component {
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  getTextStyle() {
    const {isMobileVersion} = this.context
    return {
      color: Colors.CHACORAL_GREY,
      lineHeight: 1.63,
      marginBottom: 10,
      padding: isMobileVersion ? '0 50px' : '0 140px',
    }
  }

  makeLink(content, href) {
    const linkStyle = {
      color: Colors.SKY_BLUE,
      textDecoration: 'none',
    }
    return <a style={linkStyle} href={href} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  }

  renderPageDescription() {
    const {isMobileVersion} = this.context
    const overTitleStyle = {
      fontStyle: 'italic',
      margin: isMobileVersion ? 50 : '50px 140px 0 140px',
      textAlign: 'center',
    }
    return <div style={{...textSectionStyle, paddingBottom: 0}}>
      <div style={overTitleStyle}>
        Nous sommes attachés à inscrire nos travaux dans une démarche
        transparente et collaborative.<br />
        Cette page répertorie ainsi publiquement les informations liées au développement de Bob.
      </div>
      <div style={titleStyle}><strong>Impact et métriques</strong></div>
      <div style={this.getTextStyle()}>
        En France, seulement une reprise d'emploi sur 10 se fait via une offre d'emploi en
        ligne. Plus que du simple matching, l'enjeu est surtout humain : accompagner chacun
        dans ses choix stratégiques.
        <div style={{fontWeight: 'bold', marginTop: 25}}>
          Notre objectif à travers Bob&nbsp;:
        </div>
        Permettre à chaque individu de prendre le contrôle sur sa stratégie de recherche
        d'emploi, en lui fournissant des pistes de réflexion personnalisées et fondées sur
        les données.
      </div>
    </div>
  }

  renderGeneralMetrics() {
    const {isMobileVersion} = this.context
    const silverBorder = `solid 1px ${Colors.SILVER}`
    const flexRowOnDesktop = {
      display: 'flex',
      flexDirection: isMobileVersion ? 'column': 'row',
    }
    const userCountGraphStyle = {
      alignItems: 'center',
      border: silverBorder,
      borderRadius: 4,
      color: Colors.DARK_TWO,
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
    const npsBoxStyle = {
      border: silverBorder,
      borderRadius: 4,
      display: 'flex',
      fontSize: 14,
      lineHeight: 1,
      textAlign: 'center',
      ...flexRowOnDesktop,
    }
    const npsSumsBoxStyle = {
      borderLeft: isMobileVersion ? 'initial' : silverBorder,
      borderTop: isMobileVersion ? silverBorder : 'initial',
      display: 'flex',
      flexDirection: isMobileVersion ? 'row-reverse' : 'column',
      width: isMobileVersion ? 'initial' : 186,
    }
    const npsSumBoxStyle = {
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      justifyContent: 'center',
      padding: 10,
    }
    const npsSumFirstBoxStyle = {
      ...npsSumBoxStyle,
      borderBottom: isMobileVersion ? 'initial' : silverBorder,
      borderLeft: isMobileVersion ? silverBorder : 'initial',
    }
    const npsSumStyle = {
      ...Styles.CENTER_FONT_VERTICALLY,
      color: Colors.SKY_BLUE,
      display: 'block',
      fontSize: 50,
    }
    const percentBarChartStyle = {
      height: 250,
      marginRight: 10,
      overflow: 'hidden',
      width: isMobileVersion ? '100%' : 500,
    }
    return <div style={textSectionStyle}>
      <div style={this.getTextStyle()}>
        <div style={sectionTitleStyle}>Métriques générales (au 1<sup>er</sup> octobre 2017)</div>
      </div>
      <div style={{...graphStyle, ...flexRowOnDesktop}}>
        <div style={userCountGraphStyle}>
          <strong style={{color: Colors.SKY_BLUE, fontSize: 60}}>
            {(123255).toLocaleString('fr')}
          </strong>
          <span>
            comptes créés depuis novembre 2016
          </span>
        </div>
        <div style={npsBoxStyle}>
          <div>
            <div style={{fontSize: 13, fontWeight: 500, margin: 12, textAlign: 'left'}}>
              Que pensez-vous des conseils de Bob&nbsp;?
            </div>
            <PercentBarChart values={[
              {name: 'Mauvais', value: .06},
              {name: 'Peu intéressants', value: .08},
              {color: Colors.GREENISH_TEAL, name: 'Intéressants', value: .39},
              {color: Colors.GREENISH_TEAL, name: 'Utiles', value: .29},
              {color: Colors.GREENISH_TEAL, name: 'Très utiles', value: .18},
            ]} style={percentBarChartStyle} />
          </div>
          <div style={npsSumsBoxStyle}>
            <div style={npsSumFirstBoxStyle}>
              <strong>Bob m'a aidé*</strong>
              <strong style={{...npsSumStyle, color: Colors.GREENISH_TEAL}}>
                86%
              </strong>
              <span style={{fontSize: 11}}>
                * les conseils étaient intéressants, utiles ou très utiles
              </span>
            </div>
            <div style={npsSumBoxStyle}>
              <strong>Bob ne m'a pas aidé*</strong>
              <strong style={{...npsSumStyle, color: Colors.RED_PINK}}>
                14%
              </strong>
              <span style={{fontSize: 11}}>
                * les conseils étaient mauvais ou peu intéressants
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  }

  renderLove(sectionStyle) {
    const {isMobileVersion} = this.context
    const containerStyle = {
      // TODO(pascal): Custom color, either fix it or add it to the list of
      // theme's Colors.
      background: '#f8fcff',
      overflow: 'hidden',
      position: 'relative',
    }
    const backgroundImageStyle = {
      bottom: 180,
      position: 'absolute',
      right: 0,
    }
    const loveStyle = {
      fontFamily: 'Droid Serif',
      fontSize: 21,
      fontStyle: 'italic',
      lineHeight: 1.9,
      marginTop: 50,
      position: 'relative',
    }
    const bigQuoteStyle = {
      // TODO(pascal): Custom color, either fix it or add it to the list of
      // theme's Colors.
      color: '#e6f5ff',
      fontSize: 200,
      marginRight: 5,
      position: 'absolute',
      right: '100%',
      top: '-.6em',
    }
    const loveMarkerStyle = {
      marginRight: 25,
      position: 'absolute',
      right: '100%',
      top: 0,
    }
    return <div style={{...textSectionStyle, ...containerStyle}}>
      {isMobileVersion ? null : <img src={loveMessageImage} alt="" style={backgroundImageStyle} />}
      <div style={{...sectionStyle, ...this.getTextStyle()}}>
        <div style={titleStyle}><strong>Notre message préféré</strong></div>
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

  renderRoadmap() {
    const {isMobileVersion} = this.context
    const flexRowOnDesktop = {
      display: 'flex',
      flexDirection: isMobileVersion ? 'column': 'row',
    }
    const milestonesZone = {
      ...graphStyle,
      ...flexRowOnDesktop,
      justifyContent: 'space-between',
      marginTop: 10,
      width: '100%',
    }
    return <div style={textSectionStyle}>
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
        <div style={milestone}>
          <div style={milestoneSurtitle}>Étape précédente</div>
          <strong>Expérience utilisateur</strong>
          <div style={{...milestoneSubtitle, color: Colors.GREENISH_TEAL}}>
            Terminé le 19 juillet 2017
          </div>
          <div style={milestoneExcerptStyle}>
            "La proposition de valeur de Bob est claire,
            et l'expérience est cohérente même avec un éventail de
            recommandations plus restreint"
          </div>
        </div>
        <div style={{...milestone, borderColor: Colors.BUTTERSCOTCH}}>
          <div style={milestoneSurtitle}>Étape en cours</div>
          <strong>Diversité des recommandations</strong>
          <div style={{...milestoneSubtitle}}>&nbsp;</div>
          <div style={milestoneExcerptStyle}>
            "Bob est capable de recommander suffisamment de types de conseil pour être
            pertinent dans un large éventail de cas."
          </div>
        </div>
        <div style={milestone}>
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
        <a href="https://en.wikipedia.org/wiki/Net_Promoter" target="_blank"
          rel="noopener noreferrer">
          <img src={npsImage} style={imageStats} alt="évaluation par les utilisateurs" />
        </a>
      </div>
    </div>
  }

  renderUserFeedback() {
    return  <div style={textSectionStyle}>
      <div style={this.getTextStyle()}>
        <div style={sectionTitleStyle}>
          Retours utilisateurs
        </div>
        Nous travaillons à l'amélioration continue de l'impact de Bob au contact des
        utilisateurs. Leurs retours, synthétisés ici, sont donc importants pour guider nos travaux.
      </div>
      <a href={userPositiveFeedbacksImage} target="_blank" rel="noopener noreferrer">
        <div style={graphStyle}>
          <img src={userFeedbackPositiveImage} style={imageStats} alt="retours positifs" />
        </div>
      </a>
      <div style={graphStyle}>
        <img src={userFeedbackNegativeImage} style={imageStats} alt="retours négatifs" />
      </div>
      <div style={this.getTextStyle()}>
        <div style={sectionTitleStyle}>
          Axes de travail principaux
        </div>
        <ul>
          <li style={bulletStyle}>
            <span style={subtitleStyle}>Produit :</span> rendre Bob plus pertinent pour plus
            de types de situations. Si la plate-forme apporte les conseils appropriés pour une
            partie croissante de nos utilisateurs, ce qui se traduit en un nombre de bénéficiaires
            élevé en valeur absolue, il existe encore de nombreux profils pour lesquels
            ce n'est pas encore le cas. La tâche est rendue plus complexe par la faible
            segmentation de notre base utilisateurs de Bob due à notre volonté de développer
            un outil généraliste.
          </li>
          <li style={bulletStyle}>
            <span style={subtitleStyle}>Distribution</span> : notre stratégie de distribution
            reste embryonnaire (presse et bouche-à-oreille). Nous nous concentrons aujourd'hui
            principalement sur l'amélioration de Bob avant de consacrer plus de ressources à
            sa distribution dans le but d'augmenter le nombre de nos bénéficiaires.
            Cependant définir cette stratégie est un enjeu majeur, car elle conditionnera
            in fine notre impact global. Nos budgets ne nous permettant pas de faire de
            grandes campagnes marketing, l'un de notre focus sera d'accroître
            nos liens partenariaux avec les associations et organismes travaillant dans le
            champ de l'emploi.
          </li>
          <li style={bulletStyle}>
            <span style={subtitleStyle}>Écosystème</span> : catalyser l'innovation au sein du
            service public de l'emploi représente une très forte source d'impact au-delà de
            Bob lui-même.
            Nous encourageons notamment la reproduction de certaines fonctionnalités de Bob
            par d'autres acteurs.
          </li>
        </ul>
      </div>
    </div>
  }

  renderDemography() {
    return <div style={textSectionStyle}>
      <div style={titleStyle}><strong>Démographie des utilisateurs</strong></div>
      <div style={this.getTextStyle()}>
        La raison d'être de notre démarche associative est d'apporter de l'aide aux publics
        qui en ont le plus besoin, et pas seulement les publics plus faciles ou plus
        rentables.
        Nous suivons donc divers indicateurs liés à la diversité de la démographie des
        utilisateurs de Bob afin d'identifier nos axes de progression.
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
            <strong>Se concentrer sur les publics en milieu rural</strong> : l'usage de Bob reste
            concentré dans les villes, mais nous pensons que l'autonomisation via le numérique
            est d'autant plus pertinente dans les zones moins desservies en services publics.
          </li>
          <li style={bulletStyle}>
            <strong>Rendre Bob plus accessible au regard de la fracture numérique</strong> :
            nous ne sommes pas encore capables de mesurer plus finement l'utilisation de Bob
            par rapport aux différentes dimensions de la fracture numérique (aisance avec
            l'informatique, connectivité à internet, etc.). Nous envisageons notamment de
            nous rapprocher d'acteurs associatifs tels que les missions locales ou
            associations.
          </li>
        </ul>
      </div>
    </div>
  }

  renderFinances() {
    const {isMobileVersion} = this.context
    const downloadButtonStyle = {
      backgroundColor: Colors.SKY_BLUE,
      borderRadius: 4,
      boxShadow: '0 2px 3px 0 rgba(0, 0, 0, 0.2)',
      color: '#fff',
      margin: '100px auto 200px auto',
      padding: '15px 20px',
      textAlign: 'center',
      textDecoration: 'none',
      width: isMobileVersion ? 300 : 430,
    }
    return <div style={textSectionStyle}>
      <div style={titleStyle}><strong>Financement de Bob Emploi</strong></div>
      <div style={this.getTextStyle()}>
        <div>
          Bayes Impact est une association de loi 1901 à but non lucratif. En raison de
          notre volonté  d'inscrire notre initiative dans une démarche citoyenne de service
          public, Bob Emploi ne dispose d'aucun business model et fonctionne de manière
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
        travaux d'amélioration continue de Bob et démultiplier notre impact
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
        <a
          style={{color: '#fff', padding: 20, textDecoration: 'none'}}
          href="https://www.bob-emploi.fr/assets/rapport-moral-2016.pdf"
          target="_blank" rel="noopener noreferrer">
          Télécharger le rapport moral annuel de 2016&nbsp;&nbsp;
          <img src={downloadImage} alt="download" />
        </a>
      </div>
    </div>
  }

  renderLinks() {
    return <div style={textSectionStyle}>
      <div style={titleStyle}><strong>En savoir plus</strong></div>
      <div style={this.getTextStyle()}>
        <ul>
          <li>
            Pourquoi nous faisons ça {this.makeLink(
              '(vidéo, 10 minutes)', 'https://www.youtube.com/watch?v=mMBCNR9uIpE')}
          </li>
          <li>
            Notre démarche et vision pour Bob {this.makeLink(
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

  render() {
    // TODO(pascal): Fix the maxWidth layout.
    const sectionStyle = {
      marginLeft: 'auto',
      marginRight: 'auto',
      maxWidth: 1000,
    }
    return <StaticPage page="transparency" style={{backgroundColor: '#fff'}}>
      <div style={sectionStyle}>
        {this.renderPageDescription()}
        {this.renderGeneralMetrics()}
      </div>
      {this.renderLove(sectionStyle)}
      <div style={sectionStyle}>
        {this.renderRoadmap()}
        {this.renderUserFeedback()}
        {this.renderDemography()}
        {this.renderFinances()}
        {this.renderLinks()}
      </div>
    </StaticPage>
  }
}


class FundingTable extends React.Component {
  static propTypes = {
    items: PropTypes.arrayOf(PropTypes.shape({
      amount: PropTypes.number.isRequired,
      distributionYears: PropTypes.number,
      name: PropTypes.string.isRequired,
    }).isRequired).isRequired,
    style: PropTypes.object,
  }

  render() {
    const {items, style, ...extraProps} = this.props
    const containerStyle = {
      borderSpacing: 0,
      fontSize: 13,
      fontWeight: 500,
      width: '100%',
      ...style,
    }
    const rowStyle = index => ({
      backgroundColor: index % 2 ? 'transparent' : 'rgba(88, 187, 251, .1)',
    })
    const nameColumnStyle = {
      paddingLeft: 30,
      textAlign: 'left',
    }
    const numberColumnStyle = {
      paddingRight: 30,
      textAlign: 'right',
    }
    const distributionYearsStyle = {
      ...numberColumnStyle,
      fontStyle: 'italic',
      fontWeight: 'normal',
    }
    const totalRowStyle = {
      backgroundColor: Colors.SKY_BLUE,
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
        {items.map(({name, amount, distributionYears}, index) => <tr
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
            {items.reduce((total, {amount}) => amount + total, 0).toLocaleString('fr')} €
          </strong></td>
          <td />
        </tr>
      </tbody>
    </table>
  }
}


class PercentBarChart extends React.Component {
  static propTypes = {
    style: PropTypes.object,
    values: PropTypes.arrayOf(PropTypes.shape({
      color: PropTypes.string,
      name: PropTypes.string.isRequired,
      value: PropTypes.number.isRequired,
    }).isRequired).isRequired,
  }

  state = {
    hasAppeared: false,
  }

  renderBars() {
    const {hasAppeared} = this.state
    const {values} = this.props
    const containerStyle = {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      position: 'relative',
      width: 50,
    }
    const barStyle = (color, value) => ({
      backgroundColor: color || Colors.RED_PINK,
      height: (hasAppeared ? value * 100 : 0) + '%',
      ...SmoothTransitions,
    })
    const legendStyle = {
      fontSize: 11,
      left: 0,
      margin: '10px -100%',
      position: 'absolute',
      right: 0,
      textAlign: 'center',
      top: '100%',
      whiteSpace: 'nowrap',
    }
    return values.map(({color, name, value}) => <div
      key={`bar-${name}`} style={containerStyle}>
      <strong style={{fontSize: 16, marginBottom: 5}}>{Math.round(value * 100)}%</strong>
      <div style={barStyle(color, value)} />
      <div style={legendStyle}>
        {name}
      </div>
    </div>)
  }

  renderHorizontalScales() {
    const scaleStyle = index => ({
      alignItems: 'center',
      display: 'flex',
      height: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: (index * 25) + '%',
    })
    const numberStyle = {
      fontSize: 8,
      paddingRight: 4,
      paddingTop: 4,
      textAlign: 'right',
      width: '3.2em',
    }
    return new Array(5).fill().map(
      (unused, index) => <div style={scaleStyle(index)} key={`scale-${index}`}>
        <span style={numberStyle}>{(4 - index) * 25}%</span>
        <div style={{
          backgroundColor: index < 4 ? Colors.SILVER : Colors.COOL_GREY,
          flex: 1,
          height: 1,
        }} />
      </div>)
  }

  render() {
    const barContainerStyle = {
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
        onChange={hasAppeared => this.setState({hasAppeared})}>
        <div style={barContainerStyle}>
          {this.renderBars()}
        </div>
      </VisibilitySensor>
    </div>
  }
}


export {TransparencyPage}
