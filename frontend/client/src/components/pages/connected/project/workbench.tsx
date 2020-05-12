import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import PropTypes from 'prop-types'
import {parse} from 'query-string'
import React, {useEffect, useMemo, useRef} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'
import {Link, Redirect, useLocation, useParams} from 'react-router-dom'
import ReactRouterPropTypes from 'react-router-prop-types'

import {DispatchAllActions, RootState, advicePageIsShown, workbenchIsShown} from 'store/actions'
import {ValidAdvice, getAdviceShortTitle, getAdviceTitle} from 'store/advice'

import {AdviceCard} from 'components/advisor'
import {isMobileVersion} from 'components/mobile'
import {PageWithNavigationBar, Scrollable} from 'components/navigation'
import {RocketChain} from 'components/rocket_chain'
import {Button} from 'components/theme'
import {ObservationMethod} from './strategy'

const emptyObject = {} as const


interface WorkbenchAdviceProps {
  advice: bayes.bob.Advice & {adviceId: string}
  profile: bayes.bob.UserProfile
  project: bayes.bob.Project
}


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
const advicePaddingStyle = {
  padding: isMobileVersion ? 20 : 0,
}
const adviceCardStyle: React.CSSProperties = {
  border: 0,
  margin: `${isMobileVersion ? 0 : '40px'} 0`,
}


const WorkbenchAdviceBase = (props: WorkbenchAdviceProps): React.ReactElement => {
  const {advice, profile, project} = props
  const {t} = useTranslation()
  const {numStars} = advice
  return <React.Fragment>
    <div style={adviceTitleStyle}>
      {getAdviceTitle(advice, t)}
      <div style={rocketsDivStyle}>
        <RocketChain areEmptyRocketsShown={true} numStars={numStars || 0} rocketHeight={18} />
      </div>
    </div>
    <div style={advicePaddingStyle}>
      <AdviceCard
        areTipsShown={true} {...{advice, profile, project}}
        style={adviceCardStyle}
      />
    </div>
  </React.Fragment>
}
const WorkbenchAdvice = React.memo(WorkbenchAdviceBase)


interface AllMethodsProps {
  advice: bayes.bob.Advice
  baseUrl: string
  project: bayes.bob.Project
  style?: React.CSSProperties
}


const allMethodsTitleStyle: React.CSSProperties = {
  borderBottom: `solid 2px ${colors.MODAL_PROJECT_GREY}`,
  fontSize: 20,
  fontWeight: 'bold',
  marginBottom: 5,
  marginTop: 10,
  paddingBottom: 20,
}
const methodCardStyle: React.CSSProperties = {
  margin: '20px 0px',
}
const allMethodsWrapStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
}


const AllMethodsBase = (props: AllMethodsProps): React.ReactElement|null => {
  const {advice, baseUrl, project: {advices = []}, style} = props
  const currentAdviceId = advice && advice.adviceId
  const otherAdvicePieces = advices.filter(({adviceId}) => adviceId !== currentAdviceId)
  if (!otherAdvicePieces.length) {
    return null
  }
  return <div style={style}>
    <div style={allMethodsTitleStyle}>Toutes les méthodes de Bob</div>
    <div style={allMethodsWrapStyle}>
      {otherAdvicePieces.filter((a: bayes.bob.Advice): a is ValidAdvice => a && !!a.adviceId).map(
        (advice: ValidAdvice, index: number) =>
          <Link
            style={{color: 'inherit', textDecoration: 'none'}}
            to={`${baseUrl}/methode/${advice.adviceId}`} key={index} >
            <ObservationMethod style={methodCardStyle} {...{advice}} />
          </Link>)}
    </div>
  </div>
}
const AllMethods = React.memo(AllMethodsBase)


