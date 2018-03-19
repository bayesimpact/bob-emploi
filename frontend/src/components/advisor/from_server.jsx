import PropTypes from 'prop-types'
import React from 'react'

import {Markdown} from 'components/theme'
import Picto from 'images/advices/picto-specific-to-job.png'

import {AdviceSuggestionList} from './base'


class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      cardText: PropTypes.string,
    }).isRequired,
    fontSize: PropTypes.number.isRequired,
  }

  render() {
    const {fontSize} = this.props
    const {cardText} = this.props.advice
    if (!cardText) {
      return null
    }
    return <div style={{fontSize: fontSize}}>
      <Markdown content={cardText} />
    </div>
  }
}


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      expandedCardHeader: PropTypes.string,
      expandedCardItems: PropTypes.arrayOf(PropTypes.string.isRequired),
    }).isRequired,
  }

  render() {
    const {expandedCardHeader, expandedCardItems} = this.props.advice
    return <div>
      <Markdown content={expandedCardHeader} />
      <AdviceSuggestionList isNotClickable={true}>
        {(expandedCardItems || []).map((content, index) => <div
          key={`item-${index}`} style={{fontWeight: 'normal'}}>
          <Markdown content={content} />
        </div>)}
      </AdviceSuggestionList>
    </div>
  }
}


export default {AdviceCard, ExpandedAdviceCardContent, Picto}
