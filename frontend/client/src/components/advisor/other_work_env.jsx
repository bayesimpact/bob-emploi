import React from 'react'
import PropTypes from 'prop-types'

import {AppearingList, GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-other-work-env.png'

import {connectExpandedCardWithContent} from './base'


class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    adviceData: PropTypes.shape({
      workEnvironmentKeywords: PropTypes.shape({
        domains: PropTypes.arrayOf(PropTypes.shape({
          name: PropTypes.string,
        }).isRequired),
        sectors: PropTypes.arrayOf(PropTypes.string.isRequired),
        structures: PropTypes.arrayOf(PropTypes.string.isRequired),
      }),
    }).isRequired,
    onExplore: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {
      adviceData: {workEnvironmentKeywords: {domains = [], sectors = [], structures = []} = {}},
      onExplore,
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
            {...{project, userYou}} onExplore={() => onExplore('domain')} /> :
          <Section
            kind="secteurs" items={sectors} {...{project, userYou}}
            onExplore={() => onExplore('sector')} />}
        {(areSectorsShown && areStructuresShown) ? <div style={{height: 20, width: 35}} /> : null}
        <Section
          kind="types de structure" items={structures} {...{project, userYou}}
          onExplore={() => onExplore('structure')} />
      </div>
    </div>
  }
}
const ExpandedAdviceCardContent = connectExpandedCardWithContent()(ExpandedAdviceCardContentBase)


class SearchableElement extends React.Component {
  static propTypes = {
    onClick: PropTypes.func,
    project: PropTypes.object.isRequired,
    style: PropTypes.object.isRequired,
    title: PropTypes.string.isRequired,
  }

  handleClick = () => {
    const {onClick, project, title} = this.props
    const url = `https://www.google.fr/search?q=${encodeURIComponent(title + ' ' + project.title)}`
    window.open(url, '_blank')
    onClick && onClick()
  }

  render() {
    const {title, style} = this.props
    const fullStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
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
    onExplore: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {items, kind, onExplore, project, userYou, ...extraProps} = this.props
    if (!items || items.length < 2) {
      return null
    }
    return <div {...extraProps}>
      <div style={{marginBottom: 10}}>
        <strong>
          <GrowingNumber number={items.length} /> {kind}
        </strong> qui recrutent dans {userYou('ton', 'votre')} métier
      </div>
      <AppearingList>
        {items.map((title, index) => <SearchableElement
          title={title} project={project} key={`job-board-${index}`}
          onClick={onExplore} style={index > 0 ? {marginTop: -1} : {}} />)}
      </AppearingList>
    </div>
  }
}


export default {ExpandedAdviceCardContent, Picto}
