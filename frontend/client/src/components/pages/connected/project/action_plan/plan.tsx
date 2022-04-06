import _groupBy from 'lodash/groupBy'
import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'
import {generatePath, Redirect} from 'react-router'

import type {ActionWithId, DispatchAllActions, RootState} from 'store/actions'
import {startProjectFeedback} from 'store/actions'
import {SECTIONS, decideSection, useAction} from 'store/action_plan'
import {combineTOptions} from 'store/i18n'
import isMobileVersion from 'store/mobile'
import {useSafeDispatch} from 'store/promise'

import FeedbackStars from 'components/feedback_stars'
import {useModal} from 'components/modal'
import {NAVIGATION_BAR_HEIGHT, PageWithNavigationBar} from 'components/navigation'
import {SmoothTransitions} from 'components/theme'
import {Routes} from 'components/url'

import {Action} from './action'
import ActionList from './action_list'
import {contentWidth} from './base'
import FeedbackModal from './feedback_modal'
import SendPlanButton from './send_plan_button'

const topPadding = 25
const sideSpacing = 40
const pageStyle: React.CSSProperties = {
  alignItems: 'flex-start',
  backgroundColor: colors.PALE_GREY,
  display: 'flex',
  justifyContent: 'center',
}
const pageContainerStyle: React.CSSProperties = isMobileVersion ? {
  display: 'flex',
  flexDirection: 'column',
  maxWidth: contentWidth,
  width: '100%',
} : {
  alignItems: 'stretch',
  display: 'flex',
  height: `calc(100vh - ${NAVIGATION_BAR_HEIGHT}px)`,
  width: '100%',
}
const planStyle: undefined|React.CSSProperties = isMobileVersion ? undefined : {
  flex: 'none',
  overflowY: 'scroll',
  padding: `${topPadding}px 20px 20px ${sideSpacing}px`,
  width: 375,
}
const panelStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.1)',
  overflow: 'hidden',
}
const actionStyle: React.CSSProperties = {
  ...panelStyle,
  borderRadius: 10,
  margin: `0px ${sideSpacing}px 40px 25px`,
  padding: 30,
}

const actionContainerStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'scroll',
  paddingTop: topPadding,
}

const planButtonStyle: React.CSSProperties = {
  display: 'block',
  margin: `${isMobileVersion ? 0 : '15px'} auto`,
  width: '100%',
}

const fakePlanButtonStyle: React.CSSProperties = {
  display: 'block',
  margin: '15px auto',
  opacity: 0,
  pointerEvents: 'none',
}

const fixedPlanButtonStyle: React.CSSProperties = {
  ...planButtonStyle,
  margin: 0,
}

const sectionStyle: React.CSSProperties = {
  ...panelStyle,
  ...isMobileVersion && {boxShadow: 'none'},
  backgroundColor: isMobileVersion ? 'none' : colors.FOOTER_GREY,
  marginBottom: isMobileVersion ? 5 : 25,
}
const closedSectionStyle: React.CSSProperties = {
  ...sectionStyle,
  backgroundColor: isMobileVersion ? 'none' : '#fff',
  boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.13) 0px 1px 2px rgba(0, 0, 0, 0.09)',
}

interface Props {
  project: bayes.bob.Project & {projectId: string}
}
type SectionProps = (typeof SECTIONS)[number]

