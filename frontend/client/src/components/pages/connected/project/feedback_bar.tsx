import {LocationState} from 'history'
import {TOptions} from 'i18next'
import _fromPairs from 'lodash/fromPairs'
import _mapValues from 'lodash/mapValues'
import _max from 'lodash/max'
import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'
import {RouteComponentProps, useLocation} from 'react-router'
import {Redirect, Route, Switch, useHistory} from 'react-router-dom'

import {DispatchAllActions, RootState, sendProjectFeedback} from 'store/actions'
import {getAdviceShortTitle, isValidAdvice} from 'store/advice'
import {LocalizableString, prepareT} from 'store/i18n'

import starIcon from 'images/star.svg'
import whiteStarIcon from 'images/star-white.svg'
import starOutlineIcon from 'images/star-outline.svg'
import greyStarOutlineIcon from 'images/star-outline.svg?stroke=%239596a0'
import Button from 'components/button'
import CheckboxList from 'components/checkbox_list'
import Trans from 'components/i18n_trans'
import isMobileVersion from 'store/mobile'
import {Modal, useModal} from 'components/modal'
import {ShareModal} from 'components/share'
import Textarea from 'components/textarea'
import {SmoothTransitions} from 'components/theme'
import {FEEDBACK_TAB} from 'components/url'

const feedbackTitle = {
  1: prepareT('Vraiment inutile'),
  2: prepareT('Peu intéressant'),
  3: prepareT('Intéressant'),
  4: prepareT('Pertinent'),
  5: prepareT('Très pertinent'),
} as const


// Add a delay after a given date.
const addDuration = (time: string, delayMillisec: number): Date | undefined => {
  if (!time) {
    return undefined
  }
  return new Date(new Date(time).getTime() + delayMillisec)
}


// Get the date and time at which to show the request feedback.
const getRequestFeedbackShowDate = (
  {user: {featuresEnabled: {stratTwo} = {}}}: RootState,
  {advices, diagnosticShownAt, feedback, openedStrategies = [], strategies}: bayes.bob.Project,
): Date | undefined => {
  // Feedback already given.
  if (feedback && feedback.score) {
    return undefined
  }

  // User is in pre-strat UX.
  // TODO(pascal): Fix now that all users have strategies.
  if (stratTwo !== 'ACTIVE' || !strategies || !strategies.length) {
    // The user started interacting with the pre-strat content.
    if (advices && advices.some(({status}): boolean => status === 'ADVICE_READ')) {
      return new Date()
    }

    // Wait for 13s in diagnostic even if they do not open an advice page.
    return diagnosticShownAt ? addDuration(diagnosticShownAt, 13_000) : undefined
  }

  // User has started a strategy: wait for 20s.
  const lastStratStarted = _max(openedStrategies.map(({startedAt}): string|undefined => startedAt))
  if (lastStratStarted) {
    return addDuration(lastStratStarted, 20_000)
  }

  // User has seen the diagnostic but has not started a strategy: wait 60s.
  return diagnosticShownAt ? addDuration(diagnosticShownAt, 60_000) : undefined
}


interface FormProps {
  onSubmit?: (score: number) => void
  project: bayes.bob.Project
  score?: number
}


interface BarProps {
  children?: never
  evaluationUrl: string
  isShown: boolean
  onSubmit?: (score: number) => void
  project: bayes.bob.Project
}


