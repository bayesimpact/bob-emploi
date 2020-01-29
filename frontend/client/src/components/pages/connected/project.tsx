import _memoize from 'lodash/memoize'
import PropTypes from 'prop-types'
import React from 'react'
import {WithTranslation, withTranslation} from 'react-i18next'
import {connect} from 'react-redux'
import {RouteComponentProps} from 'react-router'
import {Redirect, Route, Switch} from 'react-router-dom'
import ReactRouterPropTypes from 'react-router-prop-types'

import {DispatchAllActions, RootState, diagnosticIsShown, diagnosticTalkIsShown,
  downloadDiagnosticAsPdf} from 'store/actions'
import {YouChooser} from 'store/french'
import {prepareT} from 'store/i18n'
import {youForUser} from 'store/user'

import {FastForward} from 'components/fast_forward'
import {Trans} from 'components/i18n'
import {isMobileVersion} from 'components/mobile'
import {PageWithNavigationBar} from 'components/navigation'
import {JobGroupCoverImage, CircularProgress, SmoothTransitions} from 'components/theme'
import {FEEDBACK_TAB, NEW_PROJECT_ID, Routes} from 'components/url'

import {Diagnostic} from './project/diagnostic'
import {PageWithFeedback} from './project/feedback_bar'
import {PoleEmploiChangelogModal} from './project/pole_emploi'
import {StatisticsPage} from './project/statistics'
import {StrategyPage, StrategyPageParams} from './project/strategy'
import {Workbench} from './project/workbench'


function getProject(pId: string, {projects = []}: bayes.bob.User): bayes.bob.Project {
  const project = projects.find(({projectId}: bayes.bob.Project): boolean => projectId === pId)
  if (project) {
    return project
  }
  if (projects.length) {
    return projects[0]
  }
  return {}
}



const TOTAL_WAITING_TIME_MILLISEC = 8000


const emptyObject = {} as const


const waitingTexts = [
  prepareT('Analyse du marché du travail dans votre région'),
  prepareT('Analyse de votre situation actuelle'),
  prepareT('Évaluation des axes stratégiques prioritaires'),
  prepareT('Préparation des solutions potentielles'),
] as const


interface WaitingProps {
  fadeOutTransitionDurationMillisec?: number
  isForceShown: boolean
  onDone?: () => void
  project: bayes.bob.Project
  style?: React.CSSProperties
  userProfile: bayes.bob.UserProfile
}


class WaitingProjectPageBase extends React.PureComponent<WaitingProps & WithTranslation> {
  public static propTypes = {
    fadeOutTransitionDurationMillisec: PropTypes.number,
    isForceShown: PropTypes.bool,
    onDone: PropTypes.func,
    project: PropTypes.object.isRequired,
    style: PropTypes.object,
    t: PropTypes.func.isRequired,
    userProfile: PropTypes.object.isRequired,
  }

  public state = {
    isFadingOut: false,
    waitingText: this.getWaitingTexts()[0],
  }

  public componentDidMount(): void {
    this.updateText(0)
  }

  public componentWillUnmount(): void {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
  }

  private timeout?: number

  private getWaitingTexts(): readonly string[] {
    const {t: translate} = this.props
    return waitingTexts.map((text: ReturnType<typeof prepareT>): string => translate(text))
  }

  private updateText = (waitingTextIndex: number): void => {
    const {onDone, fadeOutTransitionDurationMillisec = 600, isForceShown, t} = this.props
    const waitingTexts = this.getWaitingTexts()
    if (waitingTextIndex >= waitingTexts.length) {
      if (isForceShown) {
        this.setState({waitingText: t("En attente d'une réponse du serveur")})
      } else {
        this.setState({isFadingOut: true})
      }
      if (onDone) {
        this.timeout = window.setTimeout(onDone, fadeOutTransitionDurationMillisec)
      }
      return
    }
    this.setState({waitingText: waitingTexts[waitingTextIndex]})
    this.timeout = window.setTimeout(
      (): void => this.updateText(waitingTextIndex + 1),
      TOTAL_WAITING_TIME_MILLISEC / waitingTexts.length)
  }

