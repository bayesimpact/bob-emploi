import type H from 'history'
import _shuffle from 'lodash/shuffle'
import _uniqueId from 'lodash/uniqueId'
import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {generatePath, useLocation, useParams} from 'react-router'
import {Redirect, useHistory} from 'react-router-dom'

import useFastForward from 'hooks/fast_forward'
import {DURATION_TEXT} from 'store/action_plan'
import type {ActionWithId} from 'store/actions'
import {previewAction, selectAction, unselectAction, useDispatch, validateActionPlan,
  validateActionPlanStrategy} from 'store/actions'
import isMobileVersion from 'store/mobile'
import {useHasTwoColumnsActionsStratPage} from 'store/user'

import {AdvicePicto} from 'components/advisor'
import Button from 'components/button'
import {colorToAlpha} from 'components/colors'
import Emoji from 'components/emoji'
import Trans from 'components/i18n_trans'
import LinkButton from 'components/link_button'
import Markdown from 'components/markdown'
import {Modal, useModal} from 'components/modal'
import {FixedButtonNavigation} from 'components/navigation'
import {BubbleToRead, Discussion} from 'components/phylactery'
import {SmartLink} from 'components/radium'
import Toggle from 'components/toggle'
import {Routes} from 'components/url'
import bobHeadImage from 'images/bob-head.svg'
import blackStarImage from 'images/star-black.svg'
import jobflixImage from 'images/advices/jobflix.svg'

import Page, {contentWidth, discussionStyle, navButtonStyle} from './base'
import {ActionPreview} from './preview'

const actionContainerStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 13,
  boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.09), 0px 1px 3px rgba(0, 0, 0, 0.13)',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 154,
  padding: 20,
}
const actionLineStyle: React.CSSProperties = {
  alignItems: 'flex-start',
  color: 'inherit',
  display: 'flex',
  fontSize: 18,
}
const recommendedForYouStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  backgroundColor: colorToAlpha(colors.CREAM_CAN, .5),
  borderRadius: 5,
  display: 'inline-block',
  fontSize: 14,
  fontWeight: 'bold',
  margin: '10px 0 0',
  padding: '7px 6px',
}
const recommendedStarStyle: React.CSSProperties = {
  height: 12,
}
const toggleStyle: React.CSSProperties = {
  boxSizing: 'content-box',
  cursor: 'pointer',
  flex: 'none',
  margin: '-10px -10px -10px 10px',
  padding: 10,
}
const tagsStyle: React.CSSProperties = {
  alignItems: 'flex-end',
  color: colors.GREY,
  display: 'flex',
  fontSize: 14,
}
const seeMoreStyle: RadiumCSSProperties = {
  ':hover': {
    textDecoration: 'underline',
  },
  'color': colors.BOB_BLUE,
  'display': 'inline-block',
  'fontSize': 14,
  'fontWeight': 'bold',
  'margin': '-16px -16px -16px -10px',
  'padding': 16,
  'textDecoration': 'none',
}
const pictoStyle: React.CSSProperties = {
  height: 35,
}

type StrategyLocationState = {isAlreadyRead?: boolean}
type ActionLocationState = {
  strategyId: string
  strategyUrl?: string
}
interface ActionProps {
  action: ActionWithId
  onPreview: (action: bayes.bob.Action) => void
  onToggle: (action: ActionWithId, isSelecting: boolean) => void
  projectId?: string
  strategyId: string
}
const ActionBase = (props: ActionProps): React.ReactElement => {
  const {action, onPreview, onToggle, projectId = '', strategyId} = props
  const {actionId, adviceId, duration, status, tags, title} = action
  const {t, t: translate} = useTranslation()
  const isSelected = status === 'ACTION_CURRENT'
  const dispatch = useDispatch()
  const handleToggle = useCallback((): void => {
    onToggle(action, !isSelected)
  }, [action, isSelected, onToggle])
  const handleLinkClick = useCallback((event: React.MouseEvent) => {
    dispatch(previewAction(action))
    if (isMobileVersion) {
      return
    }
    event.preventDefault()
    onPreview(action)
  }, [action, dispatch, onPreview])
  const strategyBaseUrl = generatePath(Routes.ACTION_PLAN_STRAT_PATH, {
    projectId,
    strategyId,
  })

  const location = useMemo((): H.LocationDescriptor<ActionLocationState> => ({
    pathname: generatePath(Routes.ACTION_PLAN_ACTION_PREVIEW_PATH, {
      actionId,
      projectId,
    }),
    state: {strategyId: strategyId, strategyUrl: strategyBaseUrl},
  }), [actionId, projectId, strategyBaseUrl, strategyId])

  const isRecommended = actionId === 'jobflix'

  const tagsContent = [
    ...duration ? [translate(...DURATION_TEXT[duration])] : [],
    ...tags || [],
  ].join(' · ') + ' · '

  const titleId = useMemo(_uniqueId, [])

  return <li style={actionContainerStyle}>
    <div style={actionLineStyle}>
      <h3 style={{flex: 1, fontWeight: 'bold', margin: 0}} id={titleId}>{title}</h3>
      <Toggle
        size={50} style={toggleStyle} onClick={handleToggle} isSelected={isSelected}
        aria-describedby={titleId} aria-label={t('Sélectionner cette action')} />
    </div>
    {isRecommended ? <p style={recommendedForYouStyle}>
      <img style={recommendedStarStyle} src={blackStarImage} alt="" /> {t('Recommandé pour vous')}
    </p> : null}
    <div style={{flex: 1}} />
    <div style={tagsStyle}>
      {tagsContent}
      <SmartLink
        to={isMobileVersion ? location : undefined} style={seeMoreStyle} onClick={handleLinkClick}
        aria-describedby={titleId}>
        {t('Voir le détail')}
      </SmartLink>
      <span style={{flex: 1}} />
      {actionId === 'jobflix' ?
        <img src={jobflixImage} alt="" style={pictoStyle} /> :
        adviceId ? <AdvicePicto adviceId={adviceId} style={pictoStyle} /> : null}
    </div>
  </li>
}
const Action = React.memo(ActionBase)

