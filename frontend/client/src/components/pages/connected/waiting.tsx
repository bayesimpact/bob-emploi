import AlertCircleIcon from 'mdi-react/AlertCircleIcon'
import ChevronDownIcon from 'mdi-react/ChevronDownIcon'
import EyeOffIcon from 'mdi-react/EyeOffIcon'
import CheckCircleIcon from 'mdi-react/CheckCircleIcon'
import HelpCircleIcon from 'mdi-react/HelpCircleIcon'
import SyncCircleIcon from 'mdi-react/SyncCircleIcon'
import React, {useEffect, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'

import useFastForward from 'hooks/fast_forward'
import useStayAtBottom, {scrollDown} from 'hooks/scroll'

import Emoji from 'components/emoji'
import {CoverImageWithTitleAndText} from 'components/job_group_cover_image'
import {FixedButtonNavigation} from 'components/navigation'
import SkipToContent from 'components/skip_to_content'
import {SmoothTransitions} from 'components/theme'

import type {DispatchAllActions, RootState} from 'store/actions'
import {getDiagnosticMainChallenges} from 'store/actions'
import {NO_CHALLENGE_CATEGORY_ID} from 'store/project'
import {useAsynceffect, useSafeDispatch} from 'store/promise'

import arrowDown from 'images/arrow-down.png'


const STEP_WAITING_TIME_MILLISEC = 2000


const mainChallengeContainerStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',

  flexDirection: 'row-reverse',
  justifyContent: 'center',
  width: 280,
}
const mainChallengeImageContainerStyle: React.CSSProperties = {
  alignItems: 'center',
  border: `1px solid ${colors.PINKISH_GREY_THREE}`,
  borderRadius: '50%',
  boxSizing: 'border-box',
  display: 'flex',
  height: 46,
  justifyContent: 'center',
  position: 'relative',
  width: 46,
}
const mainChallengeImageIcoBaseStyle: React.CSSProperties = {
  bottom: -8,
  position: 'absolute',
  right: -8,
}
const iconBackgroundStyle: React.CSSProperties = {
  ...mainChallengeImageIcoBaseStyle,
  alignItems: 'center',
  backgroundColor: '#fff',
  borderRadius: 22,
  display: 'flex',
  height: 22,
  justifyContent: 'center',
  width: 22,
}
const mainChallengeTextContainerStyle: React.CSSProperties = {
  flex: 1,
  paddingLeft: 30,
}
const mainChallengeTitleStyle: React.CSSProperties = {
  color: colors.COOL_GREY,
  fontSize: 11,
  fontWeight: 'bold',
  lineHeight: '13px',
  margin: 0,
  textTransform: 'uppercase',
}
const mainChallengeAnalysisBaseStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 'bold',
  lineHeight: '19px',
  margin: 0,
}

const statusProps = {
  check: {
    analysisStyle: {
      ...mainChallengeAnalysisBaseStyle,
      color: '#000',
      fontSize: 16,
      fontWeight: 'bold',
    },
    icon: CheckCircleIcon,
    iconBackgroundStyle: iconBackgroundStyle,
    iconSize: 22,
    iconStyle: {
      color: colors.GREENISH_TEAL,
    },
  },
  loading: {
    analysisStyle: {
      ...mainChallengeAnalysisBaseStyle,
      color: '#000',
      fontSize: 16,
      fontStyle: 'italic',
      fontWeight: 'bold',
    },
    icon: SyncCircleIcon,
    iconBackgroundStyle: iconBackgroundStyle,
    iconSize: 22,
    iconStyle: {
      MozAnimation: 'spin 4s linear infinite',
      WebkitAnimation: 'spin 4s linear infinite',
      animation: 'spin 4s linear infinite',
      color: colors.BOB_BLUE,
    },
  },
  neutral: {
    analysisStyle: {
      ...mainChallengeAnalysisBaseStyle,
      color: colors.DARK_TWO,
      fontSize: 16,
      fontStyle: 'italic',
      fontWeight: 'bold',
    },
    icon: EyeOffIcon,
    iconBackgroundStyle: {
      ...iconBackgroundStyle,
      backgroundColor: colors.DARK_TWO,
      opacity: .7,
    },
    iconSize: 18,
    iconStyle: {
      color: '#fff',
    },
  },
  warning: {
    analysisStyle: {
      ...mainChallengeAnalysisBaseStyle,
      color: colors.RED_PINK,
      fontSize: 16,
      fontWeight: 'bold',
    },
    icon: AlertCircleIcon,
    iconBackgroundStyle: iconBackgroundStyle,
    iconSize: 22,
    iconStyle: {
      color: colors.RED_PINK,
    },
  },
} as const

type Status = keyof typeof statusProps