  public render(): React.ReactNode {
    const {onDone, project, style, userProfile} = this.props
    const {isFadingOut} = this.state
    const containerStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: 15,
      position: 'relative',
      zIndex: 0,
      ...style,
    }
    const boxStyle: React.CSSProperties = {
      backgroundColor: '#fff',
      borderRadius: 10,
      opacity: isFadingOut ? 0 : 1,
      padding: isMobileVersion ? 30 : '50px 100px',
      textAlign: 'center',
      ...SmoothTransitions,
    }
    const headerStyle: React.CSSProperties = {
      fontSize: 23,
      fontWeight: 500,
    }
    const waitingNoticeStyle: React.CSSProperties = {
      color: colors.BOB_BLUE,
      fontSize: 13,
      fontWeight: 500,
      lineHeight: 1.5,
    }
    const {targetJob: {jobGroup: {romeId = undefined} = {}} = {}} = project
    return <div style={containerStyle}>
      {onDone ? <FastForward onForward={onDone} /> : null}
      {romeId ? <JobGroupCoverImage romeId={romeId} style={{zIndex: -1}} /> : null}
      <div style={boxStyle}>
        <header style={headerStyle}>{project.title}</header>
        <Trans style={{margin: 'auto', maxWidth: 360, paddingTop: 23}}>
          Merci {{firstName: userProfile.name}} pour votre patience&nbsp;!<br /><br />
          Nous analysons vos informations pour créer votre diagnostic personnalisé.
        </Trans>
        <div style={{padding: 30}}>
          <CircularProgress style={{color: waitingNoticeStyle.color}} />
        </div>
        <div style={waitingNoticeStyle}>
          {this.state.waitingText}…
        </div>
      </div>
    </div>
  }
}
const WaitingProjectPage = withTranslation()(WaitingProjectPageBase)


interface PageConnectedProps {
  project: bayes.bob.Project
  user: bayes.bob.User
}


interface PageProps extends PageConnectedProps, RouteComponentProps<{projectId?: string}> {}


interface PageState {
  isFirstTime?: boolean
  isWaitingInterstitialShown?: boolean
}


class ProjectPageBase extends React.PureComponent<PageProps, PageState> {
  public static propTypes = {
    location: ReactRouterPropTypes.location.isRequired,
    match: ReactRouterPropTypes.match.isRequired,
    user: PropTypes.object.isRequired,
  }

  public static getDerivedStateFromProps(
    {match: {isExact}}: PageProps, {isFirstTime: wasFirstTime}: PageState): PageState|null {
    if (wasFirstTime && !isExact) {
      // Disable isFirstTime once the URL changes to a sub page.
      return {isFirstTime: false}
    }
    return null
  }

  public state = {
    isFirstTime: this.props.match.params.projectId === NEW_PROJECT_ID,
    isWaitingInterstitialShown: this.props.match.params.projectId === NEW_PROJECT_ID,
  }

  private handleWaitingInterstitialDone = (): void => {
    this.setState({isWaitingInterstitialShown: false})
  }

  private renderStats = (): React.ReactNode => {
    const {match: {url}, project} = this.props
    return <StatisticsPage baseUrl={url} project={project} />
  }

  private renderAdvice = (props: RouteComponentProps<StrategyPageParams>): React.ReactNode => {
    const {match: {url}, project, project: {advices = []}} = this.props
    const {match: {params: {adviceId: aId}}} = props
    const isAdvice = advices.some(({adviceId}): boolean =>
      adviceId && aId && adviceId.startsWith(aId) || false)
    if (!isAdvice) {
      return this.renderStrategy(props)
    }
    return <Workbench {...props} baseUrl={url} project={project} />
  }

  private renderStrategy = (props: RouteComponentProps<StrategyPageParams>): React.ReactNode => {
    const {match: {params: {strategyId}}} = props
    const {location: {hash, search}, match: {url},
      project, project: {advices = [], strategies = []}} = this.props
    const strategyIndex =
      strategies.findIndex(({strategyId: sId}): boolean => strategyId === sId)
    if (strategyIndex >= 0) {
      const strategy = strategies[strategyIndex] as bayes.bob.Strategy & {strategyId: string}
      return <StrategyPage
        {...props}
        projectUrl={url} project={project}
        strategyUrl={`${url}/${strategyId}`} strategy={strategy}
        strategyRank={strategyIndex + 1} />
    }
    const isAdvice = advices.some(({adviceId}): boolean =>
      adviceId && strategyId && adviceId.startsWith(strategyId) || false)
    if (isAdvice) {
      // Redirect to get a fake strategy (named 'conseil') as well.
      return <Redirect to={`${url}/conseil/${strategyId}{search}{hash}`} />
    }
    // We're lost, redirect to diagnostic.
    return <Redirect to={`${url}${search}${hash}`} />
  }

