import _uniqueId from 'lodash/uniqueId'
import _memoize from 'lodash/memoize'
import ArrowLeftIcon from 'mdi-react/ArrowLeftIcon'
import OpenNewIcon from 'mdi-react/OpenInNewIcon'
import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import type {ReactMarkdownProps} from 'react-markdown/lib/complex-types'
import {generatePath, useParams} from 'react-router'
import {Link, Redirect} from 'react-router-dom'

import {useIsTabNavigationUsed} from 'hooks/tab_navigation'

import {AdvicePicto, ExpandedAdviceCardContent} from 'components/advisor'
import DeadlineButton from 'components/action_deadline_button'
import {colorToAlpha} from 'components/colors'
import Emoji from 'components/emoji'
import Markdown from 'components/markdown'
import type {MarkdownLinkProps, MarkdownParagraphRendererProps} from 'components/markdown'
import {FixedButtonNavigation} from 'components/navigation'
import {SmartLink} from 'components/radium'
import {SmoothTransitions} from 'components/theme'
import {Routes} from 'components/url'
import jobflixImage from 'images/advices/jobflix.svg'
import directHitImage from 'images/emojis/direct-hit.png'
import twelveThirtyImage from 'images/emojis/twelve-thirty.png'

import type {ActionWithId} from 'store/actions'
import {actionIsShown, exploreAction, useDispatch} from 'store/actions'
import {DURATION_TEXT, decideSection, getActionResourceContent} from 'store/action_plan'
import isMobileVersion from 'store/mobile'

import {ActionCompleteButton} from './action_list_element'

const gap = 30

const h1Style: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  fontSize: 22,
}
const h2Style: React.CSSProperties = {
  fontSize: '1.125em',
  fontStyle: 'bold',
  margin: '20px 0 10px 0',
}
const resourceContentStyle: React.CSSProperties = {
  lineHeight: 1.4375,
}
const contentStyle: React.CSSProperties = {
  ...resourceContentStyle,
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'space-between',
  lineHeight: 1.4375,
  margin: 0,
}
const completionDateContainerStyle: React.CSSProperties = {
  alignItems: 'flex-start',
  borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
  display: 'flex',
  justifyContent: 'center',
  marginTop: isMobileVersion ? 0 : gap,
}
const completionDateStyle: React.CSSProperties = {
  backgroundColor: '#000',
  borderRadius: '0 0 25px 25px',
  color: '#fff',
  padding: '10px 25px',
}
const noFlexShrink: React.CSSProperties = {
  flexShrink: 0,
}
const deadlineButtonStyle: React.CSSProperties = {
  marginTop: gap,
  padding: 12,
  ...!isMobileVersion && {flex: 1},
}
const bottomDeadlineButtonStyle: React.CSSProperties = {
  ...deadlineButtonStyle,
  border: `1px solid ${colors.MODAL_PROJECT_GREY}`,
  flex: 1,
  marginTop: 0,
}
const blueBoxesOverflowContainerStyle: React.CSSProperties = isMobileVersion ? {
  marginLeft: `-${gap}px`,
  marginRight: `-${gap}px`,
  maxWidth: '100vw',
  overflow: 'hidden',
  position: 'relative',
} : {}
const blueBoxesContainerStyle: React.CSSProperties = {
  gap,
  ...isMobileVersion ? {
    display: 'grid',
    gridTemplateColumns: '230px 230px',
    overflow: 'scroll',
    padding: `0 ${gap}px`,
  } : {
    display: 'flex',
    flexDirection: 'row',
    marginTop: gap,
  },
}
const blueBoxStyle: React.CSSProperties = {
  backgroundColor: colors.PALE_BLUE,
  borderRadius: 10,
  flex: 1,
  fontSize: 15,
  padding: 20,
  textAlign: 'center',
}
const blueBoxIconStyle: React.CSSProperties = {
  display: 'block',
  height: 26,
  margin: '0 auto 10px',
}
const h2InlineStyle: React.CSSProperties = {
  display: 'inline',
  fontSize: 'inherit',
}
interface ActionParamsConfig {
  actionId?: string
}

