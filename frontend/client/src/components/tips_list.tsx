import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'
import VisibilitySensor from 'react-visibility-sensor'

import {DispatchAllActions, RootState, getAdviceTips, showAllTips} from 'store/actions'
import {getAdviceGoal} from 'store/advice'

import {Action, ActionDescriptionModal, ActionPropWithId} from 'components/actions'
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


const TipsList = (props: TipsListProps): React.ReactElement => {
  const {advice, project, style} = props
  const {t} = useTranslation()
  const dispatch = useDispatch<DispatchAllActions>()
  const tips = useSelector(
    ({app: {adviceTips}}: RootState): readonly bayes.bob.Action[]|undefined =>
      (adviceTips && adviceTips[project.projectId || ''] || {})[advice.adviceId || ''])

  const [numTipsShown, setNumTipsShown] = useState(0)
  const [numsTipsToShow, setNumTipsToShow] = useState(0)
  const [openTip, setOpenTip] = useState<ActionPropWithId|undefined>()

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


  const showDefaultTips = useCallback((): void => {
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

  const handleCloseTip = useCallback((): void => setOpenTip(undefined), [])
  const handleOpenTip = useCallback((action?: bayes.bob.Action): void => {
    if (action && action.actionId) {
      setOpenTip(action as ActionPropWithId)
    }
  }, [])

  if (!tips?.length) {
    return <div style={style} />
  }
  const titleStyle = {
    color: colors.CHARCOAL_GREY,
    fontSize: 16,
    marginBottom: 10,
    padding: PADDED_ON_MOBILE,
  }
  const showMoreTipsStyle = {
    display: 'flex',
    justifyContent: 'center',
    marginTop: 20,
  }
  const tipsShown = tips.slice(0, numTipsShown)
  return <div style={{marginTop: 30, ...style}}>
    <ActionDescriptionModal
      action={openTip}
      onClose={handleCloseTip}
      isShown={!!openTip} />
    <div style={titleStyle}>
      Voici quelques astuces pour {getAdviceGoal(advice, t)}&nbsp;:
    </div>
    <VisibilitySensor
      active={numTipsShown === 0} intervalDelay={250} delayedCall={true} partialVisibility={true}
      onChange={showDefaultTips}>
      <div>
        {tipsShown.map((tip): React.ReactNode => <AppearingComponent key={tip.actionId}>
          <Action action={tip} onOpen={handleOpenTip} />
        </AppearingComponent>)}
        {(numTipsShown === DEFAULT_TIPS_SHOWN && tips.length > DEFAULT_TIPS_SHOWN) ?
          <div style={showMoreTipsStyle}>
            <Button onClick={handleShowAllTipsClick} type="back">
              Afficher d'autres astuces
            </Button>
          </div> : null}
      </div>
    </VisibilitySensor>
  </div>
}
TipsList.propTypes = {
  advice: PropTypes.object.isRequired,
  project: PropTypes.object.isRequired,
  style: PropTypes.object,
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
  return <div style={style}>{children}</div>
}
const AppearingComponent = React.memo(AppearingComponentBase)


export default React.memo(TipsList)