const FeedbackBarBase = (props: BarProps): React.ReactElement|null => {
  const {isShown, evaluationUrl, project: {feedback}} = props
  const [isModalShown, showModal, hideModal] = useModal()
  const [score, setScore] = useState(0)
  const form = useRef<FormRef>(null)

  const openModal = useCallback((score: number): void => {
    form.current?.setScore(score)
    setScore(score)
    showModal()
  }, [showModal])

  const handleCancel = useCallback((): void => {
    hideModal()
    setScore(0)
  }, [hideModal])

  if (feedback && feedback.score) {
    return null
  }

  const hideBelowStyle: React.CSSProperties = {
    transform: isShown ? 'initial' : 'translateY(calc(100% + 10px))',
    ...SmoothTransitions,
  }
  const fixedBottomStyle: React.CSSProperties = {
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
    position: 'fixed',
    right: 0,
    zIndex: 1,
    ...hideBelowStyle,
  }
  const containerStyle: React.CSSProperties = {
    // TODO(cyrille): Change colors for background, text and stars for a better contrast.
    backgroundColor: colors.GREENISH_TEAL,
    borderRadius: 5,
    boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
    color: '#fff',
    margin: '0 auto 10px',
    padding: '10px 10px 5px',
    pointerEvents: 'initial',
    position: 'relative',
    width: 310,
    ...isMobileVersion ? hideBelowStyle : {},
  }

  const modal = ((): React.ReactNode => {
    if (isMobileVersion) {
      if (isModalShown) {
        return <Redirect to={`${evaluationUrl}/${score}`} push={true} />
      }
      return null
    }
    return <Modal
      isShown={isModalShown} style={{margin: '0 10px'}}
      onClose={handleCancel}>
      <FeedbackForm {...props} ref={form} score={score} />
    </Modal>
  })()

  return <React.Fragment>
    {modal}
    <div style={isMobileVersion ? {overflow: 'hidden'} : fixedBottomStyle}>
      <aside style={containerStyle}>
        <FeedbackStars score={score} onStarClick={openModal} isWhite={true} />
      </aside>
    </div>
    {isMobileVersion ? null : <div style={{height: 80}} />}
  </React.Fragment>
}
FeedbackBarBase.propTypes = {
  evaluationUrl: PropTypes.string.isRequired,
  isShown: PropTypes.bool.isRequired,
  project: PropTypes.object.isRequired,
}
const FeedbackBar = React.memo(FeedbackBarBase)


interface PageWithFeedbackProps
  extends Omit<BarProps, 'children' | 'evaluationUrl' | 'onSubmit' | 'isShown'> {
  baseUrl: string
  children: React.ReactNode
}


type PageRouteProps = RouteComponentProps<{score?: string}>


const PageWithFeedbackBase = (props: PageWithFeedbackProps): React.ReactElement => {
  const {baseUrl, children, project, project: {feedback: {score = 0} = {}}, ...barProps} = props
  const dispatch = useDispatch<DispatchAllActions>()
  const {t} = useTranslation()
  const showAfter = useSelector(
    (state: RootState): Date | undefined => getRequestFeedbackShowDate(state, project),
  )
  const [isShareBobShown, showShareBob, hideShareBob] = useModal()
  const [isShown, setIsShown] = useState(!!showAfter && showAfter < new Date())

  useEffect((): (() => void) => {
    if (!showAfter) {
      return (): void => void 0
    }
    const showInMillisec = showAfter.getTime() - Date.now()
    const timeout = window.setTimeout((): void => setIsShown(true), showInMillisec)
    return (): void => window.clearTimeout(timeout)
  }, [showAfter])

  const handleReturnFromFeedback = useCallback((newScore: number): void => {
    if (newScore >= 4) {
      showShareBob()
    }
  }, [showShareBob])

  const {state: {returningFromFeedbackPage = false} = {}} =
    useLocation<{returningFromFeedbackPage: boolean}>()
  useEffect((): void => {
    if (returningFromFeedbackPage) {
      handleReturnFromFeedback(score)
    }
  }, [handleReturnFromFeedback, returningFromFeedbackPage, score])

  const renderPage = useCallback(({match: {params: {score}}}: PageRouteProps): React.ReactNode => {
    return <FeedbackPage
      {...barProps} score={score ? Number.parseInt(score, 10) : undefined} project={project}
      backTo={{pathname: baseUrl, state: {returningFromFeedbackPage: true}}} />
  }, [baseUrl, barProps, project])

  const evaluationUrl = `${baseUrl}/${FEEDBACK_TAB}`
  return <Switch>
    <Route path={`${evaluationUrl}/:score?`} render={renderPage} />
    <React.Fragment>
      {children}
      <FeedbackBar
        {...barProps} evaluationUrl={evaluationUrl}
        onSubmit={handleReturnFromFeedback} isShown={isShown} project={project} />
      <ShareModal
        onClose={hideShareBob} isShown={isShareBobShown}
        title={t('Vous aussi, aidez vos amis')}
        campaign="fs" visualElement="feedback" dispatch={dispatch}
        intro={<Trans parent={null}>
          <strong>Envoyez-leur directement ce lien <br /></strong>
          et on s'occupe du reste&nbsp;!
        </Trans>} />
    </React.Fragment>
  </Switch>
}
PageWithFeedbackBase.propTypes = {
  baseUrl: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  project: PropTypes.object.isRequired,
}
const PageWithFeedback = React.memo(PageWithFeedbackBase)