type AdviceWithId = bayes.bob.Advice & {adviceId: string}

const pageStyle: React.CSSProperties = {
  alignItems: 'flex-start',
  backgroundColor: '#fff',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
}
const pageContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  margin: 'auto',
  padding: isMobileVersion ? `0 ${gap}px ${gap}px` : 0,
}
const navBarStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: 'white',
  color: '#000',
  display: 'flex',
  filter: 'drop-shadow(0px 2px 10px rgba(0, 0, 0, 0.05))',
  height: 55,
  justifyContent: 'space-between',
  padding: '10px 25px',
  width: '100%',
  zIndex: 2,
}
const navLinkStyle: React.CSSProperties = {
  color: '#000',
}
const doneDivStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.BOB_BLUE,
  color: 'white',
  display: 'flex',
  fontSize: 15,
  height: 30,
  justifyContent: 'center',
  width: '100%',
  zIndex: 1,
  ...SmoothTransitions,
}
const desktopHeaderStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
}
const pictoStyle: React.CSSProperties = {
  height: 40,
  margin: isMobileVersion ? '25px 15px 10px 0' : '0 15px 0 0',
  width: 40,
}
const completedButtonStyle: React.CSSProperties = {
  border: `1px solid ${colorToAlpha(colors.DARK_TWO, .4)}`,
  borderRadius: 8,
}
const completeFocusButtonStyle: RadiumCSSProperties = {
  ':hover': {
    boxShadow: `0px 0px 0px 2px ${colorToAlpha(colors.DARK_TWO, .4)}`,
  },
}
interface Props {
  baseUrl: string
  project: bayes.bob.Project
}
interface ActionProps {
  action: bayes.bob.Action & {actionId: string}
  gobackUrl?: string
  isChangeDateButtonShown?: boolean
  project: bayes.bob.Project
}

interface HeaderProps extends ActionProps {
  gobackUrl?: string
  isActionDone: boolean
  titleId: string
}
interface ActionTitleProps {
  actionId?: string
  adviceId?: string
  title: string
  id: string
}
interface ActionBasicInfoProps {
  duration?: bayes.bob.ActionDuration
  title: string
}
interface ActionPictoProps {
  action: bayes.bob.Action & {actionId: string}
  style?: React.CSSProperties
}

const ActionPictoBase = ({action, style}: ActionPictoProps) => {
  return <React.Fragment>
    {action.actionId === 'jobflix' ?
      <img src={jobflixImage} alt="" style={pictoStyle} /> :
      action.adviceId ? <AdvicePicto adviceId={action.adviceId} style={style} /> : null}
  </React.Fragment>
}
export const ActionPicto = React.memo(ActionPictoBase)

const ActionHeaderBase = ({action, gobackUrl, isActionDone, project, titleId}: HeaderProps) => {
  const {t} = useTranslation()
  const isTabNavigationUsed = useIsTabNavigationUsed()
  const buttonStyle: RadiumCSSProperties = useMemo((): RadiumCSSProperties => ({
    ...completedButtonStyle,
    ...isTabNavigationUsed && completeFocusButtonStyle,
  }), [isTabNavigationUsed])
  if (!action && gobackUrl) {
    return <Redirect to={gobackUrl} />
  }
  if (isMobileVersion) {
    return <React.Fragment>
      <header role="banner" style={navBarStyle}>
        {gobackUrl ? <Link to={gobackUrl} style={navLinkStyle}>
          <ArrowLeftIcon size={30} role="img" aria-label={t("Retour au plan d'action")} />
        </Link> : <div />}
        <ActionCompleteButton
          action={action} isActionDone={isActionDone} project={project} visualElement="page"
          aria-describedby={titleId} />
      </header>
      <div style={{...doneDivStyle, marginTop: isActionDone ? 0 : -31}} aria-hidden={!isActionDone}>
        {t('Action effectuée')}
      </div>
    </React.Fragment>
  }
  return <div style={desktopHeaderStyle}>
    <ActionPicto action={action} style={pictoStyle} />
    <h1 style={{fontSize: 18, margin: '0 15px 0 0'}} id={titleId}>{action.title}</h1>
    <div style={{flex: 1}} />
    <ActionCompleteButton
      action={action} isActionDone={isActionDone} style={buttonStyle}
      project={project} visualElement="page" aria-describedby={titleId}>
      <span style={{marginRight: 10}}>
        {isActionDone ? t('Complétée') : t('Marquer comme complétée')}
      </span>
    </ActionCompleteButton>
  </div>
}
const ActionHeader = React.memo(ActionHeaderBase)


