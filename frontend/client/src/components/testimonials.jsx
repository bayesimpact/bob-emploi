import React from 'react'
import PropTypes from 'prop-types'

import {LoginButton} from 'components/login'
import {isMobileVersion} from 'components/mobile'
import {MAX_CONTENT_WIDTH, MIN_CONTENT_PADDING, SmoothTransitions} from 'components/theme'
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

  state = {
    isTransitionBlocked: false,
    previousTestimonial: null,
    previousTestimonialIndex: 0,
    shownTestimonial: this.getStyledTestimonial(0),
    shownTestimonialIndex: 0,
  }

  componentDidMount() {
    this.resetRotationTimer()
  }

  componentWillUnmount() {
    clearInterval(this.interval)
    clearTimeout(this.timeout)
  }

  getStyledTestimonial(index) {
    const {cardStyle, children} = this.props
    const style = {
      margin: 'auto',
      ...cardStyle,
    }
    return React.cloneElement(children[index], {style}) || null
  }

  resetRotationTimer() {
    const {carouselAutoRotationDurationMs} = this.props
    clearInterval(this.interval)
    this.interval = setInterval(
      () => this.pickTestimonial(this.state.shownTestimonialIndex + 1),
      carouselAutoRotationDurationMs)
  }

  pickTestimonial = (index, isManuallyPicked) => {
    const {children} = this.props
    const shownTestimonialIndex = (index + children.length) % children.length
    if (isManuallyPicked) {
      this.resetRotationTimer()
    }
    if (shownTestimonialIndex === this.state.shownTestimonialIndex) {
      return
    }
    this.setState({
      isTransitionBlocked: true,
      previousTestimonial: this.state.shownTestimonial,
      previousTestimonialIndex: this.state.shownTestimonialIndex,
      shownTestimonial: this.getStyledTestimonial(shownTestimonialIndex) || null,
      shownTestimonialIndex,
    }, () => {
      clearTimeout(this.timeout)
      this.timeout = setTimeout(() => this.setState({isTransitionBlocked: false}), false)
    })
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
    const {isTransitionBlocked, previousTestimonial, previousTestimonialIndex,
      shownTestimonial, shownTestimonialIndex} = this.state
    const style = {
      height: 200,
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
      imageLink: PropTypes.string,
      isMan: PropTypes.bool,
      jobName: PropTypes.string,
      name: PropTypes.string.isRequired,
    }).isRequired,
    children: PropTypes.node,
    isLong: PropTypes.bool,
    style: PropTypes.object,
  }

  render() {
    const {author, children, isLong} = this.props
    const horizontalPadding = isMobileVersion && !isLong ? 30 : 75
    const style = {
      backgroundColor: '#fff',
      borderRadius: 5,
      boxShadow: '0 25px 40px 0 rgba(0, 0, 0, 0.15)',
      color: isLong ? colors.DARK : colors.DARK_TWO,
      fontSize: isLong ? 16 : 18,
      lineHeight: 1.44,
      margin: isLong ? '10px 10px' : 'initial',
      maxWidth: isLong ? 320 : 600,
      minHeight: isLong ? 'initial' : 150,
      padding: isMobileVersion || isLong ? '30px 30px' : `40px ${horizontalPadding}px`,
      position: isLong ? 'initial' : 'relative',
      ...this.props.style,
    }
    const authorStyle = {
      alignItems: 'center',
      backgroundColor: isLong ? colors.VERY_LIGHT_BLUE : 'initial',
      borderTopLeftRadius: isLong ? 5 : 'initial',
      borderTopRightRadius: isLong ? 5 : 'initial',
      color: isLong ? 'inherit' : '#fff',
      display: 'flex',
      fontSize: 14,
      fontStyle: isLong ? 'initial' : 'italic',
      justifyContent: isLong ? 'initial' : 'center',
      left: 0,
      margin: isLong ? '-30px -30px 20px -30px' : '15px 0 0',
      minHeight: isLong ? 85 : 'initial',
      padding: isLong ? author.imageLink ? '10px 30px' : '0 30px' : `0 ${horizontalPadding}px`,
      position: isLong ? 'initial' : 'absolute',
      right: 0,
      top: isLong ? 'initial' : '100%',
    }
    const authorPicto = <img
      style={{height: 'auto', marginRight: 15, maxHeight: 100, maxWidth: 100, width: 'auto'}}
      src={author.imageLink ? author.imageLink : author.isMan ? manImage : womanImage}
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
      {isLong ? null : <div style={authorStyle}> {authorName}{authorAge} {authorJobName}</div>}
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

  render() {
    // TODO(cyrille): Use Carousel 3 by 3 on Desktop.
    const {children, maxShown = isMobileVersion ? 5 : 3, visualElement} = this.props
    const sectionStyle = {
      backgroundColor: colors.BOB_BLUE,
      flexDirection: 'column',
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
      margin: '100px auto 0',
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
