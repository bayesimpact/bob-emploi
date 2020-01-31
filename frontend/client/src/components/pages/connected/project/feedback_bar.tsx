import {TFunction, TOptions} from 'i18next'
import _max from 'lodash/max'
import PropTypes from 'prop-types'
import React, {useCallback, useImperativeHandle, useMemo, useState} from 'react'
import {WithTranslation, useTranslation, withTranslation} from 'react-i18next'
import {connect} from 'react-redux'
import {RouteComponentProps, withRouter} from 'react-router'
import {Redirect, Route, Switch, useHistory} from 'react-router-dom'
import ReactRouterPropTypes from 'react-router-prop-types'

import {DispatchAllActions, RootState, sendProjectFeedback} from 'store/actions'
import {getAdviceShortTitle, isValidAdvice} from 'store/advice'
import {prepareT} from 'store/i18n'

import starIcon from 'images/star.svg'
import whiteStarIcon from 'images/star-white.svg'
import starOutlineIcon from 'images/star-outline.svg'
import greyStarOutlineIcon from 'images/star-outline.svg?stroke=#9596a0'
import {Trans} from 'components/i18n'
import {isMobileVersion} from 'components/mobile'
import {Modal} from 'components/modal'
import {ShareModal} from 'components/share'
import {Button, SmoothTransitions, Textarea} from 'components/theme'
import {FEEDBACK_TAB} from 'components/url'
import {CheckboxList} from 'components/pages/connected/form_utils'

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
  {app: {submetricsExpansion = {}}, user: {featuresEnabled: {stratTwo} = {}}}: RootState,
  {advices, diagnosticShownAt, feedback, openedStrategies = [], strategies}: bayes.bob.Project,
): Date | undefined => {
  // Feedback already given.
  if (feedback && feedback.score) {
    return undefined
  }

  // User is in pre-strat UX.
  if (stratTwo !== 'ACTIVE' || !strategies || !strategies.length) {
    // The user started interacting with the pre-strat content.
    if (advices && advices.some(({status}): boolean => status === 'ADVICE_READ') ||
      !!Object.keys(submetricsExpansion).length) {
      return new Date()
    }

    // Wait for 13s in diagnostic even if they do not open an advice page.
    return diagnosticShownAt ? addDuration(diagnosticShownAt, 13000) : undefined
  }

  // User has started a strategy: wait for 20s.
  const lastStratStarted = _max(openedStrategies.map(({startedAt}): string|undefined => startedAt))
  if (lastStratStarted) {
    return addDuration(lastStratStarted, 20000)
  }

  // User has seen the diagnostic but has not started a strategy: wait 60s.
  return diagnosticShownAt ? addDuration(diagnosticShownAt, 60000) : undefined
}


interface FormProps {
  dispatch: DispatchAllActions
  gender?: bayes.bob.Gender
  onSubmit?: () => void
  project: bayes.bob.Project
  score?: number
  t: TFunction
}


interface BarConnectedProps {
  gender?: bayes.bob.Gender
}


interface BarConfig {
  children?: never
  evaluationUrl: string
  isShown: boolean
  onSubmit?: () => void
  project: bayes.bob.Project
}


interface BarProps extends BarConnectedProps, BarConfig, WithTranslation {
  dispatch: DispatchAllActions
}


interface BarState {
  isModalShown: boolean
  score: number
}


class FeedbackBarBase extends React.PureComponent<BarProps, BarState> {
  public static propTypes = {
    evaluationUrl: PropTypes.string.isRequired,
    isShown: PropTypes.bool.isRequired,
    project: PropTypes.object.isRequired,
    t: PropTypes.func.isRequired,
  }

  public state = {
    isModalShown: false,
    score: 0,
  }

  private form: React.RefObject<FormRef> = React.createRef()

  private openModal = (score: number): void => {
    if (this.form.current) {
      this.form.current.setScore(score)
    }
    this.setState({isModalShown: true, score})
  }

  private handleCancel = (): void => this.setState({isModalShown: false, score: 0})

  private renderModal(): React.ReactNode {
    const {isModalShown, score} = this.state
    const {evaluationUrl} = this.props
    if (isMobileVersion) {
      if (isModalShown) {
        return <Redirect to={`${evaluationUrl}/${score}`} push={true} />
      }
      return null
    }
    return <Modal
      isShown={isModalShown} style={{margin: '0 10px'}}
      onClose={this.handleCancel}>
      <FeedbackForm {...this.props} ref={this.form} score={score} />
    </Modal>
  }

  public render(): React.ReactNode {
    const {isShown, project: {feedback}} = this.props
    const {score} = this.state
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
    return <React.Fragment>
      {this.renderModal()}
      <div style={isMobileVersion ? {overflow: 'hidden'} : fixedBottomStyle}>
        <div style={containerStyle}>
          <FeedbackStars score={score} onStarClick={this.openModal} isWhite={true} />
        </div>
      </div>
      {isMobileVersion ? null : <div style={{height: 80}} />}
    </React.Fragment>
  }
}
const FeedbackBar = connect(({user}: RootState): BarConnectedProps => ({
  gender: user.profile?.gender,
}))(withTranslation()(FeedbackBarBase))


