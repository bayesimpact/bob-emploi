import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import Radium from 'radium'

import {getAssociations} from 'store/actions'

import {AppearingList, CircularProgress, Colors, GrowingNumber, Icon,
  PaddedOnMobile, Tag} from 'components/theme'


class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {associationName} = this.props.advice.associationsData || {}
    return <div style={{fontSize: 30}}>
      Pourquoi ne pas faire équipe avec une association d'aide à l'emploi
      comme <strong>{associationName || 'Solidarités Nouvelles face au chômage'}</strong>&nbsp;?
    </div>
  }
}

class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    associations: PropTypes.arrayOf(PropTypes.object.isRequired),
    dispatch: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  componentWillMount() {
    const {dispatch, project} = this.props
    dispatch(getAssociations(project))
  }

  renderAssociations(style) {
    const {associations} = this.props
    return <AppearingList style={style}>
      {associations.map(({filters, link, name}, index) => <AssociationLink
        key={`association-${index}`} href={link} filters={filters}
        style={{marginTop: index ? -1 : 0}}>
        {name}
      </AssociationLink>)}
    </AppearingList>
  }

  render() {
    const {associations} = this.props
    if (!associations) {
      return <CircularProgress style={{margin: 'auto'}} />
    }
    const numSpecializedAssociations =
      associations.filter(({filters}) => filters && filters.length > 1).length
    const maybeS = count => count > 1 ? 's' : ''
    const hasOnlySpecialized = numSpecializedAssociations === associations.length
    const specialized = ` spécialisée${maybeS(numSpecializedAssociations)}`
    return <div>
      <PaddedOnMobile style={{fontSize: 21}}>
        Nous avons trouvé <GrowingNumber
          style={{fontWeight: 'bold'}} number={associations.length} isSteady={true} />
        {' '}association{maybeS(associations.length)}
        {hasOnlySpecialized ? specialized : null} pour vous
        {(numSpecializedAssociations > 0 && !hasOnlySpecialized) ? <span>
          {' '}dont <GrowingNumber
            style={{fontWeight: 'bold'}} number={numSpecializedAssociations} isSteady={true} />
          {specialized}
        </span> : null}
      </PaddedOnMobile>

      {this.renderAssociations({marginTop: 15})}
    </div>
  }
}
const ExpandedAdviceCardContent = connect(({app}, {project}) => ({
  associations: app.associations[project.projectId],
}))(ExpandedAdviceCardContentBase)


class AssociationLinkBase extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    filters: PropTypes.array,
    href: PropTypes.string.isRequired,
    style: PropTypes.object,
  }

  handleClick = () => {
    const {href} = this.props
    window.open(href, '_blank')
  }

  getTags() {
    const {filters, href} = this.props
    const tags = []
    if (/\.pole-emploi\.fr/.test(href)) {
      tags.push({
        color: Colors.SQUASH,
        value: 'officielle',
      })
    }
    if ((filters || []).some(f => /^for-job-group/.test(f))) {
      tags.push({
        color: Colors.RED_PINK,
        value: 'pour votre métier',
      })
    }
    if ((filters || []).some(f => /^for-departement/.test(f))) {
      tags.push({
        color: Colors.SKY_BLUE,
        value: 'pour votre région',
      })
    }
    if ((filters || []).some(f => /^for-women$/.test(f))) {
      tags.push({
        color: Colors.GREENISH_TEAL,
        value: 'pour les femmes',
      })
    }
    const forOldFilter = (filters || []).find(f => /^for-old\([0-9]+\)$/.test(f))
    if (forOldFilter) {
      const age = forOldFilter.replace(/^for-old\(([0-9]+)\)$/, '$1')
      tags.push({
        color: Colors.GREENISH_TEAL,
        value: `pour les plus de ${age} ans`,
      })
    }
    return tags
  }

  render() {
    const {children, style} = this.props
    const containerStyle = {
      ':hover': {
        backgroundColor: Colors.LIGHT_GREY,
      },
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
    return <div style={containerStyle} onClick={this.handleClick}>
      {children}
      {this.getTags().map(({color, value}) => <Tag
        key={`tag-${value}`} style={{backgroundColor: color, marginLeft: 15}}>
        {value}
      </Tag>)}
      <div style={{flex: 1}} />
      <Icon name="chevron-right" style={{fontSize: 20}} />
    </div>
  }
}
const AssociationLink = Radium(AssociationLinkBase)


export default {AdviceCard, ExpandedAdviceCardContent}
