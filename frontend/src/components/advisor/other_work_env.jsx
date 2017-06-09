import React from 'react'
import PropTypes from 'prop-types'

import {lowerFirstLetter} from 'store/french'

import {AppearingList, Colors, GrowingNumber, PaddedOnMobile} from 'components/theme'


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
    if ((structures || []).length > 1) {
      return <div style={{fontSize: 30}}>
        Avez-vous déja postulé en <strong>{lowerFirstLetter(structures[0])}</strong> ou
        en <strong>{lowerFirstLetter(structures[1])}</strong>&nbsp;?
      </div>
    }
    if ((sectors || []).length > 1) {
      return <div style={{fontSize: 30}}>
        Avez-vous déja postulé dans le secteur <strong>{lowerFirstLetter(sectors[0])}</strong> ou
        {' '}<strong>{lowerFirstLetter(sectors[1])}</strong>&nbsp;?
      </div>
    }
    return <div style={{fontSize: 30}}>
      Avez-vous déjà pensé à postuler dans un secteur différent&nbsp;? ou dans un
      type de structure différent&nbsp;?
    </div>
  }
}


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