const ActionTitleBase = ({actionId, adviceId, id, title}: ActionTitleProps): React.ReactElement => {
  return <React.Fragment>
    {actionId === 'jobflix' ?
      <img src={jobflixImage} alt="" style={pictoStyle} /> :
      adviceId ? <AdvicePicto adviceId={adviceId} style={pictoStyle} /> : null}
    <h1 style={h1Style} id={id}>
      {title}
    </h1>
  </React.Fragment>
}
export const ActionTitle = React.memo(ActionTitleBase)

const inlinePStyle: React.CSSProperties = {
  display: 'inline',
  margin: 0,
}

const ActionBasicInfoBase = ({duration, title}: ActionBasicInfoProps): React.ReactElement => {
  const {t, t: translate} = useTranslation()
  const durationText = DURATION_TEXT[duration || 'UNKNOWN_ACTION_DURATION']
  return <div style={blueBoxesOverflowContainerStyle}>
    <div style={blueBoxesContainerStyle}>
      <div style={blueBoxStyle}>
        <img src={twelveThirtyImage} alt="" style={blueBoxIconStyle} />
        <h2 style={h2InlineStyle}>{t('Durée\u00A0:')}</h2>
        {' '}
        <p style={inlinePStyle}>
          {translate(...durationText)}
        </p>
      </div>
      <div style={blueBoxStyle}>
        <img src={directHitImage} alt="" style={blueBoxIconStyle} />
        <h2 style={h2InlineStyle}>{t('Objectif\u00A0:')}</h2>
        {' '}
        <p style={inlinePStyle}>{title}</p>
      </div>
    </div>
  </div>
}
export const ActionBasicInfo = React.memo(ActionBasicInfoBase)

const linkStyle: RadiumCSSProperties = {
  ':focus': {
    textDecoration: 'underline',
  },
  ':hover': {
    textDecoration: 'underline',
  },
  'color': colors.BOB_BLUE,
  'fontWeight': 'bold',
  'textDecoration': 'none',
}

interface LoggedLinkProps extends Partial<Omit<MarkdownLinkProps, 'onClick'|'style'>> {
  action: ActionWithId
  project: bayes.bob.Project
  style?: RadiumCSSProperties
}
const LoggedLink = (props: LoggedLinkProps) => {
  const {
    action,
    href,
    project,
    node: omittedNode,
    style: forcedStyle,
    ...linkProps
  } = props
  const dispatch = useDispatch()
  const onClick = useCallback(() => {
    if (!href) {
      return
    }
    dispatch(exploreAction(project, action, href))
  }, [action, dispatch, href, project])
  // eslint-disable-next-line jsx-a11y/anchor-has-content
  return <SmartLink href={href} onClick={onClick} style={forcedStyle || linkStyle} {...linkProps} />
}

const emojiParagraphPattern = /^(💡|👉) (.*)$/
const emojiParagraphStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colorToAlpha(colors.DARK_TWO, .07),
  borderRadius: 10,
  display: 'flex',
  gap: 10,
  padding: 15,
}

const MardkownParagraph = (props: MarkdownParagraphRendererProps): React.ReactElement => {
  const {children, node, ...otherProps} = props
  const isFirstParagraph = !node?.position?.start?.offset
  const emojiParagraphMatch = children.length && (typeof children[0] === 'string') &&
    children[0].match(emojiParagraphPattern)
  const isEmojiParagraph = !!emojiParagraphMatch
  const style = useMemo((): React.CSSProperties => ({
    margin: isFirstParagraph ? '0 0 1.25em' : '1.25em 0',
    ...isEmojiParagraph && emojiParagraphStyle,
  }), [isEmojiParagraph, isFirstParagraph])
  if (emojiParagraphMatch) {
    return <p {...otherProps} style={style}>
      <Emoji size={25}>{emojiParagraphMatch[1]}</Emoji>
      <span>
        {emojiParagraphMatch[2]}
        {children.slice(1)}
      </span>
    </p>
  }
  return <p {...otherProps} style={style}>{children}</p>
}

