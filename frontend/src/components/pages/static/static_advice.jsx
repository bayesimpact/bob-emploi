import PropTypes from 'prop-types'
import React from 'react'
import {Redirect} from 'react-router-dom'

import {Routes} from 'components/url'

import {STATIC_ADVICE_MODULES} from './static_advice/base'


export default class StaticAdvicePages extends React.Component {
  static propTypes = {
    match: PropTypes.shape({
      params: PropTypes.shape({
        adviceId: PropTypes.string,
      }).isRequired,
    }).isRequired,
  }

  render() {
    const {match: {params: {adviceId: selectedAdviceId}}} = this.props
    const module = STATIC_ADVICE_MODULES.find(({adviceId}) => adviceId === selectedAdviceId)
    if (!module || !module.Page) {
      return <Redirect to={Routes.ROOT} />
    }
    return <module.Page {...this.props} />
  }
}