interface MainChallengeItemProps {
  isLast: boolean
  isWaiting: boolean
  rawMainChallenge: bayes.bob.DiagnosticMainChallenge
  relevance?: bayes.bob.MainChallengeRelevance
}
const mainChallengeArrowStyle: React.CSSProperties = {
  ...mainChallengeContainerStyle,
  flexDirection: 'row',
  justifyContent: 'flex-start',
  margin: '10px 0',
  paddingLeft: 16,
}


const MainChallengeItemBase = (props: MainChallengeItemProps): React.ReactElement|null => {
  const {isLast, isWaiting, rawMainChallenge, relevance} = props
  const {emoji, metricNotReached, metricReached, metricTitle} = rawMainChallenge
  const {t} = useTranslation()

  const [text, setText] = useState('')
  const [iconStatus, setIconStatus] = useState<Status>('loading')
  const [iconText, setIconText] = useState('')
  const [isLoading, setLoading] = useState(true)
  const [isShown, setIsShown] = useState(false)
  useEffect(() => {
    if (isWaiting) {
      return
    }
    setIsShown(true)
    if (isWaiting || !relevance) {
      return () => void 0
    }
    const timeout = setTimeout(() => setLoading(false), STEP_WAITING_TIME_MILLISEC / 2)
    return () => clearTimeout(timeout)
  }, [isWaiting, relevance])
  useEffect((): void => {
    if (isLoading) {
      setText(t('Analyse en cours'))
      setIconStatus('loading')
      setIconText(t("Critère en cours d'analyse"))
      return
    }
    if (relevance === 'RELEVANT_AND_GOOD') {
      setText(metricReached || '')
      setIconStatus('check')
      setIconText(t('Critère pertinent et vérifié'))
      return
    }
    if (relevance === 'NEEDS_ATTENTION') {
      setText(metricNotReached || '')
      setIconStatus('warning')
      setIconText(t("Critère nécessitant un point d'attention"))
      return
    }
    // Default case is NEUTRAL_RELEVANCE
    setText(t("Ne s'applique pas"))
    setIconText(t('Critère non applicable'))
    setIconStatus('neutral')
  }, [isLoading, isWaiting, metricNotReached, metricReached, relevance, t])

  if (isWaiting) {
    return null
  }

  const Icon = statusProps[iconStatus]?.icon || HelpCircleIcon

  return <li style={{opacity: isShown ? 1 : 0, ...SmoothTransitions}}>
    <div style={mainChallengeContainerStyle}>
      <div style={mainChallengeTextContainerStyle}>
        <h2 style={mainChallengeTitleStyle}>{metricTitle}</h2>
        <div aria-label={iconText}>
          <p style={statusProps[iconStatus]?.analysisStyle}>
            {text}
          </p>
        </div>
      </div>
      <div style={mainChallengeImageContainerStyle}>
        {emoji ? <Emoji size={22} aria-hidden={true}>{emoji}</Emoji> : null}
        <div
          style={
            statusProps[iconStatus]?.iconBackgroundStyle ||
            statusProps.neutral.iconBackgroundStyle}>
          <Icon
            aria-label={iconText} focusable={false} role="img"
            size={statusProps[iconStatus]?.iconSize || 22}
            style={statusProps[iconStatus]?.iconStyle || statusProps.neutral.iconStyle} />
        </div>
      </div>
    </div>
    {isLast ? null : <div style={mainChallengeArrowStyle}><img src={arrowDown} alt="" /></div>}
  </li>
}
const MainChallengeItem = React.memo(MainChallengeItemBase)


const seeBelowButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.BOB_BLUE,
  borderRadius: 20,
  bottom: 30,
  boxShadow: '0 4px 15px 0 rgba(0, 0, 0, 0.2)',
  color: '#fff',
  display: 'flex',
  height: 40,
  justifyContent: 'center',
  left: '50%',
  position: 'fixed',
  transform: 'translateX(-50%)',
  width: 40,
  zIndex: 1,
  ...SmoothTransitions,
}
const seeBelowButtonHiddenStyle: React.CSSProperties = {
  ...seeBelowButtonStyle,
  opacity: 0,
  pointerEvents: 'none',
}

interface RelevancesMap {
  [categoryId: string]: bayes.bob.MainChallengeRelevance
}

interface WaitingProps {
  onDone?: () => void
  project: bayes.bob.Project
  style?: React.CSSProperties
}
type ValidMainChallenge = bayes.bob.DiagnosticMainChallenge & {categoryId: string}
const headerStyle: React.CSSProperties = {
  fontWeight: 500,
  marginBottom: 50,
  width: '100%',
}