const ActionPlanPage = ({project, project: {actions, feedback, projectId = ''}}: Props) => {
  const {t, t: translate} = useTranslation()
  const hasEmail = useSelector(({user: {profile: {email = ''} = {}}}: RootState) => !!email)
  const [isFeedbackBarNeeded, setIsFeedbackNeeded] = useState(!feedback?.score)
  const [expandedSection, setExpandedSection] = useState('toSchedule')
  const [hasBeenOpenForAWhile, setHasBeenOpenForAWhile] = useState(false)
  useEffect(() => {
    const timeout = window.setTimeout(() => setHasBeenOpenForAWhile(true), 120_000)
    return () => window.clearTimeout(timeout)
  }, [])

  const [isFeedbackModalShown, openFeedbackModal, closeFeedbackModal] = useModal(false)
  const [numStars, setNumStars] = useState(0)
  const handleStarClick = useCallback((score: number) => {
    setNumStars(score)
    openFeedbackModal()
  }, [openFeedbackModal])
  const handleFeedbackClose = useCallback(() => {
    setIsFeedbackNeeded(false)
  }, [])
  const sectionsWithActions: readonly [SectionProps, readonly ActionWithId[]][] = useMemo(() => {
    const actionsBySection = _groupBy(
      actions?.filter((a): a is ActionWithId => !!a.actionId) || [],
      action => decideSection(action).sectionId,
    )
    return SECTIONS.
      map((section): [SectionProps, readonly ActionWithId[]] =>
        [section, actionsBySection[section.sectionId] || []]).
      // Drop the "toSchedule" section if it is empty.
      filter(([section, actions]) => section.sectionId !== 'toSchedule' || !!actions.length)
  }, [actions])
  const emailButton = <SendPlanButton key="email" project={project} style={planButtonStyle} />
  const fakeEmailButton = <SendPlanButton
    key="fakeButton" aria-hidden={true} project={project} style={fakePlanButtonStyle} />

  const selectedAction = useAction()
  if (!selectedAction && !isMobileVersion) {
    const [{actionId = ''} = {}] = sectionsWithActions.flatMap(([, actions]) => actions)
    const url = generatePath(Routes.ACTION_PLAN_ACTION_PATH, {actionId, projectId})
    return <Redirect to={url} />
  }

  const isFeedbackBarShown = !isFeedbackModalShown && !feedback?.score && (
    // 2 minutes have passed.
    hasBeenOpenForAWhile ||
    // Has at least 1 deadline.
    actions?.some(action => !!action.expectedCompletionAt) ||
    // Have 3 actions been shown.
    ((actions?.filter(action => !!action.isResourceShown)?.length || 0) > 3)
  )

  const name = project.actionPlanName ?
    project.actionPlanName[0].toUpperCase() + project.actionPlanName.slice(1) : ''

  return <PageWithNavigationBar
    page="action-plan-plan" style={pageStyle} isMain={!selectedAction}
    navBarContent={name}>
    <div style={pageContainerStyle}>
      <FeedbackModal
        isShown={isFeedbackModalShown} isInStarRating={true} onClose={closeFeedbackModal}
        project={project} numStars={numStars} />
      <div
        className="no-scrollbars" style={planStyle} role={selectedAction ? 'navigation' : undefined}
        aria-label={t("Plan d'action")}>
        {hasEmail || isMobileVersion ? null : emailButton}
        {sectionsWithActions.map(([{icon, name, sectionId}, actions]) => {
          if (sectionId === 'never') {
            return null
          }
          return <ActionList
            key={sectionId} icon={icon} actions={actions} sectionId={sectionId}
            isExpanded={expandedSection === sectionId} onExpand={setExpandedSection}
            style={expandedSection === sectionId ? sectionStyle : closedSectionStyle}
            title={translate(...combineTOptions(name, {count: actions?.length}))}
            selectedAction={selectedAction} />
        })}
        {hasEmail && !isMobileVersion ? emailButton : null}
      </div>
      {selectedAction ? <main style={actionContainerStyle} role="main" id="main" tabIndex={-1}>
        {hasEmail ? null : fakeEmailButton}
        <div style={actionStyle}>
          <Action action={selectedAction} project={project} isChangeDateButtonShown={true} />
        </div>
      </main> : null}
      {isMobileVersion ?
        <SendPlanButton
          key="email" project={project} style={fixedPlanButtonStyle} isFixed={true} /> : null}
      {isFeedbackBarNeeded ? <FeedbackBar
        project={project} onStarClick={handleStarClick}
        onClose={isMobileVersion ? handleFeedbackClose : undefined}
        isShown={isFeedbackBarShown} /> : null}
    </div>
  </PageWithNavigationBar>
}

interface FeedbackBarProps {
  isShown: boolean
  onClose?: () => void
  onStarClick: (score: number) => void
  project: bayes.bob.Project
}

const starsStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: '#000',
  borderRadius: '30px 30px 0 0',
  color: '#fff',
  display: 'flex',
  flexWrap: 'wrap',
  fontSize: isMobileVersion ? 16 : 14,
  justifyContent: 'center',
  maxWidth: 450,
  padding: '6px 25px',
  pointerEvents: 'all',
  textAlign: 'initial',
}

const feedbackBarStyle: React.CSSProperties = {
  alignItems: 'flex-end',
  borderBottom: '2px solid #000',
  bottom: 0,
  display: 'flex',
  justifyContent: 'center',
  left: 0,
  pointerEvents: 'none',
  position: 'fixed',
  right: 0,
  ...SmoothTransitions,
}

const noFlexShrink: React.CSSProperties = {
  flexShrink: 0,
}

const FeedbackBarBase = (props: FeedbackBarProps): React.ReactElement => {
  const {isShown, onClose, onStarClick, project, project: {feedback}} = props
  const {t} = useTranslation()
  const [score, setScore] = useState(feedback?.score || 0)
  const dispatch = useSafeDispatch<DispatchAllActions>()

  const updateScore = useCallback((score: number): void => {
    if (!score) {
      return
    }
    setScore(score)
    dispatch(startProjectFeedback(project, score))
    onStarClick(score)
  }, [dispatch, onStarClick, project])

  const containerStyle = useMemo((): React.CSSProperties => isShown ? feedbackBarStyle : {
    ...feedbackBarStyle,
    transform: 'translateY(100%)',
  }, [isShown])

  return <div style={containerStyle} aria-hidden={!isShown}>
    {isMobileVersion ? null : <svg width="15" height="15" viewBox="0 0 15 15" style={noFlexShrink}>
      <path d="M 0 15 h 15 V 0 C 15 7.5 7.5 15 0 15" fill="#000" />
    </svg>}
    <FeedbackStars
      style={starsStyle}
      size={10}
      onClose={onClose}
      isDark={true}
      isInline={!isMobileVersion}
      isWhite={true} score={score}
      title={t<string>(
        'Que pensez-vous de {{productName}}\u00A0?', {productName: config.productName})}
      onStarClick={updateScore} />
    {isMobileVersion ? null : <svg width="15" height="15" viewBox="0 0 15 15" style={noFlexShrink}>
      <path d="M 0 0 v 15 h 15 C 7.5 15 0 7.5 0 0" fill="#000" />
    </svg>}
  </div>
}
const FeedbackBar = React.memo(FeedbackBarBase)

export default React.memo(ActionPlanPage)