  private renderDiagnostic = (props: RouteComponentProps<{}>): React.ReactNode => {
    const {match: {url}, project} = this.props
    const {isFirstTime} = this.state
    return <ProjectDashboardPage
      project={project} baseUrl={url} {...{isFirstTime, ...props}} />
  }

  public render(): React.ReactNode {
    const {location, match: {params: {projectId = ''} = {}, url = ''} = {}, project,
      user} = this.props
    const {hash, search} = location
    const {isWaitingInterstitialShown} = this.state

    if (project.projectId && project.projectId !== projectId) {
      return <Redirect to={Routes.PROJECT_PAGE + '/' + project.projectId + search + hash} />
    }

    const isPageReady = !!(project.advices || project.diagnostic)
    if (isWaitingInterstitialShown || !isPageReady) {
      return <WaitingProjectPage
        userProfile={user.profile || emptyObject}
        style={{flex: 1}} project={project}
        onDone={this.handleWaitingInterstitialDone} isForceShown={!isPageReady} />
    }

    return <Switch>
      <Route path={`${Routes.PROJECT_PATH}/${FEEDBACK_TAB}`} render={this.renderDiagnostic} />
      <Route path={Routes.STATS_PATH} render={this.renderStats} />
      <Route path={Routes.ADVICE_PATH} render={this.renderAdvice} />
      <Route path={Routes.STRATEGY_PATH} render={this.renderStrategy} />
      <Route path={Routes.PROJECT_PATH} exact={true} render={this.renderDiagnostic} />
      <Redirect to={`${url}${search}${hash}`} />
    </Switch>
  }
}
export default connect((
  {user}: RootState,
  {match: {params: {projectId = ''}}}: RouteComponentProps<{projectId?: string}>,
): PageConnectedProps => ({
  project: getProject(projectId, user),
  user,
}))(ProjectPageBase)

interface DashboardProps extends RouteComponentProps<{}> {
  baseUrl: string
  isFirstTime: boolean
  project: bayes.bob.Project
}


// TODO(cyrille): Merge back in project page.
class ProjectDashboardPage extends React.PureComponent<DashboardProps, {}> {
  public static propTypes = {
    baseUrl: PropTypes.string.isRequired,
    isFirstTime: PropTypes.bool,
    match: ReactRouterPropTypes.match.isRequired,
    project: PropTypes.object.isRequired,
  }

  private makeAdviceLink = (adviceId: string, strategyId: string): string => {
    const {baseUrl} = this.props
    return strategyId ? `${baseUrl}/${strategyId}/${adviceId}` : `${baseUrl}/conseil/${adviceId}`
  }

  private makeStrategyLink = (strategyId: string): string => `${this.props.baseUrl}/${strategyId}`

  public render(): React.ReactNode {
    const {baseUrl, isFirstTime, project} = this.props

    return <DiagnosticPage
      makeAdviceLink={this.makeAdviceLink} makeStrategyLink={this.makeStrategyLink}
      {... {baseUrl, isFirstTime, project}} />
  }
}


interface DiagnosticConnectedProps {
  featuresEnabled: bayes.bob.Features
  profile: bayes.bob.UserProfile
  userYou: YouChooser
}


interface DiagnosticPageConfig {
  canShowShareBob?: boolean
  project: bayes.bob.Project
}


interface DiagnosticProps extends DiagnosticConnectedProps, DiagnosticPageConfig {
  dispatch: DispatchAllActions
  baseUrl: string
  isFirstTime?: boolean
  makeAdviceLink: (adviceId: string, strategyId: string) => string
  makeStrategyLink: (strategyId: string) => string
}

