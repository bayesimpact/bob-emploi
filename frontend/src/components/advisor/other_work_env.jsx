import React from 'react'
import PropTypes from 'prop-types'

import {lowerFirstLetter} from 'store/french'

import {AppearingList, Colors, GrowingNumber, PaddedOnMobile, StringJoiner} from 'components/theme'
import Picto from 'images/advices/picto-other-work-env.png'


class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      otherWorkEnvAdviceData: PropTypes.shape({
        workEnvironmentKeywords: PropTypes.shape({
          sectors: PropTypes.arrayOf(PropTypes.string.isRequired),
          structures: PropTypes.arrayOf(PropTypes.string.isRequired),
        }),
      }),
    }).isRequired,
    fontSize: PropTypes.number.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {
      advice: {
        otherWorkEnvAdviceData: {
          workEnvironmentKeywords: {sectors = [], structures = []} = {},
        } = {},
      },
      fontSize,
      userYou,
    } = this.props
    if (structures.length > 1) {
      // We remove "entreprise" because it feels strange to propose to people to work in entreprise.
      const okStructures = structures.filter(
        structure => structure.toLocaleLowerCase() !== 'entreprise')
      return <div style={{fontSize: fontSize}}>
        {userYou('As-tu', 'Avez-vous')} déjà postulé en <StringJoiner lastSeparator=" ou en ">
          {okStructures.slice(0, 2).map((name, index) => <strong key={`structure-${index}`}>
            {lowerFirstLetter(name)}
          </strong>)}
        </StringJoiner>&nbsp;?
      </div>
    }
    if (sectors.length > 1) {
      return <div style={{fontSize: fontSize}}>
        {userYou('As-tu', 'Avez-vous')} déjà postulé dans le secteur <StringJoiner>
          {sectors.slice(0, 3).map((name, index) => <strong key={`sector-${index}`}>
            {lowerFirstLetter(name)}
          </strong>)}
        </StringJoiner>&nbsp;?
      </div>
    }
    return <div style={{fontSize: fontSize}}>
      {userYou('As-tu', 'Avez-vous')} déjà pensé à postuler dans un secteur différent&nbsp;? ou dans
      un type de structure différent&nbsp;?
    </div>
  }
}


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      otherWorkEnvAdviceData: PropTypes.shape({
        workEnvironmentKeywords: PropTypes.shape({
          domains: PropTypes.arrayOf(PropTypes.shape({
            name: PropTypes.string,
          }).isRequired),
          sectors: PropTypes.arrayOf(PropTypes.string.isRequired),
          structures: PropTypes.arrayOf(PropTypes.string.isRequired),
        }),
      }),
    }).isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {
      advice: {
        otherWorkEnvAdviceData: {
          workEnvironmentKeywords: {domains = [], sectors = [], structures = []} = {},
        } = {},
      },
      project,
      userYou,
    } = this.props
    const areSectorsShown = sectors.length > 1
    const areStructuresShown = structures.length > 1
    const style = {
      position: 'relative',
    }
    return <div>
      <div style={style}>
        {(domains.length > 1) ?
          <Section kind="secteurs" items={domains.map(({name}) => name)}
            {...{project, userYou}} /> :
          <Section kind="secteurs" items={sectors} {...{project, userYou}} />}
        {(areSectorsShown && areStructuresShown) ? <div style={{height: 20, width: 35}} /> : null}
        <Section kind="types de structure" items={structures} {...{project, userYou}} />
      </div>
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
    window.open(url, '_blank')
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
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {items, kind, project, userYou, ...extraProps} = this.props
    if (!items || items.length < 2) {
      return null
    }
    return <div {...extraProps}>
      <PaddedOnMobile style={{marginBottom: 5}}>
        <div style={{color: Colors.DARK_TWO, fontSize: 30, lineHeight: '60px'}}>
          <strong>
            <GrowingNumber number={items.length} /> {kind}
          </strong> qui recrutent dans {userYou('ton', 'votre')} métier
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


export default {AdviceCard, ExpandedAdviceCardContent, Picto}
