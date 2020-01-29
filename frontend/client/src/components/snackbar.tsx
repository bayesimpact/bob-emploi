import PropTypes from 'prop-types'
import React from 'react'

import {isMobileVersion} from 'components/mobile'
import {OutsideClickHandler} from './theme'


interface SnackbarProps {
  onHide: () => void
  snack?: React.ReactNode
  style?: React.CSSProperties
  timeoutMillisecs: number
}


interface SnackbarState {
  isVisible: boolean
  nextSnacks: readonly React.ReactNode[]
  snack?: React.ReactNode
}


class Snackbar extends React.PureComponent<SnackbarProps, SnackbarState> {
  public static propTypes = {
    onHide: PropTypes.func.isRequired,
    snack: PropTypes.node,
    style: PropTypes.object,
    timeoutMillisecs: PropTypes.number.isRequired,
  }

  public state: SnackbarState = {
    isVisible: false,
    nextSnacks: [],
  }

  public componentDidMount(): void {
    this.componentDidUpdate({}, {isVisible: false})
  }

  public componentDidUpdate(
    {snack: previousSnack}: Pick<SnackbarProps, 'snack'>,
    {isVisible: wasVisible}: Pick<SnackbarState, 'isVisible'>): void {
    const {snack, timeoutMillisecs} = this.props
    const {isVisible, nextSnacks, snack: visibleSnack} = this.state

    // Start timer just after isVisible becomes true.
    if (isVisible && !wasVisible) {
      clearTimeout(this.timer)
      this.timer = window.setTimeout(this.hide, timeoutMillisecs)
    }

    // Handle new snack content.
    if (snack && previousSnack !== snack) {
      if (!isVisible && !visibleSnack && !nextSnacks.length) {
        this.setState({isVisible: true, snack})
        return
      }
      this.setState({nextSnacks: nextSnacks.concat([snack])})
    }
  }

  public componentWillUnmount(): void {
    clearTimeout(this.timer)
  }

  private timer?: number

  private hide = (): void => {
    if (!this.state.isVisible) {
      return
    }
    clearTimeout(this.timer)
    this.setState({isVisible: false})
    this.props.onHide()
  }

  private handleTransitionEnd = (): void => {
    const {isVisible, nextSnacks, snack} = this.state
    if (isVisible) {
      return
    }
    if (snack) {
      const nextSnack = nextSnacks.length && nextSnacks[0]
      this.setState({
        isVisible: !!nextSnack,
        nextSnacks: nextSnacks.slice(1),
        snack: nextSnack || null,
      })
    } else {
      this.setState({snack: null})
    }
  }

  public render(): React.ReactNode {
    const {snack, isVisible} = this.state
    const {onHide: omittedOnHide, snack: omittedSnack, style,
      timeoutMillisecs: omittedTimeoutMillisecs, ...otherProps} = this.props
    const containerStyle: React.CSSProperties = {
      bottom: 0,
      display: 'flex',
      height: snack ? 'initial' : 0,
      justifyContent: 'center',
      left: 0,
      position: 'fixed',
      right: 0,
      zIndex: 999,
    }
    const labelStyle: React.CSSProperties = {
      color: '#fff',
      fontSize: 14,
      lineHeight: '24px',
    }
    const snackStyle: React.CSSProperties = {
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      borderRadius: isMobileVersion ? 'initial' : '2px',
      maxWidth: 'calc(100% - 48px)',
      minWidth: 288,
      padding: '13px 24px',
      transform: isVisible ? 'translate(0, 0)' : 'translate(0, 100%)',
      transition: 'transform 200ms ease-out',
      width: isMobileVersion ? 'calc(100% - 48px)' : 'auto',
      willChange: 'transform',
    }
    return <OutsideClickHandler onOutsideClick={this.hide} style={containerStyle} {...otherProps}>
      <div
        style={{...snackStyle, ...(style || {})}}
        onTransitionEnd={this.handleTransitionEnd}
      >
        <span style={labelStyle}>{snack}</span>
      </div>
    </OutsideClickHandler>
  }
}


export {Snackbar}
