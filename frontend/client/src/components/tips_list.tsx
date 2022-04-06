import React, {useCallback, useEffect, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'

import type {DispatchAllActions, RootState} from 'store/actions'
import {getAdviceTips, showAllTips} from 'store/actions'
import {getAdviceGoal} from 'store/advice'

import useOnScreen from 'hooks/on_screen'

import type {TipPropWithId} from 'components/tip'
import {InlineTip, TipDescriptionModal} from 'components/tip'
import Button from 'components/button'
import {PADDED_ON_MOBILE} from 'components/theme'

const DEFAULT_TIPS_SHOWN = 5

// Delay between showing two tips in ms.
const DELAY_BETWEEN_TIPS = 150


interface TipsListProps {
  advice: bayes.bob.Advice
  project: bayes.bob.Project
  style?: React.CSSProperties
}

const noListStyle: React.CSSProperties = {
  listStyleType: 'none',
  margin: 0,
  padding: 0,
}


const TipsList = (props: TipsListProps): React.ReactElement => {
  const {advice, project, style} = props
  const {t} = useTranslation('components')
  const dispatch = useDispatch<DispatchAllActions>()
  const tips = useSelector(
    ({app: {adviceTips}}: RootState): readonly bayes.bob.Action[]|undefined =>
      (adviceTips && adviceTips[project.projectId || ''] || {})[advice.adviceId || ''])

  const [numTipsShown, setNumTipsShown] = useState(0)
  const [numsTipsToShow, setNumTipsToShow] = useState(0)
  const [openTip, setOpenTip] = useState<TipPropWithId|undefined>()

  const hasTips = !!tips
  useEffect((): void => {
    if (!hasTips) {
      dispatch(getAdviceTips(project, advice))
    }
  }, [advice, dispatch, hasTips, project])

  const numTips = tips?.length || 0
  const handleShowAllTipsClick = useCallback((): void => {
    dispatch(showAllTips(project, advice))
    setNumTipsShown((n: number): number => n + 1)
    setNumTipsToShow(numTips)
  }, [advice, dispatch, numTips, project])

  const showDefaultTips = useCallback((isVisible: boolean): void => {
    if (!isVisible) {
      return
    }
    setNumTipsShown((n: number): number => n + 1)
    setNumTipsToShow(DEFAULT_TIPS_SHOWN)
  }, [])
  useEffect((): (() => void) => {
    if (numTipsShown >= numsTipsToShow) {
      return (): void => void 0
    }
    const timeout = window.setTimeout(
      (): void => setNumTipsShown(numTipsShown + 1),
      DELAY_BETWEEN_TIPS,
    )
    return (): void => window.clearTimeout(timeout)
  }, [numsTipsToShow, numTipsShown])

  const domRef = useRef<HTMLUListElement>(null)
  useOnScreen(domRef, {
    isForAppearing: true,
    onChange: showDefaultTips,
  })

  const handleCloseTip = useCallback((): void => setOpenTip(undefined), [])
  const handleOpenTip = useCallback((tip?: bayes.bob.Action): void => {
    if (tip && tip.actionId) {
      setOpenTip(tip as TipPropWithId)
    }
  }, [])

  if (!tips?.length) {
    return <div style={style} />
  }
  const titleStyle = {
    color: colors.CHARCOAL_GREY,
    fontSize: 16,
    margin: '0 0 10px',
    padding: PADDED_ON_MOBILE,
  }
  const showMoreTipsStyle = {
    display: 'flex',
    justifyContent: 'center',
    marginTop: 20,
  }
  const tipsShown = tips.slice(0, numTipsShown)
  return <div style={{marginTop: 30, ...style}}>
    <TipDescriptionModal
      tip={openTip}
      onClose={handleCloseTip}
      isShown={!!openTip} />
    <p style={titleStyle}>
      Voici quelques astuces pour {getAdviceGoal(advice, t)}&nbsp;:
    </p>
    <ul style={noListStyle} ref={domRef}>
      {tipsShown.map((tip): React.ReactNode => <AppearingComponent key={tip.actionId}>
        <InlineTip tip={tip} onOpen={handleOpenTip} />
      </AppearingComponent>)}
      {(numTipsShown === DEFAULT_TIPS_SHOWN && tips.length > DEFAULT_TIPS_SHOWN) ?
        <li style={showMoreTipsStyle}>
          <Button onClick={handleShowAllTipsClick} type="discreet">
            Afficher d'autres astuces
          </Button>
        </li> : null}
    </ul>
  </div>
}


const AppearingComponentBase = (props: {children: React.ReactNode}): React.ReactElement => {
  const {children} = props
  const [opacity, setOpacity] = useState(0)

  useEffect((): (() => void) => {
    const timeout = window.setTimeout((): void => setOpacity(1), 100)
    return (): void => window.clearTimeout(timeout)
  }, [])

  const style = {
    opacity,
    transition: 'opacity 300ms ease-in 300ms',
  }
  return <li style={style}>{children}</li>
}
const AppearingComponent = React.memo(AppearingComponentBase)


export default React.memo(TipsList)