interface DiagnosticState {
  isPoleEmploiChangelogShown?: boolean
}

class DiagnosticPageBase extends React.PureComponent<DiagnosticProps, DiagnosticState> {
  public static propTypes = {
    baseUrl: PropTypes.string.isRequired,
    dispatch: PropTypes.func.isRequired,
    featuresEnabled: PropTypes.shape({
      alpha: PropTypes.bool,
      poleEmploi: PropTypes.bool,
      stratOne: PropTypes.oneOf(['ACTIVE', 'CONTROL']),
    }).isRequired,
    isFirstTime: PropTypes.bool,
    makeAdviceLink: PropTypes.func.isRequired,
    makeStrategyLink: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      name: PropTypes.string,
    }).isRequired,
    project: PropTypes.shape({
      advices: PropTypes.array,
      diagnostic: PropTypes.object,
      feedback: PropTypes.shape({
        score: PropTypes.number,
      }),
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public state: DiagnosticState = {
    isPoleEmploiChangelogShown: this.props.featuresEnabled.poleEmploi,
  }

  public componentWillUnmount(): void {
    clearTimeout(this.timeout)
  }

  private timeout?: number

  private handleFullDiagnosticShown = (): void => {
    const {dispatch, project} = this.props
    // The result of diagnosticIsShown can be two kinds of action (thunk or not), and dispatch
    // accepts both but Typescript gets lost in the process.
    // @ts-ignore
    dispatch(diagnosticIsShown(project))
  }

  private handleHide: ((v: string) => () => void) =
  _memoize((visualElement: string): (() => void) =>
    (): void => this.setState({[`is${visualElement}Shown`]: false}))

  private handleDiagnosticTextShown = (): void => {
    this.props.dispatch(diagnosticTalkIsShown(this.props.project))
    return
  }

  private handleDownloadAsPdf = (): void => {
    this.props.dispatch(downloadDiagnosticAsPdf(this.props.project))
    return
  }

  public render(): React.ReactNode {
    const {featuresEnabled: {stratTwo}, baseUrl,
      isFirstTime, makeAdviceLink, makeStrategyLink, profile, project, userYou} = this.props
    const {isPoleEmploiChangelogShown} = this.state
    const {advices, createdAt, diagnostic, strategies} = project
    const areStrategiesEnabled = !!(stratTwo === 'ACTIVE' && strategies && strategies.length)
    const diagnosticStyle = {
      backgroundColor: '#fff',
      flex: 1,
      margin: '0 auto',
      maxWidth: 1000,
      minWidth: isMobileVersion ? '100%' : 680,
    }
    const pageStyle: React.CSSProperties = {
      backgroundColor: areStrategiesEnabled && !isMobileVersion ? colors.MODAL_PROJECT_GREY :
        '#fff',
      display: 'flex',
      flexDirection: 'column',
    }
    // TODO(pascal): Group FeedbackBar and ShareModal in a component as they
    // are closely related here.
    return <PageWithNavigationBar
      page="project"
      navBarContent="Mon diagnostic"
      isChatButtonShown={true} style={pageStyle}>
      <PageWithFeedback project={project} baseUrl={baseUrl}>
        <PoleEmploiChangelogModal
          isShown={isPoleEmploiChangelogShown} projectCreatedAt={createdAt || ''}
          onClose={this.handleHide('PoleEmploiChangelog')} />
        <Diagnostic
          diagnosticData={diagnostic || emptyObject}
          onFullDiagnosticShown={this.handleFullDiagnosticShown}
          onDiagnosticTextShown={this.handleDiagnosticTextShown}
          onDownloadAsPdf={this.handleDownloadAsPdf}
          userName={profile.name}
          style={diagnosticStyle}
          {...{advices, areStrategiesEnabled, baseUrl, isFirstTime, makeAdviceLink,
            makeStrategyLink, project, strategies, userYou}}
        />
      </PageWithFeedback>
    </PageWithNavigationBar>
  }
}
const DiagnosticPage = connect(({user}: RootState): DiagnosticConnectedProps => ({
  featuresEnabled: user.featuresEnabled || {},
  profile: user.profile || {},
  userYou: youForUser(user),
}))(DiagnosticPageBase)