const previewModalStyle: React.CSSProperties = {
  maxWidth: 600,
  padding: '30px 50px',
}

interface ActionsListProps {
  actions: readonly ActionWithId[]
  onToggleAction: (action: ActionWithId, isSelecting: boolean) => void
  projectId?: string
  strategyId: string|undefined
  stratTitle?: string
}
const listColumnsStyle: React.CSSProperties = {
  display: 'grid',
  gridGap: 30,
  gridTemplateColumns: '1fr 1fr',
  padding: 0,
}
const listStyle: React.CSSProperties = {
  ...listColumnsStyle,
  gridTemplateColumns: '1fr',
}

const ActionsListBase = (props: ActionsListProps): React.ReactElement|null => {
  const {actions, onToggleAction, projectId, strategyId, stratTitle} = props
  const [previewAction, setPreviewAction] = useState<bayes.bob.Action|undefined>()
  const dropPreviewAction = useCallback(() => setPreviewAction(undefined), [])
  const titleId = useMemo(_uniqueId, [])
  const hasTwoColumnsActionsStratPage = useHasTwoColumnsActionsStratPage()
  if (!actions.length || !strategyId) {
    // TODO(pascal): Handle the UX for this case.
    return null
  }
  return <ol
    style={hasTwoColumnsActionsStratPage && !isMobileVersion ? listColumnsStyle : listStyle}>
    <Modal
      isShown={!!previewAction} onClose={dropPreviewAction}
      aria-labelledby={previewAction ? titleId : undefined}>
      {previewAction ? <ActionPreview
        action={previewAction} stratTitle={stratTitle} style={previewModalStyle}
        titleId={titleId} /> : null}
    </Modal>
    {actions.map((action): React.ReactNode =>
      <Action key={action.actionId} projectId={projectId} action={action}
        strategyId={strategyId} onPreview={setPreviewAction} onToggle={onToggleAction} />)}
  </ol>
}
const ActionsList = React.memo(ActionsListBase)

const headerStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  fontSize: 14,
  fontWeight: 'bold',
  margin: '20px 0 0',
  textTransform: 'uppercase',
}
const modalHeaderStyle: React.CSSProperties = {
  ...headerStyle,
  margin: 0,
}
const titleStyle: React.CSSProperties = {
  alignSelf: 'baseline',
  fontSize: 33,
  margin: '5px 0 15px',
}
const modalTitleStyle: React.CSSProperties = {
  alignSelf: 'baseline',
  fontSize: 24,
  margin: '5px 0 15px',
}
const subtitleStyle: React.CSSProperties = {
  color: colors.GREYISH_BROWN,
  fontSize: 18,
  fontStyle: 'italic',
}
const actionsContainerStyle: React.CSSProperties = {
  width: '100%',
}

const headerContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  width: '100%',
}
const buttonContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: 30,
  width: '100%',
}
const modalStyle: React.CSSProperties = {
  maxWidth: 420,
  padding: 25,
  width: 'calc(100vw - 40px)',
}
const twoColumnsPageStyle: React.CSSProperties = {
  backgroundColor: colors.PALE_GREY,
}
const twoColumnsPageContentStyle: React.CSSProperties = {
  maxWidth: 935,
  paddingBottom: 240,
}
const infoContainerStyle: React.CSSProperties = {
  alignItems: 'center',
  border: `2px solid ${colorToAlpha('#000', 0.1)}`,
  borderRadius: 10,
  display: 'flex',
  margin: '15px 0',
  padding: 15,
}
const infoMessageStyle: React.CSSProperties = {
  fontStyle: 'italic',
  margin: 0,
}
const bobImageStyle: React.CSSProperties = {
  alignSelf: 'center',
  width: 45,
}
const ActionPlanStrategyPage = ({project}: {project: bayes.bob.Project}): React.ReactElement => {
  const {strategyId = ''} = useParams<{strategyId?: string}>()
  const {t} = useTranslation()
  const dispatch = useDispatch()
  const {projectId = '', strategies = []} = project
  const strategyIndex =
    strategies.findIndex(({strategyId: sId}): boolean => strategyId === sId)
  const strategyNumber = strategyIndex + 1
  const nextStrategyId = strategies[strategyIndex + 1]?.strategyId
  const previousStrategyId = strategies[strategyIndex - 1]?.strategyId
  const hasTwoColumnsActionsStratPage = useHasTwoColumnsActionsStratPage()
  const [isBobAdviceShown, showModal, closeModal] = useModal(true)

  const pageStyle = hasTwoColumnsActionsStratPage ? twoColumnsPageStyle : undefined
  const pageContentStyle = hasTwoColumnsActionsStratPage && !isMobileVersion ?
    twoColumnsPageContentStyle : undefined

  const backUrl = previousStrategyId && generatePath(Routes.ACTION_PLAN_STRAT_PATH, {
    projectId,
    strategyId: previousStrategyId,
  })
  const nextPageButtonText = nextStrategyId ? t('Consulter la prochaine stratégie') : t('Terminer')

  const {descriptionSpeech = '', header = '', title = '', infinitiveTitle = title} =
    strategies[strategyIndex] || {} as bayes.bob.Strategy

  const [readStrategyId, setReadStrategyId] = useState('')
  // Once the strategy is read, show the full page.
  const isPageFullyShown = readStrategyId === strategyId || hasTwoColumnsActionsStratPage
  const handleHeaderRead = useCallback(() => setReadStrategyId(strategyId), [strategyId])

  const actions = useMemo(() => {
    const strategyActionIds = new Set(
      project.strategies?.find(({strategyId: sId}) => sId === strategyId)?.actionIds || [])
    return project.actions?.filter((action): action is ActionWithId =>
      !!action.actionId && strategyActionIds.has(action.actionId) &&
      (!action.acceptedFromStrategyId || action.acceptedFromStrategyId === strategyId)) || []
  }, [project, strategyId])

  const handleToggleAction = useCallback((action: ActionWithId, isSelecting: boolean) => {
    if (isSelecting) {
      dispatch(selectAction(project, action, strategyId))
      return
    }
    dispatch(unselectAction(project, action))
  }, [dispatch, project, strategyId])

  const handleCloseBobAdvice = useCallback((): void => {
    closeModal()
  }, [closeModal])
  const handleOpenBobAdvice = useCallback((): void => {
    showModal()
  }, [showModal])

  const nextUrl = useMemo(
    () => isPageFullyShown ? nextStrategyId ? {
      pathname: generatePath(Routes.ACTION_PLAN_STRAT_PATH, {
        projectId,
        strategyId: nextStrategyId,
      }),
      state: {isAlreadyRead: false},
    } : generatePath(Routes.ACTION_PLAN_RECAP_PAGE, {projectId}) : undefined,
    [isPageFullyShown, projectId, nextStrategyId],
  )

  const {pathname, state: {isAlreadyRead = false} = {}} = useLocation<StrategyLocationState>()
  useLayoutEffect(
    (): void => setReadStrategyId(isAlreadyRead ? strategyId : ''),
    [isAlreadyRead, strategyId],
  )
  const history = useHistory()
  const actionsContainerRef = useRef<HTMLDivElement>(null)
  useEffect((): void => {
    if (!strategyId) {
      return
    }
    if (!isAlreadyRead && readStrategyId === strategyId) {
      history.replace({pathname, state: {isAlreadyRead: true}})
      if (actionsContainerRef.current) {
        window.scroll({behavior: 'smooth', top: actionsContainerRef.current.offsetTop})
      }
    }
  }, [history, isAlreadyRead, pathname, strategyId, readStrategyId])

  const validateStrategy = useCallback(() => {
    dispatch(validateActionPlanStrategy(project, strategies[strategyIndex]))
    if (strategyIndex === strategies.length - 1) {
      dispatch(validateActionPlan(project))
    }
  }, [dispatch, project, strategies, strategyIndex])

  useEffect(() => showModal, [showModal, strategyId, strategyIndex])

  useFastForward(() => {
    // Display the whole Bob talk.
    if (readStrategyId !== strategyId) {
      setReadStrategyId(strategyId)
      return
    }

    // Randomly select one or two actions.
    const hasAnySelectedAction = actions.some(({status}) => status === 'ACTION_CURRENT')
    if (!hasAnySelectedAction) {
      for (const action of _shuffle(actions).slice(0, Math.random() > .5 ? 1 : 2)) {
        handleToggleAction(action, true)
      }
      return
    }

    // Validate the strategy and switch to the next page.
    if (nextUrl) {
      validateStrategy()
      if (typeof nextUrl === 'string') {
        history.push(nextUrl)
      } else {
        const {pathname, state} = nextUrl
        history.push(pathname, state)
      }
    }
  }, [actions, handleToggleAction, history, nextUrl, readStrategyId, strategyId, validateStrategy])

  if (!strategyId) {
    // TODO(cyrille): Keep state in redirect.
    return <Redirect to={generatePath(Routes.ACTION_PLAN_STRAT_PATH, {
      projectId,
      strategyId: strategies[0].strategyId,
    })} />
  }
  const strategyCountText = t(
    'Stratégie {{strategyNumber}}/{{strategyCount}}\u00A0:',
    {strategyCount: strategies.length, strategyNumber},
  )
  const discussionContent = <Discussion
    style={discussionStyle} isOneBubble={true} key={strategyId}
    onDone={hasTwoColumnsActionsStratPage ? undefined : handleHeaderRead}
    isFastForwarded={readStrategyId === strategyId}>
    {(descriptionSpeech || header).split('\n\n').map((sentence, index) => <BubbleToRead
      key={`${strategyId}-${index}`}
      readingTimeMillisec={hasTwoColumnsActionsStratPage ? 1 : undefined}>
      <Markdown content={sentence} isSingleLine={true} />
    </BubbleToRead>)}
  </Discussion>
  return <Page
    page="strategy" title={infinitiveTitle} onBackClick={backUrl} isLogoShown={false}
    pageStyle={pageStyle} style={pageContentStyle}>
    <div style={headerContainerStyle}>
      <div><p style={headerStyle}>{strategyCountText}</p>
        <h1 style={titleStyle}>{infinitiveTitle}</h1></div>
      {hasTwoColumnsActionsStratPage ? <SmartLink onClick={handleOpenBobAdvice}><img
        src={bobHeadImage} style={bobImageStyle}
        alt={t("Revoir l'explication de {{productName}}", {productName: config.productName})} />
      </SmartLink> : null}
    </div>
    {hasTwoColumnsActionsStratPage ? <Modal
      isShown={isBobAdviceShown} aria-labelledby={infinitiveTitle} style={modalStyle}>
      <div><p style={modalHeaderStyle}>{strategyCountText}</p>
        <h2 style={modalTitleStyle}>{infinitiveTitle}</h2></div>
      {discussionContent}
      <Button onClick={handleCloseBobAdvice} isRound={true} style={{width: '100%'}}>
        {t('Explorer les actions')}</Button>
    </Modal> : discussionContent}
    {isPageFullyShown ? <React.Fragment>
      <div style={actionsContainerStyle} ref={actionsContainerRef}>
        {hasTwoColumnsActionsStratPage ? <div style={infoContainerStyle}>
          <Emoji size={21} aria-hidden={true} style={{fontStyle: 'normal', margin: '0 10px 0 0'}}>
            💡</Emoji>
          <Trans style={infoMessageStyle} parent="p">Sélectionnez toutes les <strong>actions
            utiles pour vous</strong>, vous déciderez ensuite du bon moment pour les réaliser.
          </Trans>
        </div> : <React.Fragment>
          <h2 style={titleStyle}>
            {t('Sélectionnez toutes les actions utiles pour vous')}
          </h2>
          <p style={subtitleStyle}>
            {t('Vous déciderez ensuite du bon moment pour les réaliser.')}
          </p>
        </React.Fragment>}
        <ActionsList
          actions={actions} projectId={project.projectId} strategyId={strategyId}
          stratTitle={infinitiveTitle} onToggleAction={handleToggleAction} />
      </div>
      {hasTwoColumnsActionsStratPage && nextUrl && !isMobileVersion ?
        <div style={buttonContainerStyle}>
          <LinkButton
            to={typeof nextUrl === 'string' ? nextUrl : nextUrl.pathname} type="navigation"
            isRound={true} style={navButtonStyle(true)} tabIndex={0}
            onClick={nextUrl ? validateStrategy : undefined} aria-label={nextPageButtonText}>
            {nextPageButtonText}
          </LinkButton>
        </div> : <FixedButtonNavigation
          to={nextUrl} onClick={nextUrl ? validateStrategy : undefined}
          isShownOnlyWhenScrolledToBottom={true} disabled={!nextUrl}
          style={navButtonStyle()} width={contentWidth}>
          {nextPageButtonText}
        </FixedButtonNavigation>}
    </React.Fragment> : null}
  </Page>
}


export default React.memo(ActionPlanStrategyPage)
