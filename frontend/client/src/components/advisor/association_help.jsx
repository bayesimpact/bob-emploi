import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import {CircularProgress, GrowingNumber, Tag} from 'components/theme'
import Picto from 'images/advices/picto-association-help.png'

import {AdviceSuggestionList, connectExpandedCardWithContent} from './base'


class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    adviceData: PropTypes.shape({
      associations: PropTypes.arrayOf(PropTypes.object.isRequired),
    }).isRequired,
    onExplore: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  renderAssociations(style) {
    const {adviceData: {associations}, onExplore, userYou} = this.props
    return <AdviceSuggestionList style={style}>
      {(associations || []).map(({filters, link, name}, index) => <AssociationLink
        key={`association-${index}`} href={link} onClick={() => onExplore('association')}
        {...{filters, userYou}}>
        {name}
      </AssociationLink>)}
    </AdviceSuggestionList>
  }

  render() {
    const {associations} = this.props.adviceData
    const {userYou} = this.props
    if (!associations || !associations.length) {
      return <CircularProgress style={{margin: 'auto'}} />
    }
    const numSpecializedAssociations =
      associations.filter(({filters}) => filters && filters.length > 1).length
    const maybeS = count => count > 1 ? 's' : ''
    const hasOnlySpecialized = numSpecializedAssociations === associations.length
    const specialized = ` spécialisée${maybeS(numSpecializedAssociations)}`
    return <div>
      <div>
        Nous avons trouvé <GrowingNumber
          style={{fontWeight: 'bold'}} number={associations.length} isSteady={true} />
        {' '}association{maybeS(associations.length)}
        {hasOnlySpecialized ? specialized : null} {userYou('pour toi', 'pour vous')}
        {(numSpecializedAssociations > 0 && !hasOnlySpecialized) ? <span>
          {' '}dont <GrowingNumber
            style={{fontWeight: 'bold'}} number={numSpecializedAssociations} isSteady={true} />
          {specialized}
        </span> : null}
      </div>

      {this.renderAssociations({marginTop: 15})}
    </div>
  }
}
const ExpandedAdviceCardContent = connectExpandedCardWithContent()(ExpandedAdviceCardContentBase)


class AssociationLinkBase extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    filters: PropTypes.array,
    href: PropTypes.string.isRequired,
    onClick: PropTypes.func,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  handleClick = () => {
    const {href, onClick} = this.props
    window.open(href, '_blank')
    onClick && onClick()
  }

  getTags() {
    const {filters, href, userYou} = this.props
    const tags = []
    if (/\.pole-emploi\.fr/.test(href)) {
      tags.push({
        color: colors.SQUASH,
        value: () => 'officielle',
      })
    }
    if ((filters || []).some(f => /^for-job-group/.test(f))) {
      tags.push({
        color: colors.RED_PINK,
        value: userYou('pour ton métier', 'pour votre métier'),
      })
    }
    if ((filters || []).some(f => /^for-departement/.test(f))) {
      tags.push({
        color: colors.BOB_BLUE,
        value: userYou('pour ta région', 'pour votre région'),
      })
    }
    if ((filters || []).some(f => /^for-women$/.test(f))) {
      tags.push({
        color: colors.GREENISH_TEAL,
        value: 'pour les femmes',
      })
    }
    const forOldFilter = (filters || []).find(f => /^for-old\([0-9]+\)$/.test(f))
    if (forOldFilter) {
      const age = forOldFilter.replace(/^for-old\(([0-9]+)\)$/, '$1')
      tags.push({
        color: colors.GREENISH_TEAL,
        value: `pour les plus de ${age} ans`,
      })
    }
    return tags
  }

  render() {
    const {children, style} = this.props
    return <div style={style} onClick={this.handleClick}>
      {children}
      {this.getTags().map(({color, value}) => <Tag
        key={`tag-${value}`} style={{backgroundColor: color, marginLeft: 15}}>
        {value}
      </Tag>)}
      <div style={{flex: 1}} />
      <ChevronRightIcon style={{fill: colors.CHARCOAL_GREY, height: 24, width: 20}} />
    </div>
  }
}
const AssociationLink = Radium(AssociationLinkBase)


export default {ExpandedAdviceCardContent, Picto}
