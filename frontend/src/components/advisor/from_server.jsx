import PropTypes from 'prop-types'
import React from 'react'

import {Markdown} from 'components/theme'

import {AdviceSuggestionList} from './base'


class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      cardText: PropTypes.string,
    }).isRequired,
  }

  render() {
    const {cardText} = this.props.advice
    if (!cardText) {
      return null
    }
    return <div style={{fontSize: 30}}>
      <Markdown content={cardText} />
    </div>
  }
}


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      expandedCardItems: PropTypes.arrayOf(PropTypes.string.isRequired),
    }).isRequired,
  }

  render() {
    const {expandedCardItems} = this.props.advice
    return <AdviceSuggestionList isNotClickable={true}>
      {(expandedCardItems || []).map((content, index) => <div
        key={`item-${index}`} style={{fontWeight: 'normal'}}>
        <Markdown content={content} />
      </div>)}
    </AdviceSuggestionList>
  }
}


export default {AdviceCard, ExpandedAdviceCardContent}
