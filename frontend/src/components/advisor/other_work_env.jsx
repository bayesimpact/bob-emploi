import React from 'react'
import PropTypes from 'prop-types'

import {AppearingList, Colors, GrowingNumber, PaddedOnMobile} from 'components/theme'

import {PersonalizationBoxes} from './base'


function getSectorsAndStructures({otherWorkEnvAdviceData}) {
  if (!otherWorkEnvAdviceData) {
    return {}
  }
  return otherWorkEnvAdviceData.workEnvironmentKeywords || {}
}


class FullAdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
  }

  render() {
    const {sectors, structures} = getSectorsAndStructures(this.props.advice)
    const areSectorsShown = (sectors || []).length > 1
    const areStructuresShown = (structures || []).length > 1
    const sectionStyle = {
      alignItems: 'center',
      textAlign: 'center',
    }
    const explanationStyle = {
      flex: 1,
      fontSize: 16,
      lineHeight: '40px',
      marginTop: 15,
    }
    const strongStyle = {
      color: Colors.GREENISH_TEAL,
      fontSize: 40,
      fontWeight: 'bold',
    }
    return <section style={sectionStyle}>
      <div style={explanationStyle}>
        {areStructuresShown ? <span>
          <GrowingNumber style={strongStyle} number={structures.length} /> types de structure
        </span> : null}
        {(areStructuresShown && areSectorsShown) ? ' et ' : null}
        {areSectorsShown ? <span>
          <GrowingNumber style={strongStyle} number={sectors.length} /> secteurs
        </span> : null}
      </div>
      proposent <strong>des emplois</strong> pour votre métier
    </section>
  }
}


const personalizations = [
  {
    filters: ['NO_OFFERS'],
    tip: "En élargissant votre recherche vous trouverez plus d'offres",
  },
  {
    filters: ['YOUNG_AGE'],
    tip: profile => `Vous n'êtes pas encore
      spécialisé${profile.gender === 'FEMININE' ? 'e' : ''} alors profitez-en et explorez`,
  },
  {
    filters: ['OLD_AGE'],
    tip: `Mettez en avant que vous pourrez transférer votre expérience et
      partager les méthodes que vous avez apprises dans un autre secteur`,
  },
]


class AdvicePageContent extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
  }

  render() {
    const {sectors, structures} = getSectorsAndStructures(this.props.advice)
    const {project} = this.props
    const areSectorsShown = (sectors || []).length > 1
    const areStructuresShown = (structures || []).length > 1
    const style = {
      position: 'relative',
    }
    return <div>
      <div style={style}>
        <Section kind="secteurs" items={sectors} project={project} />
        {(areSectorsShown && areStructuresShown) ? <div style={{height: 20, width: 35}} /> : null}
        <Section kind="types de structure" items={structures}  project={project} />
      </div>

      <PersonalizationBoxes
          {...this.props} style={{marginTop: 30}}
          personalizations={personalizations} />
    </div>
  }
}


class SearchableElement extends React.Component {
  static propTypes = {
    project: PropTypes.object.isRequired,
    style: PropTypes.object.isRequired,
    title: PropTypes.string.isRequired,
  }

  handleClick = () => {
    const {project, title} = this.props
    const url = `https://www.google.fr/search?q=${encodeURIComponent(title + ' ' + project.title)}`
    window.open(url,'_blank')
  }

  render() {
    const {title, style} = this.props
    const fullStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      fontWeight: 'bold',
      height: 50,
      padding: '0 20px',
      ...style,
    }

    return <div style={fullStyle} onClick={this.handleClick}>
      {title}
    </div>
  }
}

class Section extends React.Component {
  static propTypes = {
    items: PropTypes.arrayOf(PropTypes.node.isRequired),
    kind: PropTypes.oneOf(['secteurs', 'types de structure']).isRequired,
    project: PropTypes.object.isRequired,
  }

  render() {
    const {items, kind, project, ...extraProps} = this.props
    if (!items || items.length < 2) {
      return null
    }
    return <div {...extraProps}>
      <PaddedOnMobile style={{marginBottom: 5}}>
        <div style={{color: Colors.DARK_TWO, fontSize: 30, lineHeight: '60px'}}>
          <strong>
            <GrowingNumber number={items.length} /> {kind}
          </strong> qui recrutent dans votre métier
        </div>
      </PaddedOnMobile>
      <AppearingList>
        {items.map((title, index) => <SearchableElement
            title={title} project={project} key={`job-board-${index}`}
            style={index > 0 ? {marginTop: -1} : {}} />)}
      </AppearingList>
    </div>
  }
}


export default {AdvicePageContent, FullAdviceCard}