interface PageProps extends FormProps {
  backTo: string | {pathname: string; state: LocationState}
}


const FeedbackPageBase = (props: PageProps): React.ReactElement => {
  const {backTo, ...formProps} = props
  const history = useHistory()

  const handleSubmit = useCallback((): void => {
    if (typeof backTo === 'string') {
      history.push(backTo)
    } else {
      history.push(backTo.pathname, backTo.state)
    }
  }, [backTo, history])
  return <FeedbackForm {...formProps} onSubmit={handleSubmit} />
}
const FeedbackPage = React.memo(FeedbackPageBase)


interface SelectOption {
  name: string
  value: string
}


interface FormRef {
  setScore: (score: number) => void
}


const FeedbackFormBase = (props: FormProps, ref: React.Ref<FormRef>): React.ReactElement => {
  const {onSubmit, project, project: {advices}} = props
  const dispatch = useDispatch<DispatchAllActions>()
  const {t} = useTranslation()
  const gender = useSelector(
    ({user}: RootState): bayes.bob.Gender|undefined => user.profile?.gender,
  )
  const [score, setScore] = useState(props.score || 0)
  const [selectedAdvices, setSelectedAdvices] = useState<readonly string[]>([])
  const [text, setText] = useState('')

  useImperativeHandle(ref, () => ({setScore}))

  const saveFeedback = useCallback((): void => {
    const usefulAdviceModules: {[adviceId: string]: boolean} = {}
    for (const adviceId of selectedAdvices) {
      usefulAdviceModules[adviceId] = true
    }
    dispatch(sendProjectFeedback(project, {score, text, usefulAdviceModules}, t))
    onSubmit?.(score)
  }, [dispatch, onSubmit, project, score, selectedAdvices, t, text])

  const isGoodFeedback = score > 2
  const shownAdvices = (advices || []).filter(({status}): boolean => status === 'ADVICE_READ')
  const containerStyle: React.CSSProperties = {
    padding: isMobileVersion ? 20 : 50,
  }
  const contentStyle: React.CSSProperties = {
    fontSize: 15,
    padding: '35px 0',
    position: 'relative',
    width: isMobileVersion ? 'initial' : 600,
  }
  const tOptions = useMemo((): TOptions => ({context: gender}), [gender])
  return <div style={containerStyle}>
    <div style={{borderBottom: `solid 2px ${colors.SILVER}`, paddingBottom: 35}}>
      <FeedbackStars score={score} onStarClick={setScore} size={30} />
    </div>
    <div style={contentStyle}>
      <div style={{fontSize: 18, fontWeight: 'bold', marginBottom: 20}}>
        {isGoodFeedback ? <Trans parent="span" tOptions={tOptions}>
          Qu'est-ce qui vous a le plus aidé·e dans {{productName: config.productName}}&nbsp;?
        </Trans> : <Trans parent="span">
          Pouvez-vous nous dire ce qui n'a pas fonctionné pour vous&nbsp;?
        </Trans>}
      </div>
      <Textarea
        style={{height: 180, padding: 10, width: '100%'}}
        placeholder={t('Écrivez votre commentaire ici')}
        value={text} onChange={setText} />
      {isGoodFeedback && shownAdvices.length ? <div>
        <Trans style={{fontSize: 18, fontWeight: 'bold', marginBottom: 20}} tOptions={tOptions}>
          Y a-t-il des conseils qui vous ont particulièrement intéressé·e&nbsp;?
        </Trans>
        <CheckboxList
          onChange={setSelectedAdvices} values={selectedAdvices}
          options={(shownAdvices).
            filter(isValidAdvice).
            filter((a): boolean => !!(a.numStars && a.numStars > 1)).
            map((advice): SelectOption => ({
              name: getAdviceShortTitle(advice, t),
              value: advice.adviceId,
            })).
            filter(({name}): boolean => !!name)} />
      </div> : null}
    </div>
    <div style={{textAlign: 'center'}}>
      <Button onClick={saveFeedback} isRound={true}>{t('Envoyer')}</Button>
    </div>
  </div>
}
const FeedbackForm = React.forwardRef(FeedbackFormBase)


