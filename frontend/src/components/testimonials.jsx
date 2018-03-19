import React from 'react'
import PropTypes from 'prop-types'

import config from 'config'

import {LoginButton} from 'components/login'
import {Colors, MAX_CONTENT_WIDTH, MIN_CONTENT_PADDING, SmoothTransitions} from 'components/theme'
import manImage from 'images/man-icon.svg'
import womanImage from 'images/woman-icon.svg'


class Testimonials extends React.Component {
  static propTypes = {
    cardStyle: PropTypes.object,
    carouselAutoRotationDurationMs: PropTypes.number.isRequired,
    children: PropTypes.arrayOf(PropTypes.node.isRequired).isRequired,
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
      backgroundColor: isSelected ? '#fff' : 'rgba(255, 255, 255, .6)',
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
        {previousTestimonialIndex === shownTestimonialIndex ? null : <div
          style={leavingStyle} key={previousTestimonialIndex}>
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
    author: PropTypes.shape({
      age: PropTypes.number,
      isMan: PropTypes.bool,
      jobName: PropTypes.string,
      name: PropTypes.string.isRequired,
    }).isRequired,
    children: PropTypes.node,
    isLong: PropTypes.bool,
    style: PropTypes.object,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {author, children, isLong} = this.props
    const {isMobileVersion} = this.context
    const horizontalPadding = isMobileVersion && !isLong ? 30 : 75
    const style = {
      backgroundColor: '#fff',
      borderRadius: isLong ? 5 : 10,
      boxShadow: isLong ? '0 25px 40px 0 rgba(0, 0, 0, 0.15)' : 'initial',
      color: isLong ? Colors.DARK : Colors.DARK_TWO,
      fontSize: isLong ? 16 : 18,
      fontStyle: isLong ? 'normal' : 'italic',
      lineHeight: 1.44,
      margin: isLong ? isMobileVersion ? '10px 10px' : '50px 10px' : 'initial',
      maxWidth: isLong ? 320 : 600,
      minHeight: isLong ? 'initial' : 280,
      padding: isMobileVersion || isLong ? '30px 30px' : `60px ${horizontalPadding}px 0`,
      position: isLong ? 'initial' : 'relative',
      ...this.props.style,
    }
    const authorStyle = {
      alignItems: 'center',
      backgroundColor: isLong ? Colors.VERY_LIGHT_BLUE : 'inherited',
      borderTopLeftRadius: isLong ? 5 : 'inherited',
      borderTopRightRadius: isLong ? 5 : 'inherited',
      bottom: isLong ? 'initial' : 50,
      color: isLong ? 'inherited' : Colors.DARK,
      display: 'flex',
      fontSize: 14,
      fontStyle: 'initial',
      fontWeight: isLong ? 'initial' : 500,
      left: 0,
      margin: isLong ? '-30px -30px 20px -30px' : 'initial',
      minHeight: isLong ? 85 : 'initial',
      padding: isLong ? '0 30px' : `0 ${horizontalPadding}px`,
      position: isLong ? 'initial' : 'absolute',
    }
    const authorPicto = <img
      style={{marginRight: 15}} src={author.isMan ? manImage : womanImage}
      alt={author.isMan ? 'homme' : 'femme'} />

    const authorName = author.age || author.jobName ? `${author.name},` : author.name
    const authorAge = author.age ? ` ${author.age} ans` : ''
    const authorJobName = author.jobName ? `${author.jobName}` : ''

    return <div style={style}>
      {isLong ?
        <div style={authorStyle}>
          {authorPicto} {authorName}{authorAge}<br />{authorJobName}
        </div> : null}
      {children}
      {isLong ? null : <div style={authorStyle}>
        {authorPicto} {authorName}{authorAge} {authorJobName}</div>}
    </div>
  }
}


class TestimonialStaticSection extends React.Component {
  static propTypes = {
    children: PropTypes.arrayOf(PropTypes.shape({
      props: PropTypes.shape({
        author: PropTypes.shape({
          name: PropTypes.string.isRequired,
        }),
      }),
    })).isRequired,
    maxShown: PropTypes.number,
    visualElement: PropTypes.string,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {isMobileVersion} = this.context
    // TODO(cyrille): Use Carousel 3 by 3 on Desktop.
    const {children, maxShown = isMobileVersion ? 5 : 3, visualElement} = this.props
    const sectionStyle = {
      backgroundColor: Colors.BOB_BLUE,
      flexDirection: 'column',
      fontFamily: 'Lato, Helvetica',
      padding: isMobileVersion ? '50px 20px' : `50px ${MIN_CONTENT_PADDING}px`,
    }
    const titleStyle = {
      color: '#fff',
      fontSize: 33,
      margin: 0,
      textAlign: 'center',
    }
    const containerStyle = {
      alignItems: 'flex-start',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      margin: '55px auto 0',
      maxWidth: isMobileVersion ? 320 : MAX_CONTENT_WIDTH,
    }
    const firstHelped = children.slice(0, 2).map(({props: {author: {name}}}) => name).join(', ')

    return <section style={sectionStyle}>
      <h2 style={titleStyle}>
        {config.productName} a aidé {firstHelped} et bien d'autres...<br />
        Pourquoi pas vous&nbsp;?
      </h2>
      <div style={containerStyle}>
        {children.slice(0, maxShown)}
      </div>
      <LoginButton style={{display: 'block', margin: '88px auto 0'}} isSignUpButton={true}
        type="validation"
        visualElement={`testimonials${visualElement ? `-${visualElement}` : ''}`}>
        Obtenir mes conseils personnalisés
      </LoginButton>
    </section>
  }
}

export {TestimonialCard, Testimonials, TestimonialStaticSection}
