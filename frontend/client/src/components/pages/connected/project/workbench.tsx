import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import PropTypes from 'prop-types'
import {parse} from 'query-string'
import React from 'react'
import {connect} from 'react-redux'
import {RouteComponentProps} from 'react-router'
import {Link, Redirect} from 'react-router-dom'
import ReactRouterPropTypes from 'react-router-prop-types'

import {DispatchAllActions, RootState, advicePageIsShown, workbenchIsShown} from 'store/actions'
import {getAdviceShortTitle, getAdviceTitle} from 'store/advice'
import {YouChooser} from 'store/french'
import {youForUser} from 'store/user'

import {AdviceCard} from 'components/advisor'
import {isMobileVersion} from 'components/mobile'
import {PageWithNavigationBar} from 'components/navigation'
import {RocketChain} from 'components/rocket_chain'
import {Button} from 'components/theme'
import {Routes} from 'components/url'

import {StrategyPage} from './strategy'


interface WorkbenchParams {
  adviceId?: string
  strategyOrAdvice?: string
}


interface WorkbenchConnectedProps {
  isForcedAllowed: boolean
}


interface WorkbenchProps extends RouteComponentProps<WorkbenchParams>, WorkbenchConnectedProps {
  baseUrl: string
  project: bayes.bob.Project
}


interface WorkbenchState {
  advice?: bayes.bob.Advice
}


// TODO(pascal): Merge back with the WorkbenchWithAdvice below.
class WorkbenchBase extends React.PureComponent<WorkbenchProps, WorkbenchState> {
  private static getAdvice(adviceId, advices, isForced): bayes.bob.Advice {
    if (!adviceId) {
      return null
    }
    const matchedAdvice = advices.find((a): boolean => a.adviceId.startsWith(adviceId))
    if (matchedAdvice) {
      return matchedAdvice
    }
    if (isForced) {
      return {adviceId, numStars: 3, score: 10}
    }
    return null
  }

  public static propTypes = {
    baseUrl: PropTypes.string.isRequired,
    isForcedAllowed: PropTypes.bool,
    location: ReactRouterPropTypes.location.isRequired,
    match: ReactRouterPropTypes.match.isRequired,
    project: PropTypes.shape({
      advices: PropTypes.arrayOf(PropTypes.shape({
        adviceId: PropTypes.string.isRequired,
        score: PropTypes.number,
      }).isRequired),
    }).isRequired,
  }

  public state: WorkbenchState = {}

  public static getDerivedStateFromProps(nextProps, {advice: prevAdvice}): WorkbenchState {
    const {
      isForcedAllowed,
      location: {search},
      match: {params: {adviceId}},
      project: {advices = []},
    } = nextProps
    const {forced} = parse(search.substr(1))
    const advice = WorkbenchBase.getAdvice(adviceId, advices, isForcedAllowed && forced)

    return (advice !== prevAdvice) ? {advice} : null
  }

  public render(): React.ReactNode {
    const {
      baseUrl,
      location: {hash, search},
      match: {params: {adviceId, strategyOrAdvice}},
      project: {advices: allAdvices = [], strategies = []},
    } = this.props

    const strategyIndex =
      strategies.findIndex(({strategyId}): boolean => strategyId === strategyOrAdvice)
    const strategy = strategies[strategyIndex]

    // If there's no adviceId and strategyOrAdvice is an advice,
    // redirect to get a fake strategy (named 'conseil') as well.
    if (!adviceId) {
      if (allAdvices.find((a): boolean => a.adviceId.startsWith(strategyOrAdvice))) {
        return <Redirect to={`${baseUrl}/conseil/${strategyOrAdvice}${search}${hash}`} />
      }
      if (!strategy) {
        // TODO(pascal): Log an error to Sentry.
        return <Redirect to={`${baseUrl}${search}${hash}`} />
      }
    }

    const {advice} = this.state
    const getAdviceUrl = ({adviceId = ''}): string =>
      `${baseUrl}/${strategyOrAdvice}/${adviceId}${search}${hash}`

    const hasStrategyPage = !!strategy
    if (!advice) {
      if (hasStrategyPage) {
        // TODO(cyrille): Move to project.jsx.
        return <StrategyPage {...this.props} strategy={strategy} strategyRank={strategyIndex + 1} />
      }
      if (strategy && strategy.piecesOfAdvice && strategy.piecesOfAdvice.length) {
        // Select the first advice in the strategy.
        return <Redirect to={getAdviceUrl(strategy.piecesOfAdvice[0])} />
      }
      // We're lost, go back to root.
      return <Redirect to={Routes.ROOT + search + hash} />
    }

    const urlOnClose = hasStrategyPage ?
      `${baseUrl}/${strategyOrAdvice}${search}${hash}` : baseUrl
    return <WorkbenchWithAdvice {...this.props} {...{advice, hasStrategyPage, urlOnClose}} />
  }
}
const Workbench = connect(
  ({user: {
    featuresEnabled: {alpha: isForcedAllowed = false} = {},
  } = {}}: RootState): WorkbenchConnectedProps => ({isForcedAllowed}))(WorkbenchBase)


const contentStyle = {
  margin: 'auto',
  maxWidth: 960,
  padding: '0 50px',
} as const


interface WorkbenchWithAdviceConnectedProps {
  profile: bayes.bob.UserProfile
  userYou: YouChooser
}