interface PageWithFeedbackConnectedProps {
  showAfter: Date | undefined
}


interface PageWithFeedbackConfig
  extends Omit<BarConfig, 'children' | 'evaluationUrl' | 'onSubmit' | 'isShown'> {
  baseUrl: string
  children: React.ReactNode
}


interface PageWithFeedbackProps
  extends PageWithFeedbackConfig,
  RouteComponentProps<{}, {}, {returningFromFeedbackPage?: boolean}>,
  PageWithFeedbackConnectedProps, WithTranslation {
  dispatch: DispatchAllActions
}


type PageRouteProps = RouteComponentProps<{score?: string}>


class PageWithFeedbackBase
  extends React.PureComponent<PageWithFeedbackProps, {isShareBobShown: boolean; isShown: boolean}> {
  public static propTypes = {
    baseUrl: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
    dispatch: PropTypes.func.isRequired,
    location: ReactRouterPropTypes.location.isRequired,
    project: PropTypes.object.isRequired,
    showAfter: PropTypes.instanceOf(Date),
  }

  public state = {
    isShareBobShown: false,
    isShown: !!this.props.showAfter && this.props.showAfter < new Date(),
  }

  public componentDidMount(): void {
    this.updateShowAfter(this.props.showAfter)
  }

  public componentDidUpdate(prevProps: PageWithFeedbackProps): void {
    const {
      location: {state: {returningFromFeedbackPage: prevReturning = false} = {}},
      showAfter: prevShowAfter,
    } = prevProps
    const {
      location: {state: {returningFromFeedbackPage = false} = {}},
      showAfter,
    } = this.props
    if (!prevReturning && returningFromFeedbackPage) {
      this.handleReturnFromFeedback()
    }
    if (showAfter !== prevShowAfter) {
      this.updateShowAfter(showAfter)
    }
  }

  public componentWillUnmount(): void {
    clearTimeout(this.timeout)
  }

  private timeout?: number

  private handleReturnFromFeedback = (): void => {
    const {feedback} = this.props.project
    if (feedback && (feedback.score || 0) >= 4) {
      this.setState({isShareBobShown: true})
    }
  }

  private hideShareModal = (): void => {
    this.setState({isShareBobShown: false})
  }

  private updateShowAfter(showAfter: Date | undefined): void {
    clearTimeout(this.timeout)
    if (showAfter) {
      const showInMillisec = showAfter.getTime() - new Date().getTime()
      this.timeout = window.setTimeout((): void => this.setState({isShown: true}), showInMillisec)
    }
  }

  private renderPage = ({match: {params: {score}}}: PageRouteProps): React.ReactNode => {
    const {baseUrl,
      children: omittedChildren, dispatch: omittedDispatch, location: omittedLocation,
      ...otherProps} = this.props
    return <FeedbackPage
      {...otherProps} score={score ? parseInt(score, 10) : undefined}
      backTo={{pathname: baseUrl, state: {returningFromFeedbackPage: true}}} />
  }

  public render(): React.ReactNode {
    const {baseUrl, children, dispatch, showAfter: omittedShowAfter, t,
      ...barProps} = this.props
    const {isShareBobShown, isShown} = this.state
    const evaluationUrl = `${baseUrl}/${FEEDBACK_TAB}`
    return <Switch>
      <Route path={`${evaluationUrl}/:score?`} render={this.renderPage} />
      <React.Fragment>
        {children}
        <FeedbackBar
          {...barProps} evaluationUrl={evaluationUrl}
          onSubmit={this.handleReturnFromFeedback} isShown={isShown} />
        <ShareModal
          onClose={this.hideShareModal} isShown={isShareBobShown}
          title={t('Vous aussi, aidez vos amis')}
          campaign="fs" visualElement="feedback" dispatch={dispatch}
          intro={<Trans parent={null}>
            <strong>Envoyez-leur directement ce lien <br /></strong>
            et on s'occupe du reste&nbsp;!
          </Trans>} />
      </React.Fragment>
    </Switch>
  }
}
const PageWithFeedback = connect(
  (state: RootState, {project}: PageWithFeedbackConfig): PageWithFeedbackConnectedProps => ({
    showAfter: getRequestFeedbackShowDate(state, project),
  }),
)(withRouter(withTranslation()(PageWithFeedbackBase)))


