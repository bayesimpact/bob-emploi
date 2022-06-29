import _uniqueId from 'lodash/uniqueId'
import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'
import {useLocation, useParams} from 'react-router'
import {Redirect} from 'react-router-dom'

import {DURATION_TEXT} from 'store/action_plan'

import Page from './base'
import {ActionBasicInfo, ActionTitle} from './action'

const h2Style: React.CSSProperties = {
  fontSize: 16,
  fontStyle: 'bold',
  margin: '20px 0 10px 0',
}
const contentStyle: React.CSSProperties = {
  fontSize: 14,
  margin: 0,
}
interface ActionParamsConfig {
  actionId?: string
  strategyId?: string
}

interface PreviewProps {
  action: bayes.bob.Action
  stratTitle?: string
  style?: React.CSSProperties
  titleId?: string
}

const ActionPreviewBase = (props: PreviewProps): React.ReactElement => {
  const {action, stratTitle, style, titleId: parentTitleId} = props
  const {actionId, adviceId, duration, shortDescription = '', title = ''} = action
  const {t, t: translate} = useTranslation()

  const fallbackTitleId = useMemo(_uniqueId, [])
  const titleId = parentTitleId || fallbackTitleId

  return <div style={style}>
    <ActionTitle {...{actionId, adviceId, title}} id={titleId} />
    {stratTitle ? <ActionBasicInfo duration={duration} title={stratTitle} /> :
      <React.Fragment>
        <h2 style={h2Style}>{t('Durée')}</h2>
        <p style={contentStyle}>
          {translate(...DURATION_TEXT[duration || 'UNKNOWN_ACTION_DURATION'])}
        </p>
      </React.Fragment>
    }
    <h2 style={h2Style}>{t('Pourquoi cette tâche peut vous être utile\u00A0?')}</h2>
    <p style={contentStyle}>{shortDescription}</p>
  </div>
}
export const ActionPreview = React.memo(ActionPreviewBase)

interface Props extends Pick<bayes.bob.Project, 'actions'|'strategies'> {
  baseUrl: string
}

interface LocationProps {
  strategyId?: string
  strategyUrl?: string
}

const ActionPlanActionPreviewPage = (props: Props): React.ReactElement => {
  const {actions = [], baseUrl, strategies = []} = props
  const {actionId} = useParams<ActionParamsConfig>()
  const {state: {strategyId = '', strategyUrl = ''} = {}} = useLocation<LocationProps>()
  const onBackClick = useMemo(() => strategyUrl ? {
    pathname: strategyUrl,
    state: {isAlreadyRead: true},
  } : undefined, [strategyUrl])

  const action = actions.find(({actionId: aId}): boolean => actionId === aId)

  if (!action) {
    return <Redirect to={baseUrl} />
  }

  const strategyIndex =
    strategies.findIndex(({strategyId: sId}): boolean => strategyId === sId)
  const {title: stratTitle} = strategies[strategyIndex] || {}

  return <Page page="preview" onBackClick={onBackClick}>
    <ActionPreview {...{action, stratTitle}} />
  </Page>
}


export default React.memo(ActionPlanActionPreviewPage)
