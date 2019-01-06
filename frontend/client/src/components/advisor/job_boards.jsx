import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import {CircularProgress, GrowingNumber, Tag} from 'components/theme'
import Picto from 'images/advices/picto-find-a-jobboard.png'

import {AdviceSuggestionList, connectExpandedCardWithContent} from './base'


class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    adviceData: PropTypes.shape({
      jobBoards: PropTypes.arrayOf(PropTypes.object.isRequired),
    }).isRequired,
    onExplore: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  renderJobBoards(style) {
    const {adviceData: {jobBoards}, onExplore, userYou} = this.props
    return <AdviceSuggestionList style={style}>
      {(jobBoards || []).map(({filters, link: href, title}, index) => <JobBoardLink
        key={`job-board-${index}`} {...{filters, href, userYou}}
        onClick={() => onExplore('jobboard')}>
        {title}
      </JobBoardLink>)}
    </AdviceSuggestionList>
  }

  render() {
    const {jobBoards} = this.props.adviceData
    const {userYou} = this.props
    if (!jobBoards) {
      return <CircularProgress style={{margin: 'auto'}} />
    }
    const numSpecializedJobBoards =
      jobBoards.filter(({filters}) => filters && filters.length).length
    const hasOnlySpecialized = numSpecializedJobBoards === jobBoards.length
    const maybeS = count => count > 1 ? 's' : ''
    const specialized = ` spécialisé${maybeS(numSpecializedJobBoards)}`
    return <div>
      <div>
        Nous avons trouvé <GrowingNumber
          style={{fontWeight: 'bold'}} number={jobBoards.length} isSteady={true} />
        {' '}site{maybeS(jobBoards.length)}
        {hasOnlySpecialized ? specialized : null}{userYou(' pour toi', ' pour vous')}
        {(numSpecializedJobBoards > 0 && !hasOnlySpecialized) ? <span>
          {' '}dont <GrowingNumber
            style={{fontWeight: 'bold'}} number={numSpecializedJobBoards} isSteady={true} />
          {specialized}</span> : null}
      </div>

      {this.renderJobBoards({marginTop: 15})}
    </div>
  }
}
const ExpandedAdviceCardContent = connectExpandedCardWithContent()(ExpandedAdviceCardContentBase)


class JobBoardLinkBase extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    filters: PropTypes.array,
    href: PropTypes.string.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  handleClick = () => {
    const {href} = this.props
    window.open(href, '_blank')
  }

  getTags() {
    const {filters, href, userYou} = this.props
    const tags = []
    if (/\.pole-emploi\.fr/.test(href)) {
      tags.push({
        color: colors.SQUASH,
        value: 'officiel',
      })
    }
    if ((filters || []).some(f => /^for-job-group/.test(f))) {
      tags.push({
        color: colors.GREENISH_TEAL,
        value: userYou('spécialisé pour ton métier', 'spécialisé pour votre métier'),
      })
    }
    if ((filters || []).some(f => /^for-departement/.test(f))) {
      tags.push({
        color: colors.BOB_BLUE,
        value: userYou('spécialisé pour ta région', 'spécialisé pour votre région'),
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
      <ChevronRightIcon style={{fill: colors.CHARCOAL_GREY, height: 20, width: 20}} />
    </div>
  }
}
const JobBoardLink = Radium(JobBoardLinkBase)


export default {ExpandedAdviceCardContent, Picto}
