
import PropTypes from 'prop-types'
import React from 'react'
import {Redirect, RouteComponentProps} from 'react-router'

import {Routes} from 'components/url'

import {STATIC_ADVICE_MODULES} from './static_advice/base'


type PagesProps = RouteComponentProps<{adviceId: string}>


export default class StaticAdvicePages extends React.PureComponent<PagesProps> {
  public static propTypes = {
    match: PropTypes.shape({
      params: PropTypes.shape({
        adviceId: PropTypes.string,
      }).isRequired,
    }).isRequired,
  }

  public render(): React.ReactNode {
    const {match: {params: {adviceId: selectedAdviceId}}} = this.props
    const module = STATIC_ADVICE_MODULES.
      find(({adviceId}): boolean => adviceId === selectedAdviceId)
    if (!module || !module.Page) {
      return <Redirect to={Routes.ROOT} />
    }
    return <module.Page {...this.props} />
  }
}
