import React from 'react'
import PropTypes from 'prop-types'

import manImage from 'images/man-icon.svg'
import womanImage from 'images/woman-icon.svg'
import {Colors, SmoothTransitions} from 'components/theme'


class Testimonials extends React.Component {
  static propTypes = {
    cardStyle: PropTypes.object,
    carouselAutoRotationDurationMs: PropTypes.number.isRequired,
    children: PropTypes.arrayOf(PropTypes.instanceOf(TestimonialCard).isRequired).isRequired,
  }
  static defaultProps = {
    carouselAutoRotationDurationMs: 5000,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  state = {
    isTransitionBlocked: false,
    previousTestimonial: null,
    shownTestimonial: null,
    shownTestimonialIndex: -1,
  }

  componentWillMount() {
    this.pickTestimonial(0)
    this.resetRotationTimer()
  }

  componentWillUnmount() {
    clearInterval(this.interval)
  }

  resetRotationTimer() {
    const {carouselAutoRotationDurationMs} = this.props
    clearInterval(this.interval)
    this.interval = setInterval(
      () => this.pickTestimonial(this.state.shownTestimonialIndex + 1),
      carouselAutoRotationDurationMs)
  }

  pickTestimonial = (index, isManullyPicked) => {
    const {cardStyle, children} = this.props
    const style = {
      margin: 'auto',
      ...cardStyle,
    }
    const styleTestimonial = testimonial => React.cloneElement(testimonial, {style})
    const shownTestimonialIndex = (index + children.length) % children.length
    if (isManullyPicked) {
      this.resetRotationTimer()
    }
    if (shownTestimonialIndex === this.state.shownTestimonialIndex) {
      return
    }
    this.setState({
      isTransitionBlocked: true,
      previousTestimonial: this.state.shownTestimonial,
      previousTestimonialIndex: this.state.shownTestimonialIndex,
      shownTestimonial: styleTestimonial(children[shownTestimonialIndex]) || null,
      shownTestimonialIndex,
    }, () => setTimeout(() => this.setState({isTransitionBlocked: false}), false))
  }

  renderBullets() {
    const {children} = this.props
    const containerStyle = {
      marginBottom: 0,
      padding: 0,
      textAlign: 'center',
    }
    const style = isSelected => ({
      backgroundColor: isSelected ? Colors.CHARCOAL_GREY : Colors.PINKISH_GREY,
      borderRadius: 6,
      cursor: 'pointer',
      display: 'inline-block',
      height: 6,
      margin: 4,
      width: 6,
    })
    return <ol style={containerStyle}>
      {children.map((card, i) => <li
          key={'bullet-' + i} style={style(i === this.state.shownTestimonialIndex)}
          onClick={() => this.pickTestimonial(i, true)} />)}
    </ol>
  }

  render() {
    const {isMobileVersion} = this.context
    const {isTransitionBlocked, previousTestimonial, previousTestimonialIndex,
      shownTestimonial, shownTestimonialIndex} = this.state
    const style = {
      height: 280,
      margin: 'auto',
      overflow: 'hidden',
      padding: isMobileVersion ? '45px 30px 10px' : '30px 100px 10px',
      position: 'relative',
    }
    const containerStyle = {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      ...SmoothTransitions,
    }
    const leavingStyle = {
      opacity: isTransitionBlocked ? 1 : 0,
      transform: `translateX(${isTransitionBlocked ? '0' : '-500px'})`,
      ...containerStyle,
    }
    const arrivingStyle = {
      opacity: isTransitionBlocked ? 0 : 1,
      transform: `translateX(${isTransitionBlocked ? '500px' : '0'})`,
      ...containerStyle,
    }
    return <div>
      <div style={style}>
        {previousTestimonialIndex === shownTestimonialIndex ? null :
        <div style={leavingStyle} key={previousTestimonialIndex}>
          {previousTestimonial}
        </div>}
        <div style={arrivingStyle} key={shownTestimonialIndex}>
          {shownTestimonial}
        </div>
      </div>
      {this.renderBullets()}
    </div>
  }
}




class TestimonialCard extends React.Component {
  static propTypes = {
    author: PropTypes.string.isRequired,
    children: PropTypes.node,
    isAuthorMan: PropTypes.bool,
    style: PropTypes.object,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {author, children, isAuthorMan} = this.props
    const {isMobileVersion} = this.context
    const horizontalPadding = isMobileVersion ? 30 : 75
    const style = {
      backgroundColor: '#fff',
      borderRadius: 10,
      color: Colors.DARK_TWO,
      fontSize: 18,
      fontStyle: 'italic',
      lineHeight: 1.44,
      maxWidth: 600,
      minHeight: 280,
      padding: isMobileVersion ? '30px 30px' : `60px ${horizontalPadding}px 0`,
      position: 'relative',
      ...this.props.style,
    }
    const authorStyle = {
      alignItems: 'center',
      bottom: 50,
      color: Colors.DARK,
      display: 'flex',
      fontSize: 14,
      fontStyle: 'initial',
      fontWeight: 500,
      left: 0,
      padding: `0 ${horizontalPadding}px`,
      position: 'absolute',
    }
    const authorPicto = <img style={{marginRight: 15}} src={isAuthorMan ? manImage : womanImage} />
    return <div style={style}>
      {children}
      <div style={authorStyle}>{authorPicto} {author}</div>
    </div>
  }
}


export {TestimonialCard, Testimonials}