const listStyle: React.CSSProperties = {
  listStyleType: 'none',
}
const WaitingProjectPageBase = (props: WaitingProps): React.ReactElement => {
  const {onDone, project, style} = props
  const {city, targetJob} = project
  const {i18n, t} = useTranslation()
  const locale = useSelector(({user: {profile: {
    locale = i18n.language,
  } = {}}}: RootState): string => locale)
  const dispatch = useSafeDispatch<DispatchAllActions>()
  const containerStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    backgroundColor: '#fff',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    padding: 15,
    position: 'relative',
    zIndex: 0,
    ...style,
    ...SmoothTransitions,
  }), [style])
  const [mainChallenges, setMainChallenges] =
    useState<undefined|readonly ValidMainChallenge[]>(undefined)
  const [loadingIndex, setLoadingIndex] = useState<number>(-1)
  const [hasSeenItAll, setHasSeenItAll] = useState(false)
  const haveAllChallengesBeenLoaded =
    !!mainChallenges && mainChallenges.length <= loadingIndex

  const {diagnostic: {categories} = {}} = project
  const relevances = useMemo((): RelevancesMap|undefined => {
    if (!categories) {
      return undefined
    }
    return Object.fromEntries(categories.map(({categoryId, relevance}) => [categoryId, relevance]))
  }, [categories])

  const hasRelevances = !!relevances
  const hasMainChallenges = !!mainChallenges?.length

  // Start showing final status when everything is ready.
  useEffect((): (() => void)|void => {
    if (!hasRelevances || haveAllChallengesBeenLoaded || !hasMainChallenges) {
      return
    }
    setLoadingIndex((index: number) => index + 1)
    const timeout = window.setInterval((): void => {
      setLoadingIndex((index: number) => index + 1)
    }, STEP_WAITING_TIME_MILLISEC)
    return (): void => {
      clearInterval(timeout)
    }
  }, [haveAllChallengesBeenLoaded, hasMainChallenges, hasRelevances])

  // Show the first challenge as loaded when challenges are ready but relevances are not.
  useEffect((): void => {
    if (!hasRelevances && hasMainChallenges) {
      setLoadingIndex(lastIndex => Math.max(lastIndex, 0))
    }
  }, [hasRelevances, hasMainChallenges])

  useAsynceffect(async (checkIfCanceled) => {
    // TODO(émilie): Get that information from the cache (with useCachedData).
    const response = await dispatch(getDiagnosticMainChallenges(locale))
    if (checkIfCanceled() || !response) {
      return
    }
    setMainChallenges([...(response.categories || []).
      filter((mainChallenge: bayes.bob.DiagnosticMainChallenge):
      mainChallenge is ValidMainChallenge =>
        // Exclude "bravo" main challenge
        !!mainChallenge.categoryId && mainChallenge.categoryId !== NO_CHALLENGE_CATEGORY_ID)])
  }, [dispatch, locale])
  useFastForward(onDone)
  const footerStyle = useMemo((): React.CSSProperties => ({
    position: haveAllChallengesBeenLoaded && !hasSeenItAll ? 'absolute' : 'fixed',
    transform: `translateY(${haveAllChallengesBeenLoaded ? 0 : 100}%)`,
    ...SmoothTransitions,
  }), [hasSeenItAll, haveAllChallengesBeenLoaded])

  const isScrollAtBottom = useStayAtBottom([loadingIndex])
  useEffect((): void => {
    if (isScrollAtBottom && haveAllChallengesBeenLoaded) {
      setHasSeenItAll(true)
    }
  }, [isScrollAtBottom, haveAllChallengesBeenLoaded])

  return <div style={containerStyle}>
    <SkipToContent />
    <header style={headerStyle} role="banner">
      <CoverImageWithTitleAndText
        cityName={city?.name} style={{maxWidth: 325}} {...{targetJob}} titleElement="h1" />
    </header>
    <main role="main" id="main" tabIndex={-1}>
      <ol style={listStyle} role="log">
        {mainChallenges?.
          map((mainChallenge: ValidMainChallenge, index: number): React.ReactElement =>
            <MainChallengeItem
              relevance={relevances?.[mainChallenge.categoryId]}
              rawMainChallenge={mainChallenge}
              isLast={index + 1 === mainChallenges.length}
              isWaiting={index > loadingIndex}
              key={`challenge-${mainChallenge.categoryId}`} />,
          )}
      </ol>
      <button
        style={isScrollAtBottom || hasSeenItAll ? seeBelowButtonHiddenStyle : seeBelowButtonStyle}
        aria-hidden={isScrollAtBottom || hasSeenItAll}
        tabIndex={isScrollAtBottom || hasSeenItAll ? -1 : 0}
        onClick={scrollDown} type="button">
        <ChevronDownIcon aria-label={t('Voir plus bas')} role="img" />
      </button>
      {onDone ? <FixedButtonNavigation style={footerStyle} onClick={onDone}>
        {t("Découvrir l'avis de {{productName}}", {productName: config.productName})}
      </FixedButtonNavigation> : null}
    </main>
  </div>
}

export default React.memo(WaitingProjectPageBase)