interface WorkbenchWithAdviceProps extends WorkbenchWithAdviceConnectedProps {
  advice: bayes.bob.Advice
  dispatch: DispatchAllActions
  hasStrategyPage?: boolean
  project: bayes.bob.Project
  urlOnClose: string
}


class WorkbenchWithAdviceBase extends React.PureComponent<WorkbenchWithAdviceProps> {
  public static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
      score: PropTypes.number,
    }).isRequired,
    dispatch: PropTypes.func.isRequired,
    hasStrategyPage: PropTypes.bool,
    profile: PropTypes.object.isRequired,
    project: PropTypes.shape({
    }).isRequired,
    urlOnClose: PropTypes.string.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public componentDidMount(): void {
    const {advice, dispatch, project} = this.props
    dispatch(workbenchIsShown(project))
    dispatch(advicePageIsShown(project, advice))
  }

  public componentDidUpdate(prevProps: WorkbenchWithAdviceProps): void {
    const {advice, dispatch, project} = this.props
    if (advice.adviceId === prevProps.advice.adviceId) {
      return
    }

    if (this.pageDom.current) {
      this.pageDom.current.scroll({behavior: 'smooth', top: 0})
    }

    // Opening a new advice page.
    dispatch(advicePageIsShown(project, advice))
  }

  private pageDom: React.RefObject<PageWithNavigationBar> = React.createRef()

  private renderAdvice(): React.ReactNode {
    const {advice, profile, project, userYou} = this.props
    const {numStars} = advice
    const rocketsWidth = 130
    const adviceTitleStyle: React.CSSProperties = {
      borderBottom: isMobileVersion ? 'none' : `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      color: colors.DARK,
      fontSize: isMobileVersion ? 20 : 24,
      fontWeight: 900,
      padding: isMobileVersion ? '35px 20px' : `35px ${rocketsWidth}px 35px 0`,
      position: 'relative',
      textAlign: isMobileVersion ? 'center' : 'left',
    }
    const rocketsDivStyle: React.CSSProperties = {
      backgroundColor: colors.BACKGROUND_GREY,
      borderRadius: isMobileVersion ? 5 : '5px 5px 0 0',
      bottom: -1,
      display: 'flex',
      justifyContent: 'center',
      margin: `${isMobileVersion ? '15px' : 0} auto 0`,
      padding: '11px 15px',
      position: isMobileVersion ? 'static' : 'absolute',
      right: 0,
      width: rocketsWidth,
    }
    return <React.Fragment>
      <div style={adviceTitleStyle}>
        {getAdviceTitle(advice, userYou)}
        <div style={rocketsDivStyle}>
          <RocketChain areEmptyRocketsShown={true} numStars={numStars} rocketHeight={18} />
        </div>
      </div>
      <div style={{padding: isMobileVersion ? 20 : '0 0 120px'}}>
        <AdviceCard
          areTipsShown={true} {...{advice, profile, project}}
          style={{border: 0, margin: `${isMobileVersion ? 0 : '40px'} 0`}}
        />
      </div>
    </React.Fragment>
  }

  private renderBreadCrumbs(style: React.CSSProperties): React.ReactNode {
    const {hasStrategyPage, urlOnClose} = this.props
    const containerStyle: React.CSSProperties = {
      padding: 8,
      position: 'relative',
      ...style,
    }
    const backButtonStyle: React.CSSProperties = {
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      boxShadow: 'initial',
      color: colors.DARK_TWO,
      fontSize: 14,
      fontWeight: 'bold',
      left: 8,
      padding: '8px 15px',
      position: 'absolute',
      top: 8,
    }
    const chevronStyle: React.CSSProperties = {
      fill: colors.DARK_TWO,
      margin: '-6px 5px -6px -8px',
      verticalAlign: 'middle',
    }
    return <div style={containerStyle}>
      <Link to={urlOnClose}>
        <Button type="discreet" style={backButtonStyle}>
          <ChevronLeftIcon style={chevronStyle} />
          Retour {hasStrategyPage ? 'à la stratégie' : 'au diagnostic'}
        </Button>
      </Link>
    </div>
  }

  private renderPageContent(style: React.CSSProperties): React.ReactNode {
    if (isMobileVersion) {
      return <div style={{backgroundColor: '#fff', position: 'relative', ...style}}>
        {this.renderAdvice()}
      </div>
    }
    return <div style={{backgroundColor: '#fff', flexShrink: 0, ...style}}>
      {this.renderBreadCrumbs({height: 50})}
      <div style={contentStyle}>
        {this.renderAdvice()}
      </div>
    </div>
  }

  public render(): React.ReactNode {
    const {advice, urlOnClose, userYou} = this.props

    const pageStyle: React.CSSProperties = {
      backgroundColor: '#fff',
      display: 'flex',
      flexDirection: 'column',
    }

    return <PageWithNavigationBar
      page="workbench"
      navBarContent={getAdviceShortTitle(advice, userYou)}
      onBackClick={urlOnClose}
      isContentScrollable={true}
      ref={this.pageDom} isChatButtonShown={true} style={pageStyle}>
      {this.renderPageContent({flex: 1})}
    </PageWithNavigationBar>
  }
}
const WorkbenchWithAdvice = connect(({user}: RootState): WorkbenchWithAdviceConnectedProps => ({
  profile: user.profile,
  userYou: youForUser(user),
}))(WorkbenchWithAdviceBase)


export {Workbench}
