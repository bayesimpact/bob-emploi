import React from 'react'

import {Colors, GrowingNumber, Icon, PaddedOnMobile, PieChart} from 'components/theme'

import {AdviceCard, PersonalizationBoxes} from './base'


const columnStyle = {
  backgroundColor: '#fff',
  margin: 20,
  padding: 20,
  textAlign: 'center',
}
const indexColumnStyle = {
  ...columnStyle,
  fontWeight: 'bold',
  width: '10%',
}
const actionColumnStyle = {
  ...columnStyle,
  fontStyle: 'italic',
  fontWeight: 'bold',
  width: '30%',
}
const explanationColumnStyle = {
  ...columnStyle,
  height: '100%',
  padding: '20px 20px 0 20px',
  width: '30%',
}


class FullAdviceCard extends React.Component {
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  renderWhy() {
    const {isMobileVersion} = this.context
    const strongStyle = {
      color: Colors.SKY_BLUE,
      fontSize: 40,
    }
    return <div style={{alignItems: 'center', display: 'flex'}}>
      <div style={{flex: 1, lineHeight: '21px'}}>
        <strong style={strongStyle}><GrowingNumber number={66} isSteady={true} />%</strong> des
        employeurs recrutent via des <strong>candidatures spontanées</strong>.
      </div>
      {isMobileVersion ? null : <PieChart
          style={{color: Colors.SKY_BLUE, marginLeft: 50}} percentage={66}
          backgroundColor={Colors.MODAL_PROJECT_GREY}>
        <GrowingNumber number={66} />%
      </PieChart>}
    </div>
  }

  render() {
    const reasons = ['NO_OFFERS', 'ATYPIC_PROFILE', 'LESS_THAN_15_OFFERS']
    return <AdviceCard {...this.props} reasons={reasons}>
      {this.renderWhy()}
    </AdviceCard>
  }
}


class SpontaneousTipCard extends React.Component {
  static propTypes = {
    action: React.PropTypes.node,
    how: React.PropTypes.node,
    step: React.PropTypes.number.isRequired,
    style: React.PropTypes.object,
    why: React.PropTypes.node,
  }
  state = {
    isCollapsed: true,
  }

  toggleCollapse = () => this.setState({isCollapsed: !this.state.isCollapsed})

  render() {
    const {action, how, step, style, why} = this.props
    const {isCollapsed} = this.state
    const actionStyle = {
      alignItems: 'center',
      backgroundColor: Colors.SKY_BLUE,
      color: 'white',
      cursor: 'pointer',
      display: 'flex',
      fontWeight: 'bold',
      padding: '5px 5px 5px 15px',
      textAlign: 'left',
    }
    const explanationStyle = {
      backgroundColor: '#fff',
      padding: '18px 20px 18px 20px',
      textAlign: 'left',
    }
    const chevronStyle = {
      fontSize: 30,
      lineHeight: 1,
    }
    return <div style={style}>
      <header style={actionStyle} onClick={this.toggleCollapse}>
        <div style={{flex: 1, paddingLeft: 22, textIndent: -22}}>
          {step} - {action}
        </div>
        <Icon name={isCollapsed ? 'chevron-down' : 'chevron-up'} style={chevronStyle} />
      </header>
      {isCollapsed ? null : <div>
        <div style={explanationStyle}>{how}</div>
        <div style={explanationStyle}>{why}</div>
      </div>}
    </div>
  }
}


class SpontaneousTipLine extends React.Component {
  static propTypes = {
    action: React.PropTypes.node,
    how: React.PropTypes.node,
    step: React.PropTypes.number.isRequired,
    why: React.PropTypes.node,
  }

  state = {
    isCollapsed: true,
  }

  renderExpandLink() {
    const {isCollapsed} = this.state
    const btnStyle = {
      backgroundColor: '#fff',
      bottom: 7,
      color: Colors.SKY_BLUE,
      cursor: 'pointer',
      fontWeight: 'bold',
      position: 'absolute',
      right: 0,
    }
    return <a onClick={() => this.setState({isCollapsed: !isCollapsed})} style={btnStyle}>
      {isCollapsed ? <span>...voir plus</span> : <span>réduire</span>}
    </a>
  }

  render() {
    const {action, how, step, why} = this.props
    const {isCollapsed} = this.state
    const flexibleRowContainer = {
      height: '100%',
      paddingBottom: 35,
      position: 'relative',
    }
    const flexibleRow = {
      maxHeight: isCollapsed ? 40 : 1000,
      overflow: 'hidden',
    }
    return <tr>
      <td style={indexColumnStyle}>{step}</td>
      <td style={actionColumnStyle}>{action}</td>
      <td style={explanationColumnStyle}>
        <div style={flexibleRowContainer}>
          {this.renderExpandLink()}
          <div style={flexibleRow}>
            {how}
          </div>
        </div>
      </td>
      <td style={explanationColumnStyle}>
        <div style={flexibleRowContainer}>
          {this.renderExpandLink()}
          <div style={flexibleRow}>
            {why}
          </div>
        </div>
      </td>
    </tr>
  }
}