const linkInListPattern = /^\* \[([^\]]+)]\(([^)]+)\)$/
const linksListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 15,
  listStyleType: 'none',
  margin: '1.25em 0',
  padding: 0,
}
const linksListItemStyle: RadiumCSSProperties = {
  ':focus': {
    backgroundColor: colors.PALE_GREY,
  },
  ':hover': {
    backgroundColor: colors.PALE_GREY,
  },
  'alignItems': 'center',
  'border': 'solid 1px rgba(0, 0, 0, 0.15)',
  'borderRadius': 10,
  'display': 'flex',
  'fontWeight': 'bold',
  'justifyContent': 'space-between',
  'padding': 18,
}

type MarkdownUnorderedListProps = React.ComponentPropsWithoutRef<'ul'> & ReactMarkdownProps & {
  ordered: boolean
}
type ActionUnorderedListProps = MarkdownUnorderedListProps & {
  action: ActionWithId
  body: string
  project: bayes.bob.Project
}

const MarkdownUnorderedList = (props: ActionUnorderedListProps): React.ReactElement => {
  const {action, body, children, node, ordered: omittedOrdered, project, ...otherProps} = props
  if (node) {
    const listBody = body.slice(node?.position?.start?.offset, node?.position?.end?.offset)
    const linkLines = listBody.split('\n').
      filter(line => !!line.trim()).
      map(line => line.trim().match(linkInListPattern))
    const linkLinesMatched = linkLines.filter((line): line is RegExpMatchArray => !!line)
    if (linkLines.length && linkLinesMatched.length === linkLines.length) {
      // We have a list of links.
      return <ul style={linksListStyle}>
        {linkLinesMatched.map(([unusedLine, name, href], index) => <li key={index}>
          <LoggedLink
            href={href} action={action} project={project} style={linksListItemStyle}>
            {name}
            <OpenNewIcon aria-hidden={true} focusable={false} size={18} style={{opacity: .4}} />
          </LoggedLink>
        </li>)}
      </ul>
    }
  }
  return <ul {...otherProps}>
    {children}
  </ul>
}

const navButtonStyle = _memoize((isVisible = true): React.CSSProperties => ({
  ...SmoothTransitions,
  ...!isVisible && {transform: 'translateY(100%)'},
  alignSelf: 'flex-start',
}))

