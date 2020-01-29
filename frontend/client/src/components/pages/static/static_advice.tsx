
import PropTypes from 'prop-types'
import React from 'react'
import {useTranslation} from 'react-i18next'
import {Redirect, RouteComponentProps} from 'react-router'

import {Routes} from 'components/url'

import {STATIC_ADVICE_MODULES} from './static_advice/base'


type PagesProps = RouteComponentProps<{adviceId: string}>


const StaticAdvicePages = (props: PagesProps): React.ReactElement => {
  const {match: {params: {adviceId: selectedAdviceId}}} = props
  const {t} = useTranslation('staticAdvice')
  const module = STATIC_ADVICE_MODULES.
    find(({adviceId}): boolean => adviceId === selectedAdviceId)
  if (!module || !module.Page) {
    return <Redirect to={Routes.ROOT} />
  }
  return <module.Page {...props} t={t} />
}
StaticAdvicePages.propTypes = {
  match: PropTypes.shape({
    params: PropTypes.shape({
      adviceId: PropTypes.string,
    }).isRequired,
  }).isRequired,
}


export default React.memo(StaticAdvicePages)
