import _memoize from 'lodash/memoize'
import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import VisibilitySensor from 'react-visibility-sensor'

import {DispatchAllActions, RootState, getAdviceTips, showAllTips} from 'store/actions'
import {getAdviceGoal} from 'store/advice'
import {YouChooser} from 'store/french'

import {Action, ActionDescriptionModal} from 'components/actions'
import {Button, PaddedOnMobile} from 'components/theme'

const DEFAULT_TIPS_SHOWN = 5

// Delay between showing two tips in ms.
const DELAY_BETWEEN_TIPS = 150


interface TipsListConnectedProps {
  tips: bayes.bob.Action[]
}


interface TipsListOwnProps {
  advice?: bayes.bob.Advice
  project?: bayes.bob.Project
  style?: React.CSSProperties
  userYou: YouChooser
}


interface TipsListProps extends TipsListConnectedProps, TipsListOwnProps {
  dispatch: DispatchAllActions
}


interface TipsListState {
  numTipsShown: number
  openTip: bayes.bob.Action & {actionId: string}
}


class TipsListBase extends React.PureComponent<TipsListProps, TipsListState> {
  public static propTypes = {
    advice: PropTypes.object,
    dispatch: PropTypes.func.isRequired,
    project: PropTypes.object,
    style: PropTypes.object,
    tips: PropTypes.arrayOf(PropTypes.object.isRequired).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public state: TipsListState = {
    numTipsShown: 0,
    openTip: null,
  }

  public componentDidMount(): void {
    const {advice, dispatch, project, tips} = this.props
    if (advice && project && !tips.length) {
      dispatch(getAdviceTips(project, advice))
      return
    }
  }

  private timeout: ReturnType<typeof setTimeout>

  private handleOpenTip = _memoize((tip): (() => void) => (): void =>
    this.setState({openTip: tip}), ({actionId}): string => actionId)

  private handleShowAllTipsClick = (numberTips: number): (() => void) => (): void => {
    const {advice, dispatch, project} = this.props
    dispatch(showAllTips(project, advice))
    this.showNTips(numberTips)
  }

  private showNTips = (totalNumberOfTips: number): void => {
    const {numTipsShown} = this.state
    if (numTipsShown >= totalNumberOfTips) {
      return
    }
    this.setState({numTipsShown: numTipsShown + 1})
    clearTimeout(this.timeout)
    this.timeout = setTimeout((): void => {
      this.showNTips(totalNumberOfTips)
    }, DELAY_BETWEEN_TIPS)
  }

  private showDefaultTips = (): void => {
    this.showNTips(DEFAULT_TIPS_SHOWN)
  }

  private handleCloseTip = (): void => this.setState({openTip: null})

  public render(): React.ReactNode {
    const {advice, style, userYou, tips} = this.props
    const {numTipsShown, openTip} = this.state
    if (!advice) {
      return null
    }
    if (!tips.length) {
      return <div style={style} />
    }
    const titleStyle = {
      color: colors.CHARCOAL_GREY,
      fontSize: 16,
      marginBottom: 10,
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
        onClose={this.handleCloseTip}
        isShown={!!openTip}
        userYou={userYou} />
      <div style={titleStyle}>
        <PaddedOnMobile>
          Voici quelques astuces pour {getAdviceGoal(advice, userYou)}&nbsp;:
        </PaddedOnMobile>
      </div>
      <VisibilitySensor
        active={numTipsShown === 0} intervalDelay={250} delayedCall={true} partialVisibility={true}
        onChange={this.showDefaultTips}>
        <div>
          {tipsShown.map((tip): React.ReactNode => <AppearingComponent key={tip.actionId}><Action
            action={tip}
            onOpen={this.handleOpenTip(tip)} /></AppearingComponent>)}
          {(numTipsShown === DEFAULT_TIPS_SHOWN && tips.length > DEFAULT_TIPS_SHOWN) ?
            <div style={showMoreTipsStyle}>
              <Button onClick={this.handleShowAllTipsClick(tips.length)} type="back">
                Afficher d'autres astuces
              </Button>
            </div> : null}
        </div>
      </VisibilitySensor>
    </div>
  }
}
const TipsList = connect(
  (
    {app: {adviceTips}}: RootState,
    {advice: {adviceId = ''} = {}, project: {projectId = ''} = {}}: TipsListOwnProps,
  ): TipsListConnectedProps => ({
    tips: (adviceTips[projectId] || {})[adviceId] || [],
  }))(TipsListBase)


class AppearingComponent
  extends React.PureComponent<{children: React.ReactNode}, {opacity: number}> {
  public static propTypes = {
    children: PropTypes.node,
  }

  public state = {
    opacity: 0,
  }

  public componentDidMount(): void {
    this.timeout = setTimeout((): void => this.setState({opacity: 1}), 100)
  }

  public componentWillUnmount(): void {
    clearTimeout(this.timeout)
  }

  private timeout: ReturnType<typeof setTimeout>

  public render(): React.ReactNode {
    const style = {
      opacity: this.state.opacity,
      transition: 'opacity 300ms ease-in 300ms',
    }
    return <div style={style}>{this.props.children}</div>
  }
}


export {TipsList}