const personalizations = [
  {
    filters: ['YOUNG_AGE'],
    tip: 'Montrez votre côté débrouillard et votre dynamisme',
  },
  {
    filters: ['OLD_AGE'],
    tip: profile => {
      const isFeminine = profile.gender === 'FEMININE'
      return `Montrez que vous êtes stable, expérimenté${isFeminine ? 'e' : ''}(e) et
        opérationnel${isFeminine ? 'le' : ''}`
    },
  },
  {
    filters: ['ATYPIC_PROFILE'],
    tip: `En allant au devant des recruteurs vous pouvez faire valoir vos forces
      et même celles qui ne rentrent pas exactement dans la description de poste
      classique`,
  },
  {
    filters: ['TIME_MANAGEMENT'],
    tip: `Avec les candidatures spontanées c'est vous qui donnez le tempo et vous
      ne passez pas des heures à chercher les offres postées`,
  },
  {
    filters: ['MOTIVATION'],
    tip: `Gardez en tête que l'objectif des candidatures spontanées est d'obtenir
      un premier contact pas décrocher un boulot directement`,
  },
]


class AdvicePageContent extends React.Component {
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  state = {
    spontaneousTipLines: [
      {
        action: 'Cibler les entreprises',
        how:
          `Cherchez toutes les entreprises
          qui correspondent à vos critères et qui peuvent s'adapter à vos contraintes
          (métiers, conditions de travail, mobilité, etc …).`,
        why:
          `Mieux vous ciblez les entreprises
          que vous contactez plus vous aurez de chances de sortir du lot. En plus si vous
          trouvez des entreprises qui vous plaisent vraiment vos candidatures seront plus
          sincères et plus réussies.`,
      },
      {
        action: 'Personnaliser votre candidature',
        how:
          `Consultez le site de l'entreprise,
          ses pages sur les réseaux sociaux ou les offres postées pour reprendre des mots
          clés dans votre CV et votre lettre de motivation.`,
        why:
          `Le but est de montrer que vous avez bien compris
          l'esprit de l'entreprise et que vous avez les compétences dont l'entreprise
          a besoin.`,
      },
      {
        action: 'Trouver la bonne façon de candidater',
        how:
          `Si vous postulez dans une petite entreprise c'est toujours bien de déposer votre
          candidature en personne, demandez bien son nom à la personne que vous rencontrerez
          pour le préciser dans vos relances. Vous pouvez aussi envoyer votre candidature
          spontanée par mail, idéalement essayer de l'envoyer au responsable de service et
          pas seulement au service de recrutement.`,
        why:
          `En adaptant votre méthode pour postuler à l'entreprise vous montrez que vous avez
          pris le temps de comprendre le fonctionnement et l'esprit de l'entreprise avant
          de postuler.`,
      },
      {
        action: 'Trouver la bonne personne à contacter',
        how:
          `Cherchez des indices sur internet pour trouver la bonne personne à contacter :
          le chef du service, le directeur de la branche, le responsable du projet...
          Vous pouvez par exemple utiliser le site de l'entreprise ou Linkedin pour
          retrouver le nom de la personne et son titre.`,
        why:
          `Vous serez directement en contact avec une des personnes qui peut prendre la
          décision d'embaucher et qui est très au courant des besoins de l'équipe.`,
      },
      {
        action: 'Faites des relances',
        how:
          `Envoyez un email clair et concis deux semaines après. L'objectif est de
          vérifier que votre candidature a bien été reçue et de mieux cibler les besoins de
          l'entreprise et les potentiels recrutements à venir.`,
        why:
          `Cela permet de montrer votre motivation et de vous faire remarquer
          positivement. Beaucoup de recruteurs ne regardent les candidatures spontanées
          qu'après avoir reçu une ou deux relances.`,
      }],
  }

  render() {
    const {isMobileVersion} = this.context
    const tableStyle = {
      textAlign: 'center',
      width: '100%',
    }
    const headerStyle = {
      backgroundColor: Colors.SKY_BLUE,
      color: '#fff',
      fontStyle: 'normal',
      fontWeight: 'normal',
      margin: 10,
      padding: 5,
    }
    return <div>
      <PaddedOnMobile>
        Des étapes de candidature réussie adaptée à votre profil&nbsp;:
      </PaddedOnMobile>
      {isMobileVersion ?
        <div style={{display: 'flex', flexDirection: 'column', position: 'relative'}}>
          {this.state.spontaneousTipLines.map((line, index) => <SpontaneousTipCard
            style={{marginBottom: 15}} key={index}
            step={index + 1} action={line.action} how={line.how} why={line.why} />)}
        </div>
      : <div style={{display: 'flex', position: 'relative'}}>
        <table cellSpacing="10" style={tableStyle}>
          <thead>
            <tr>
              <td style={indexColumnStyle, headerStyle}>Étape</td>
              <td style={actionColumnStyle, headerStyle}>Action</td>
              <td style={explanationColumnStyle, headerStyle}>Comment faire&nbsp;?</td>
              <td style={explanationColumnStyle, headerStyle}>Pourquoi est-ce utile&nbsp;?</td>
            </tr>
          </thead>
          <tbody>
            {this.state.spontaneousTipLines.map((line, index) => <SpontaneousTipLine
                step={index + 1} action={line.action} how={line.how} why={line.why} key={index} />)}
          </tbody>
        </table>
      </div>}

      <PersonalizationBoxes
          {...this.props} style={{marginTop: 30}}
          personalizations={personalizations} />
    </div>
  }
}


export default {AdvicePageContent, FullAdviceCard}
