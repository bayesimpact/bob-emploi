import React from 'react'
import PropTypes from 'prop-types'
import Radium from 'radium'
import {connect} from 'react-redux'

import {likeOrDislikeFeature} from 'store/actions'

import {Colors, Icon, SmoothTransitions} from './theme'


class LikeDislikeButtonsBase extends React.Component {
  static propTypes = {
    // Will show dislike if negative, like if positive and neutral if 0.
    likeScore: PropTypes.number,
    onChange: PropTypes.func,
    style: PropTypes.object,
  }

  componentWillMount() {
    this.setState({likeScore: this.props.likeScore})
  }

  componentWillReceiveProps(nextProps) {
    const {likeScore} = nextProps
    if (likeScore !== this.props.likeScore) {
      this.setState({likeScore})
    }
  }

  getLikeScoreSetter = likeScore => () => {
    const {onChange} = this.props
    if (this.state.likeScore === likeScore) {
      likeScore = 0
    }
    this.setState({likeScore})
    onChange && onChange(likeScore)
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {likeScore, onChange, style, ...extraProps} = this.props
    const borderColor = this.state.likeScore ? Colors.SKY_BLUE : Colors.SILVER
    const containerStyle = {
      ':hover': {
        color: Colors.COOL_GREY,
      },
      backgroundColor: '#fff',
      border: 'solid 1px',
      borderRadius: 3,
      color: borderColor,
      display: 'flex',
      ...SmoothTransitions,
      ...style,
    }
    const buttonStyle = {
      alignItems: 'center',
      cursor: 'pointer',
      display: 'flex',
      height: 30,
      justifyContent: 'center',
      width: 30,
    }
    const selectedStyle = score => ({
      backgroundColor: score > 0 ? Colors.SKY_BLUE : 'initial',
      color: score > 0 ? '#fff' : Colors.PINKISH_GREY,
    })
    const likeStyle = {
      ...buttonStyle,
      borderRight: `solid 1px ${borderColor}`,
      ...selectedStyle(this.state.likeScore),
    }
    const dislikeStyle = {
      ...buttonStyle,
      ...selectedStyle(-this.state.likeScore),
    }
    return <div style={containerStyle} {...extraProps}>
      <Icon
          name="thumb-up" style={likeStyle}
          onClick={this.getLikeScoreSetter(1)} />
      <Icon
          name="thumb-down" style={dislikeStyle}
          onClick={this.getLikeScoreSetter(-1)} />
    </div>
  }
}
const LikeDislikeButtons = Radium(LikeDislikeButtonsBase)


class FeatureLikeDislikeButtonsBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    feature: PropTypes.string.isRequired,
    likes: PropTypes.object.isRequired,
  }

  change = likeScore => {
    const {dispatch, feature} = this.props
    dispatch(likeOrDislikeFeature(feature, likeScore))
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {dispatch, feature, likes, ...extraProps} = this.props
    return <LikeDislikeButtons
        likeScore={likes[feature] || 0}
        onChange={this.change}
        {...extraProps} />
  }
}
const FeatureLikeDislikeButtons =
  connect(({user}) => ({likes: user.likes || {}}))(FeatureLikeDislikeButtonsBase)


export {FeatureLikeDislikeButtons, LikeDislikeButtons}
