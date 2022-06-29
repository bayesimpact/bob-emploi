import _uniqueId from 'lodash/uniqueId'
import CheckCircleIcon from 'mdi-react/CheckCircleIcon'
import CheckCircleOutlineIcon from 'mdi-react/CheckCircleOutlineIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import React, {useCallback, useMemo} from 'react'
import {useTranslation} from 'react-i18next'
import {generatePath} from 'react-router'
import {Link, useHistory} from 'react-router-dom'

import type {ActionWithId} from 'store/actions'
import {openActionDetailAction, completeAction, uncompleteAction, useDispatch} from 'store/actions'
import isMobileVersion from 'store/mobile'
import {useProject} from 'store/project'

import DeadlineButton from 'components/action_deadline_button'
import Button from 'components/button'
import {RadiumListEl} from 'components/radium'
import {SmoothTransitions} from 'components/theme'
import {Routes} from 'components/url'
import {ActionPicto} from './action'

const completeButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  border: `1px solid ${colors.MODAL_PROJECT_GREY}`,
  display: 'flex',
  padding: 12,
}
const iconStyle: React.CSSProperties = {
  color: '#000',
  marginRight: 3,
  opacity: .54,
}
const iconDoneStyle: React.CSSProperties = {
  ...iconStyle,
  color: '#fff',
  fill: colors.BOB_BLUE,
  opacity: 1,
}
interface ActionButtonValidationProps {
  'aria-describedby': string
  action: ActionWithId
  children?: React.ReactNode
  isActionDone: boolean
  project: bayes.bob.Project
  style?: RadiumCSSProperties
  visualElement: 'page'|'plan'
}
const ActionCompleteButton = (props: ActionButtonValidationProps): React.ReactElement => {
  const {action, children, isActionDone, project, style, visualElement, ...otherProps} = props
  const dispatch = useDispatch()
  const iconSize = isMobileVersion ? 30 : 20
  const {t} = useTranslation()

  const handleComplete = useCallback((event: React.MouseEvent) => {
    event.stopPropagation()
    if (isActionDone) {
      dispatch(uncompleteAction(project, action, visualElement))
      return
    }
    dispatch(completeAction(project, action, visualElement))
  }, [action, dispatch, isActionDone, project, visualElement])

  const DoneIcon = isActionDone ? CheckCircleIcon : CheckCircleOutlineIcon
  const doneIconStyle = isActionDone ? iconDoneStyle : iconStyle
  const doneStatusIcon = <DoneIcon
    size={iconSize} style={doneIconStyle} focusable={false} aria-hidden={true} />
  if (!children) {
    return <button
      onClick={handleComplete} aria-pressed={isActionDone}
      style={{padding: 12}} type="button"
      aria-label={t('Marquer comme complétée')} {...otherProps}>
      {doneStatusIcon}
    </button>
  }
  return <Button
    onClick={handleComplete} type="discreet" style={{...completeButtonStyle, ...style}}
    aria-pressed={isActionDone} {...otherProps}>
    {children}{doneStatusIcon}
  </Button>
}

const containerStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderLeft: 'solid 3px transparent',
  boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
  boxSizing: 'border-box',
  display: 'flex',
  padding: '18px 15px 12px 0',
}
const titleStyle: React.CSSProperties = {
  color: 'inherit',
  flex: 1,
  fontSize: 16,
  textDecoration: 'none',
}
const actionDecorationStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: 10,
}
const deadlineButtonStyle: React.CSSProperties = {
  fontSize: 12,
}
interface Props {
  action: ActionWithId
  isSelected?: boolean
  style?: React.CSSProperties
}
const pictoStyle: React.CSSProperties = {
  height: 30,
}
const chevronStyle: React.CSSProperties = {
  margin: 'auto -10px auto 10px',
}

const ActionListElement = (props: Props) => {
  const {
    action, action: {actionId, expectedCompletionAt, isResourceShown, status, title},
    isSelected, style} = props
  const isActionDone = status === 'ACTION_DONE'
  const isRead = !!isResourceShown
  const project = useProject()
  const dispatch = useDispatch()
  const history = useHistory()
  const onTitleClick = useCallback((event: React.MouseEvent) => {
    if (!project) {
      return
    }
    event.stopPropagation()
    dispatch(openActionDetailAction(project, action))
  }, [action, dispatch, project])
  const {projectId = ''} = project || {}
  const url = generatePath(Routes.ACTION_PLAN_ACTION_PATH, {actionId, projectId})
  const handleCardClick = useCallback((event: React.MouseEvent) => {
    history.push(url)
    onTitleClick(event)
  }, [history, onTitleClick, url])
  const containerFinalStyle = useMemo((): RadiumCSSProperties => ({
    ':hover': isSelected ? {} : {
      backgroundColor: colors.PALE_GREY,
      borderLeft: `solid 3px ${colors.FOOTER_GREY}`,
    },
    'cursor': 'pointer',
    ...containerStyle,
    ...isSelected ? {
      backgroundColor: colors.PALE_BLUE,
      borderLeft: `solid 3px ${colors.BOB_BLUE}`,
    } : isRead ? {} : {fontWeight: 'bold'},
    ...style,
    ...SmoothTransitions,
  }), [isSelected, isRead, style])
  const titleContainerStyle = {
    alignSelf: 'stretch',
    flex: 1,
    paddingLeft: expectedCompletionAt ? 0 : 12,
  }
  const titleId = useMemo(_uniqueId, [])
  if (!project) {
    return null
  }

  // Clicking on the whole card is equivalent to clicking on the linked title, it is a
  // convenience added for users that have a cursor.
  // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
  return <RadiumListEl onClick={handleCardClick} style={containerFinalStyle}>
    {expectedCompletionAt ? <ActionCompleteButton
      action={action} isActionDone={isActionDone} project={project} visualElement="plan"
      aria-describedby={titleId} /> : null}
    <div style={titleContainerStyle}>
      <Link style={titleStyle} to={url} onClick={onTitleClick} id={titleId}>{title}</Link>
      <div style={actionDecorationStyle}>
        {isActionDone || expectedCompletionAt ? null : <DeadlineButton
          action={action as ActionWithId} visualElement="plan" style={deadlineButtonStyle}
          aria-describedby={titleId} />}
        {expectedCompletionAt ? null : <ActionPicto action={action} style={pictoStyle} />}
      </div>
    </div>
    {isMobileVersion ? <ChevronRightIcon
      color={colors.COOL_GREY} size={28} aria-hidden={true} focusable={false}
      style={chevronStyle} /> : null}
  </RadiumListEl>
}

export default React.memo(ActionListElement)

export {ActionCompleteButton}