interface PageProps extends BarConnectedProps, FormProps {
  backTo: string | {pathname: string; state: object}
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
const FeedbackPage = connect(({user}: RootState): BarConnectedProps => ({
  gender: user.profile?.gender,
}))(React.memo(FeedbackPageBase))


interface SelectOption {
  name: string
  value: string
}


interface FormRef {
  setScore: (score: number) => void
}


const FeedbackFormBase = (props: FormProps, ref: React.Ref<FormRef>): React.ReactElement => {
  const {dispatch, gender, onSubmit, project, project: {advices}, t} = props
  const [score, setScore] = useState(props.score || 0)
  const [selectedAdvices, setSelectedAdvices] = useState<readonly string[]>([])
  const [text, setText] = useState('')

  useImperativeHandle(ref, () => ({setScore}))

  const saveFeedback = useCallback((): void => {
    const usefulAdviceModules: {[adviceId: string]: boolean} = {}
    selectedAdvices.forEach((adviceId: string): void => {
      usefulAdviceModules[adviceId] = true
    })
    dispatch(sendProjectFeedback(project, {score, text, usefulAdviceModules}))
    onSubmit && onSubmit()
  }, [dispatch, onSubmit, project, score, selectedAdvices, text])

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
      {isGoodFeedback ? <div>
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
FeedbackFormBase.propTypes = {
  dispatch: PropTypes.func.isRequired,
  gender: PropTypes.string,
  onSubmit: PropTypes.func,
  project: PropTypes.object.isRequired,
  score: PropTypes.number,
}
const FeedbackForm = React.forwardRef(FeedbackFormBase)


type NumStars = 1|2|3|4|5
type NumStarsString = '1'|'2'|'3'|'4'|'5'


interface StarProps extends
  Omit<React.ComponentPropsWithoutRef<'img'>, 'onClick'|'onMouseEnter'|'onMouseLeave'> {
  alt: string
  numStars: NumStars
  onClick: (numStars: NumStars) => void
  onMouseEnter: (numStars: NumStars) => void
  onMouseLeave?: (numStars: NumStars) => void
}


const FeedbackStarBase = (props: StarProps): React.ReactElement => {
  const {alt, numStars, onClick, onMouseEnter, onMouseLeave, ...imgProps} = props
  const enter = useCallback(() => onMouseEnter(numStars), [numStars, onMouseEnter])
  const leave = useCallback(() => onMouseLeave?.(numStars), [numStars, onMouseLeave])
  const click = useCallback(() => onClick(numStars), [numStars, onClick])
  return <img
    onMouseEnter={isMobileVersion ? undefined : enter}
    onMouseLeave={isMobileVersion ? undefined : leave}
    onClick={click} alt={alt} {...imgProps} />
}
const FeedbackStar = React.memo(FeedbackStarBase)


interface StarsProps {
  // TODO(pascal): Consider removing as it's always true.
  isWhite?: boolean
  onStarClick: (star: number) => void
  score: number
  size?: number
}


const starsTitleStyle: React.CSSProperties = {fontSize: 16, fontWeight: 500, marginBottom: 5}


const FeedbackStarsBase = (props: StarsProps): React.ReactElement => {
  const {isWhite, onStarClick, score, size = 20} = props
  const {t} = useTranslation()
  const [hoveredStars, setHoveredStars] = useState<0|NumStars>(0)
  const highlightedStars = hoveredStars || score || 0

  const resetHoveredStars = useCallback((): void => setHoveredStars(0), [])

  const title = useMemo((): React.ReactNode => {
    const title = feedbackTitle[(highlightedStars + '') as NumStarsString] ||
      prepareT('Que pensez-vous de {{productName}}\u00A0?')
    // i18next-extract-disable-next-line
    return t(title, {productName: config.productName})
  }, [highlightedStars, t])

  const starStyle = useMemo((): React.CSSProperties => ({
    cursor: 'pointer',
    height: size + 10,
    padding: 5,
  }), [size])

  const fullStar = isWhite ? whiteStarIcon : starIcon
  const emptyStar = isWhite ? starOutlineIcon : greyStarOutlineIcon
  return <div style={{textAlign: 'center'}}>
    <div style={starsTitleStyle}>
      {title}
    </div>
    <div>
      {new Array(5).fill(null).map((unused, index): React.ReactNode => <FeedbackStar
        onMouseEnter={setHoveredStars}
        onMouseLeave={(hoveredStars === index + 1) ? resetHoveredStars : undefined}
        style={starStyle}
        alt={t('{{numStars}} étoile', {count: index + 1, numStars: index + 1})}
        onClick={onStarClick}
        src={(index < highlightedStars) ? fullStar : emptyStar}
        key={index}
        numStars={(index + 1) as NumStars} />)}
    </div>
  </div>
}
FeedbackStarsBase.propTypes = {
  isWhite: PropTypes.bool,
  onStarClick: PropTypes.func.isRequired,
  score: PropTypes.number.isRequired,
  size: PropTypes.number,
}
const FeedbackStars = React.memo(FeedbackStarsBase)


export {PageWithFeedback}