interface BreadCrumbsProps {
  hasStrategyPage?: boolean
  style?: React.CSSProperties
  urlOnClose: string
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


const BreadCrumbsBase = (props: BreadCrumbsProps): React.ReactElement => {
  const {hasStrategyPage, style, urlOnClose} = props
  const containerStyle = useMemo((): React.CSSProperties => ({
    height: 50,
    padding: 8,
    position: 'relative',
    ...style,
  }), [style])
  return <div style={containerStyle}>
    <Link to={urlOnClose}>
      <Button type="discreet" style={backButtonStyle}>
        <ChevronLeftIcon style={chevronStyle} />
        Retour {hasStrategyPage ? 'à la stratégie' : 'au diagnostic'}
      </Button>
    </Link>
  </div>
}
const BreadCrumbs = React.memo(BreadCrumbsBase)


interface WorkbenchParams {
  adviceId?: string
  strategyId?: string
}


interface WorkbenchProps {
  baseUrl: string
  project: bayes.bob.Project
}


function isValidAdvice(a?: bayes.bob.Advice): a is ValidAdvice {
  return !!(a && a.adviceId)
}


function getAdvice(
  adviceId: string|undefined, advices: readonly bayes.bob.Advice[], isForced: boolean,
): ValidAdvice|undefined {
  if (!adviceId) {
    return undefined
  }
  const matchedAdvice = advices.find((a: bayes.bob.Advice): a is ValidAdvice =>
    !!a.adviceId && a.adviceId.startsWith(adviceId))
  if (matchedAdvice) {
    return matchedAdvice
  }
  if (isForced) {
    return {adviceId, numStars: 3, score: 10}
  }
  return undefined
}


// TODO(pascal): Merge back with the WorkbenchWithAdvice below.
const WorkbenchBase = (props: WorkbenchProps): React.ReactElement => {
  const {
    baseUrl,
    project: {advices = [], strategies = []},
  } = props
  const isForcedAllowed = useSelector(
    ({user: {featuresEnabled: {alpha: isForcedAllowed = false} = {}} = {}}: RootState): boolean =>
      isForcedAllowed,
  )

  const {hash, search} = useLocation()
  const {forced} = parse(search.slice(1))
  const {adviceId, strategyId} = useParams<WorkbenchParams>()
  const advice = getAdvice(adviceId, advices, !!(isForcedAllowed && forced))

  // TODO(cyrille): DRY up this with project.tsx.
  const strategyIndex =
    strategies.findIndex(({strategyId: sId}): boolean => strategyId === sId)
  const strategy = strategies[strategyIndex]

  const hasStrategyPage = !!strategy
  const urlOnClose = hasStrategyPage ?
    `${baseUrl}/${strategyId}/methodes${search}${hash}` : baseUrl
  if (!isValidAdvice(advice)) {
    // We're lost, go back to previous page.
    return <Redirect to={urlOnClose} />
  }

  return <WorkbenchWithAdvice {...props} {...{advice, hasStrategyPage, urlOnClose}} />
}
WorkbenchBase.propTypes = {
  baseUrl: PropTypes.string.isRequired,
  location: ReactRouterPropTypes.location.isRequired,
  match: ReactRouterPropTypes.match.isRequired,
  project: PropTypes.shape({
    advices: PropTypes.arrayOf(PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
      score: PropTypes.number,
    }).isRequired),
  }).isRequired,
}
const Workbench = React.memo(WorkbenchBase)

const contentStyle = {
  margin: 'auto',
  maxWidth: 960,
  padding: '0 50px',
} as const
const allMethodsStyle = {
  marginBottom: 70,
}


interface WorkbenchWithAdviceProps {
  advice: bayes.bob.Advice & {adviceId: string}
  baseUrl: string
  hasStrategyPage?: boolean
  project: bayes.bob.Project
  urlOnClose: string
}


const WorkbenchWithAdviceBase = (props: WorkbenchWithAdviceProps): React.ReactElement => {
  const profile = useSelector(
    ({user: {profile = emptyObject}}: RootState): bayes.bob.UserProfile => profile,
  )
  const dispatch = useDispatch<DispatchAllActions>()
  const {t} = useTranslation()
  const {advice, baseUrl, hasStrategyPage, project, urlOnClose} = props

  useEffect((): void => {
    dispatch(workbenchIsShown(project))
    // Only ping once, even if the project changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch])

  const pageDom = useRef<Scrollable>(null)

  useEffect((): void => {
    dispatch(advicePageIsShown(project, advice))
    pageDom.current?.scroll({behavior: 'smooth', top: 0})
    // Only ping once for each advice change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, advice.adviceId])

  // TODO(sil): Update to the new strategy UI (https://app.zeplin.io/project/574ff4c2e5c988a36aba1335/screen/5dcd1e49e0f29b23c5f6e31b).
  const pageStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    display: 'flex',
    flexDirection: 'column',
  }

  return <PageWithNavigationBar
    page="workbench"
    navBarContent={getAdviceShortTitle(advice, t)}
    onBackClick={urlOnClose}
    isContentScrollable={true}
    ref={pageDom} isChatButtonShown={true} style={pageStyle}>
    {isMobileVersion ?
      <div style={{backgroundColor: '#fff', flex: 1, position: 'relative'}}>
        <WorkbenchAdvice {...{advice, profile, project}} />
      </div> : <div style={{backgroundColor: '#fff', flex: 1, flexShrink: 0}}>
        <BreadCrumbs hasStrategyPage={hasStrategyPage} urlOnClose={urlOnClose} />
        <div style={contentStyle}>
          <WorkbenchAdvice {...{advice, profile, project}} />
          <AllMethods style={allMethodsStyle} {...{advice, baseUrl, project}} />
        </div>
      </div>}
  </PageWithNavigationBar>
}
WorkbenchWithAdviceBase.propTypes = {
  advice: PropTypes.shape({
    adviceId: PropTypes.string.isRequired,
    score: PropTypes.number,
  }).isRequired,
  baseUrl: PropTypes.string.isRequired,
  hasStrategyPage: PropTypes.bool,
  project: PropTypes.shape({
  }).isRequired,
  urlOnClose: PropTypes.string.isRequired,
}
const WorkbenchWithAdvice = React.memo(WorkbenchWithAdviceBase)


export {Workbench}
