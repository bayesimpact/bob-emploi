import React from 'react'
import {useTranslation} from 'react-i18next'
import type {RouteComponentProps} from 'react-router'
import {Redirect} from 'react-router'

import {STATIC_ADVICE_MODULES} from 'components/static'
import {Routes} from 'components/url'

import registerAllStaticAdviceModules from './static_advice/register'

registerAllStaticAdviceModules()


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


export default React.memo(StaticAdvicePages)
