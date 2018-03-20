import omit from 'lodash/omit'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {hideToasterMessageAction} from 'store/actions'

import {OutsideClickHandler} from './theme'


class SnackbarBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    snack: PropTypes.node,
    style: PropTypes.object,
    timeoutMillisecs: PropTypes.number.isRequired,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  state = {
    isVisible: false,
    snack: null,
  }

  componentWillMount() {
    if (this.props.snack) {
      this.showSnack(this.props.snack)
    }
  }

  componentWillReceiveProps(nextProps) {
    const {snack} = this.props
    const nextSnack = nextProps.snack
    if (nextSnack && snack !== nextSnack) {
      // A new snack wants to be shown. Show it!
      this.showSnack(nextSnack)
    } else if (!nextSnack && snack) {
      // The current snack has been removed. Hide it!
      this.hideSnack()
    }
  }

  componentWillUnmount() {
    this.clearDismissTimer()
  }

  showSnack = (snack) => {
    const {dispatch, timeoutMillisecs} = this.props
    this.hideSnack().then(() => {
      this.setState({
        isVisible: false,
        snack,
      })
      this.showSnackTimer = setTimeout(() => {
        this.setState({
          isVisible: true,
        })
        this.snackTimer = setTimeout(() => {
          dispatch(hideToasterMessageAction)
        }, timeoutMillisecs)
      }, 1)
    })
  }

  hideSnack = () => {
    if (!this.state.snack) {
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      this.clearDismissTimer()
      this.setState({
        isVisible: false,
      })
      this.afterTransition = () => {
        this.setState({
          snack: null,
        }, resolve)
      }
    })
  }

  clearDismissTimer = () => {
    clearTimeout(this.snackTimer)
    clearTimeout(this.showSnackTimer)
    this.snackTimer = null
    this.showSnackTimer = null
  }

  transitionEndHandler = () => {
    if (this.afterTransition) {
      this.afterTransition()
      this.afterTransition = null
    }
  }

  render() {
    const {snack, isVisible} = this.state
    if (!snack) {
      return null
    }
    const {isMobileVersion} = this.context
    const {dispatch, style, ...otherProps} = this.props
    const containerStyle = {
      bottom: 0,
      display: 'flex',
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
    return (
      <OutsideClickHandler
        onOutsideClick={() => dispatch(hideToasterMessageAction)}
        style={containerStyle}
        {...omit(otherProps, ['snack', 'timeoutMillisecs'])}
      >
        <div
          style={{...snackStyle, ...(style || {})}}
          onTransitionEnd={this.transitionEndHandler}
        >
          <span style={labelStyle}>{snack}</span>
        </div>
      </OutsideClickHandler>
    )
  }

}
const Snackbar = connect(({asyncState}) => ({
  snack: asyncState.errorMessage,
}))(SnackbarBase)


export {Snackbar}