type NumStars = 1|2|3|4|5
export type NumStarsString = '1'|'2'|'3'|'4'|'5'


interface StarProps extends
  Omit<React.ComponentPropsWithoutRef<'img'>, 'onClick'|'onMouseEnter'|'onMouseLeave'> {
  alt: string
  numStars: NumStars
  onClick: (numStars: NumStars) => void
  onMouseEnter: (numStars: NumStars) => void
  onMouseLeave?: (numStars: NumStars) => void
}


const starButtonStyle: React.CSSProperties = {
  padding: 5,
}


const FeedbackStarBase = (props: StarProps): React.ReactElement => {
  const {alt, numStars, onClick, onMouseEnter, onMouseLeave, ...imgProps} = props
  const enter = useCallback(() => onMouseEnter(numStars), [numStars, onMouseEnter])
  const leave = useCallback(() => onMouseLeave?.(numStars), [numStars, onMouseLeave])
  const click = useCallback(() => onClick(numStars), [numStars, onClick])
  return <button
    onMouseEnter={isMobileVersion ? undefined : enter}
    onMouseLeave={isMobileVersion ? undefined : leave}
    onFocus={enter} onBlur={leave}
    onClick={click}
    style={starButtonStyle}>
    <img alt={alt} {...imgProps} />
  </button>
}
const FeedbackStar = React.memo(FeedbackStarBase)


interface StarsProps {
  isWhite?: true
  levels?: false | {[key in NumStarsString]: string}
  onStarClick: (star: number) => void
  score: number
  size?: number
  style?: React.CSSProperties
  title?: false | string
}


const starsTitleStyle: React.CSSProperties = {fontSize: 16, fontWeight: 500, marginBottom: 5}


const FeedbackStarsBase = (props: StarsProps): React.ReactElement => {
  const {t, t: translate} = useTranslation()
  const {
    isWhite,
    levels = _mapValues(feedbackTitle, (title: LocalizableString): string => translate(...title)),
    onStarClick,
    score,
    size = 20,
    style,
    title = t('Que pensez-vous de {{productName}}\u00A0?', {productName: config.productName}),
  } = props
  const [hoveredStars, setHoveredStars] = useState<0|NumStars>(0)
  const highlightedStars = hoveredStars || score || 0

  const resetHoveredStars = useCallback((): void => setHoveredStars(0), [])

  const shownTitle = useMemo(
    (): React.ReactNode => levels && levels[(highlightedStars + '') as NumStarsString] || title,
    [highlightedStars, levels, title],
  )

  const starStyle = useMemo((): React.CSSProperties => ({
    height: size + 10,
  }), [size])

  const fullStar = isWhite ? whiteStarIcon : starIcon
  const emptyStar = isWhite ? starOutlineIcon : greyStarOutlineIcon
  return <div style={{textAlign: 'center', ...style}}>
    {shownTitle ? <div style={starsTitleStyle}>
      {shownTitle}
    </div> : null}
    <div>
      {Array.from({length: 5}, (unused, index): React.ReactNode => <FeedbackStar
        onMouseEnter={setHoveredStars}
        onMouseLeave={(hoveredStars === index + 1) ? resetHoveredStars : undefined}
        style={starStyle}
        alt={t('{{numStars}} étoile', {count: index + 1, numStars: index + 1})}
        onClick={onStarClick}
        src={(index < highlightedStars) ? fullStar : emptyStar}
        key={index}
        role="button"
        numStars={(index + 1) as NumStars} />)}
    </div>
  </div>
}
FeedbackStarsBase.propTypes = {
  isWhite: PropTypes.bool,
  levels: PropTypes.oneOfType([
    PropTypes.bool.isRequired,
    PropTypes.shape(_fromPairs(Array.from(
      {length: 5},
      (unused, index) => [index + 1 + '', PropTypes.string.isRequired],
    ))),
  ]),
  onStarClick: PropTypes.func.isRequired,
  score: PropTypes.number.isRequired,
  size: PropTypes.number,
  title: PropTypes.oneOfType([
    PropTypes.bool.isRequired,
    PropTypes.string,
  ]),
}
const FeedbackStars = React.memo(FeedbackStarsBase)


export {FeedbackStars, PageWithFeedback}