const ActionBase = (
  {action, gobackUrl, project}: ActionProps): React.ReactElement => {
  const {t, t: translate} = useTranslation()
  const {acceptedFromStrategyId, actionId, adviceId, duration, resourceUrl,
    shortDescription = '', title = ''} = action
  const dispatch = useDispatch()
  useEffect(() => {
    dispatch(actionIsShown(project, action))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, actionId, project.projectId])
  const isActionDone = action.status === 'ACTION_DONE'
  const {title: stratTitle} = project?.strategies?.
    find(({strategyId}) => acceptedFromStrategyId === strategyId) || {}

  const advice = adviceId && project?.advices?.
    find((advice): advice is AdviceWithId => advice.adviceId === adviceId) ||
    undefined
  const {daysToCompletion, name: deadlineName} = decideSection(action)
  const hasSetCompletionDate = typeof daysToCompletion === 'number'

  const [isBottomButtonVisible, setIsBottomButtonVisible] = useState(hasSetCompletionDate)

  const onScroll = useCallback((): void => {
    const scrollPosition = window.scrollY ||
      window.pageYOffset ||
      document.body.scrollTop + (document.documentElement.scrollTop || 0)

    if (hasSetCompletionDate) {
      return
    }

    // TODO(émilie): Find a better way to check visibility of top button (VisibilitySensor).
    if (scrollPosition <= 10) {
      setIsBottomButtonVisible(false)
    } else if (scrollPosition > 100) {
      setIsBottomButtonVisible(true)
    }
  }, [hasSetCompletionDate, setIsBottomButtonVisible])

  useEffect((): (() => void) => {
    document.addEventListener('scroll', onScroll)
    return (): void => document.removeEventListener('scroll', onScroll)
  }, [onScroll])

  const resourceContent = getActionResourceContent(actionId, t)
  const mardownComponents = useMemo(() => ({
    a: React.memo(({children, ...props}: MarkdownLinkProps) =>
      <LoggedLink {...props} {...{action, project}}>{children}</LoggedLink>),
    p: React.memo(MardkownParagraph),
    ul: React.memo((props: MarkdownUnorderedListProps) => <MarkdownUnorderedList
      {...props} body={resourceContent || ''} {...{action, project}} />),
  }), [action, project, resourceContent])
  const hasResource = advice || resourceUrl || resourceContent

  const titleId = useMemo(_uniqueId, [])

  return <React.Fragment>
    <ActionHeader {...{action, gobackUrl, isActionDone, project, titleId}} />
    <div style={pageContainerStyle}>
      {isActionDone ? null : hasSetCompletionDate ? <div style={completionDateContainerStyle}>
        {/* TODO(pascal): Check with John on a way to edit this once set. */}
        <svg width="15" height="15" viewBox="0 0 15 15" style={noFlexShrink}>
          <path d="M 0 0 h 15 v 15 C 15 7.5 7.5 0 0 0" fill="#000" />
        </svg>
        <div style={completionDateStyle}>{translate(...deadlineName)}</div>
        <svg width="15" height="15" viewBox="0 0 15 15" style={noFlexShrink}>
          <path d="M 15 0 H 0 v 15 C 0 7.5 7.5 0 15 0" fill="#000" />
        </svg>
      </div> : <div style={contentStyle}>
        <DeadlineButton
          action={action} visualElement="page" style={deadlineButtonStyle}
          aria-describedby={titleId} />
      </div>}
      {isMobileVersion ? <ActionTitle {...{actionId, adviceId, title}} id={titleId} /> : null}
      {stratTitle ? <ActionBasicInfo duration={duration} title={stratTitle} /> : null}
      <h2 style={h2Style}>{t('Pourquoi cette tâche peut vous être utile\u00A0?')}</h2>
      <p style={contentStyle}>{shortDescription}</p>
      {hasResource ? <h2 style={h2Style}>{
        t('Voilà quelques informations pour vous lancer')
      }</h2> : null}
      {advice ? <div style={{width: '100%'}}>
        <ExpandedAdviceCardContent project={project} advice={advice} />
      </div> :
        resourceContent ? <div style={resourceContentStyle}>
          <Markdown components={mardownComponents} content={resourceContent} />
        </div> : resourceUrl ? <LoggedLink action={action} project={project} href={resourceUrl}>
          {[resourceUrl]}
        </LoggedLink> : null}
      {isMobileVersion ? hasSetCompletionDate || (!isActionDone) ?
        <FixedButtonNavigation
          isChildrenButton={true} style={navButtonStyle(isBottomButtonVisible)}>
          <DeadlineButton
            action={action} visualElement="page" style={bottomDeadlineButtonStyle}
            aria-describedby={titleId} />
        </FixedButtonNavigation> : null : hasSetCompletionDate ? <DeadlineButton
        action={action} visualElement="page" style={bottomDeadlineButtonStyle}
        aria-describedby={titleId} /> : null}
    </div>
  </React.Fragment>
}
export const Action = React.memo(ActionBase)


const ActionPlanActionPage = ({baseUrl, project}: Props) => {
  const {actionId} = useParams<ActionParamsConfig>()
  const action = project.actions?.
    find((action): action is ActionWithId => actionId === action.actionId)
  if (!action) {
    return <Redirect to={baseUrl} />
  }
  const projectId = project.projectId || ''
  const gobackUrl = generatePath(Routes.ACTION_PLAN_PLAN_PAGE, {projectId})
  return <div style={pageStyle}>
    <Action {...{action, gobackUrl, project}} />
  </div>
}

export default React.memo(ActionPlanActionPage)
