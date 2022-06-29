import React, {useCallback, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'

import type {ActionWithId} from 'store/actions'
import {computeActionsForProject, computeAdvicesForProject} from 'store/actions'
import {useAsynceffect, useSafeDispatch} from 'store/promise'
import {useUserExample} from 'store/user'

import CircularProgress from 'components/circular_progress'
import {Action} from 'components/pages/connected/project/action_plan/action'

import type {DispatchAllEvalActions, EvalRootState} from '../store/actions'

const emptyArray = [] as const
const emptyObject = {} as const

interface LinkProps {
  action: ActionWithId
  isSelected?: boolean
  onClick: (action: ActionWithId) => void
}

const linkStyle: React.CSSProperties = {
  padding: '10px 0',
}
const selectedLinkStyle: React.CSSProperties = {
  ...linkStyle,
  backgroundColor: '#fff',
  fontWeight: 'bold',
}

const ActionLinkBase = ({action, isSelected, onClick}: LinkProps): React.ReactElement => {
  const handleClick = useCallback(() => onClick(action), [action, onClick])
  return <li>
    <button style={isSelected ? selectedLinkStyle : linkStyle} onClick={handleClick} type="button">
      {action.title}
    </button>
  </li>
}
const ActionLink = React.memo(ActionLinkBase)

const layoutStyle: React.CSSProperties = {
  display: 'flex',
}

interface ActionsListProps {
  actions: readonly ActionWithId[]
  onSelectAction: (action: ActionWithId) => void
  selectedAction?: ActionWithId
  style?: React.CSSProperties
}

const ActionsListBase = (props: ActionsListProps): React.ReactElement => {
  const {actions, onSelectAction, selectedAction, style} = props
  return <ul style={style}>
    {actions.map(action => <ActionLink
      key={action.actionId} action={action} onClick={onSelectAction}
      isSelected={action === selectedAction} />)}
  </ul>
}
const ActionsList = React.memo(ActionsListBase)

const listAsMenuStyle: React.CSSProperties = {
  margin: 0,
  maxHeight: '100vh',
  maxWidth: 375,
  overflow: 'auto',
}
const strategiesListStyle: React.CSSProperties = {
  ...listAsMenuStyle,
  listStyle: 'none',
  padding: 0,
}
const strategyHeaderStyle: React.CSSProperties = {
  fontSize: '1.1em',
  marginBottom: 5,
}
const strategyStyle: React.CSSProperties = {
  borderBottom: 'solid 1px',
  marginBottom: 20,
}
const actionContainerStyle: React.CSSProperties = {
  flex: 1,
}
const actionCardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 8,
  margin: 25,
  padding: 20,
}

interface PanelProps {
  actions: readonly ActionWithId[]
  isLoading: boolean
  project: bayes.bob.Project
}

const ActionsPanelBase = ({actions, isLoading, project}: PanelProps): React.ReactElement => {
  const [selectedAction, selectAction] = useState<ActionWithId|undefined>(undefined)
  const {t} = useTranslation()
  const actionsMap = useMemo(
    (): Record<string, ActionWithId> =>
      Object.fromEntries(actions.map(action => [action.actionId, action])),
    [actions],
  )
  const actionsInStrategy = useMemo(
    (): Record<string, string> =>
      Object.fromEntries((project.strategies || []).flatMap(
        strategy => (strategy.actionIds || []).map(
          actionId => [actionId || '', strategy.strategyId || '']))),
    [project],
  )
  const actionsInNoStrategy = useMemo(
    (): readonly ActionWithId[] => actions.filter(({actionId}) => !actionsInStrategy[actionId]),
    [actions, actionsInStrategy],
  )

  if (isLoading) {
    return <CircularProgress />
  }

  return <div style={layoutStyle}>
    {project.strategies ? <ul style={strategiesListStyle}>
      {project.strategies.map(strategy => <li key={strategy.strategyId} style={strategyStyle}>
        <header style={strategyHeaderStyle}>
          {t('Stratégie\u00A0:')} {strategy.infinitiveTitle || strategy.title}
        </header>
        <ActionsList
          actions={(strategy.actionIds || []).
            map(actionId => actionsMap[actionId]).
            filter(action => !!action)}
          selectedAction={selectedAction}
          onSelectAction={selectAction} />
      </li>)}
      <li>
        <header style={strategyHeaderStyle}>{t('Actions sans stratégie')}</header>
        <ActionsList
          actions={actionsInNoStrategy}
          selectedAction={selectedAction}
          onSelectAction={selectAction} />
      </li>
    </ul> : <ActionsList
      actions={actions} selectedAction={selectedAction} onSelectAction={selectAction}
      style={listAsMenuStyle} />}
    <div style={actionContainerStyle}>
      {selectedAction && <div style={actionCardStyle}>
        <Action action={selectedAction} project={project} />
      </div>}
    </div>
  </div>
}
export const ActionsPanel = React.memo(ActionsPanelBase)

const ActionsPage = (): React.ReactElement => {
  const [isFetching, setIsFecthing] = useState(false)
  const [actions, setActions] = useState<readonly ActionWithId[]>(emptyArray)
  const {i18n} = useTranslation()
  const dispatch = useSafeDispatch<DispatchAllEvalActions>()
  const userExample = useUserExample()
  useAsynceffect(async (checkIfCanceled) => {
    setIsFecthing(true)
    const user = {
      featuresEnabled: {allModules: true},
      profile: {locale: i18n.language},
      projects: userExample.projects,
    }
    dispatch({type: 'SELECT_USER', user})
    const actionsPromise = dispatch(computeActionsForProject(user))
    const advicesPromise = dispatch(computeAdvicesForProject(user))
    const {actions = emptyArray} = await actionsPromise || {}
    if (checkIfCanceled()) {
      return
    }
    setIsFecthing(false)
    setActions(actions.filter((a): a is ActionWithId => !!a.actionId))
    const {advices = emptyArray} = await advicesPromise || {}
    dispatch({type: 'SELECT_USER', user: {
      ...user,
      projects: [{
        ...userExample.projects?.[0],
        actions,
        advices,
      }],
    }})
  }, [dispatch, i18n.language, userExample])

  const project = useSelector(
    ({user}: EvalRootState): bayes.bob.Project => user.projects?.[0] || emptyObject)

  return <ActionsPanel project={project} actions={actions} isLoading={isFetching} />
}

export default React.memo(ActionsPage)
