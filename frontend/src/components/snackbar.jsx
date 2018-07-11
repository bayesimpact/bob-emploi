import _omit from 'lodash/omit'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {hideToasterMessageAction} from 'store/actions'

import {isMobileVersion} from 'components/mobile'
import {OutsideClickHandler} from './theme'


class SnackbarBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    snack: PropTypes.node,
    style: PropTypes.object,
    timeoutMillisecs: PropTypes.number.isRequired,
  }

  state = {
    isVisible: false,
    nextSnacks: [],
    snack: null,
  }

  componentDidMount() {
    this.componentDidUpdate({snack: null}, {isVisible: false})
  }

  componentDidUpdate({snack: previousSnack}, {isVisible: wasVisible}) {
    const {snack, timeoutMillisecs} = this.props
    const {isVisible, nextSnacks, snack: visibleSnack} = this.state

    // Start timer just after isVisible becomes true.
    if (isVisible && !wasVisible) {
      clearTimeout(this.timer)
      this.timer = setTimeout(this.hide, timeoutMillisecs)
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

  componentWillUnmount() {
    clearTimeout(this.timer)
  }

  hide = () => {
    if (!this.state.isVisible) {
      return
    }
    clearTimeout(this.timer)
    this.setState({isVisible: false})
    this.props.dispatch(hideToasterMessageAction)
  }

  handleTransitionEnd = () => {
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

  render() {
    const {snack, isVisible} = this.state
    const {style, ...otherProps} = this.props
    const containerStyle = {
      bottom: 0,
      display: 'flex',
      height: snack ? 'initial' : 0,
      justifyContent: 'center',
      left: 0,
      position: 'fixed',
      right: 0,
      zIndex: 999,
    }
    const labelStyle = {
      color: '#fff',
      fontSize: 14,
      lineHeight: '24px',
    }
    const snackStyle = {
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
    return <OutsideClickHandler
      onOutsideClick={this.hide}
      style={containerStyle}
      {..._omit(otherProps, ['dispatch', 'snack', 'timeoutMillisecs'])}
    >
      <div
        style={{...snackStyle, ...(style || {})}}
        onTransitionEnd={this.handleTransitionEnd}
      >
        <span style={labelStyle}>{snack}</span>
      </div>
    </OutsideClickHandler>
  }

}
const Snackbar = connect(({asyncState}) => ({
  snack: asyncState.errorMessage,
}))(SnackbarBase)


export {Snackbar}
