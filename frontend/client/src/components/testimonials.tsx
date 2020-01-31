import _memoize from 'lodash/memoize'
import PropTypes from 'prop-types'
import React, {useMemo} from 'react'
import {WithTranslation, useTranslation, withTranslation} from 'react-i18next'

import {Trans} from 'components/i18n'
import {LoginButton} from 'components/login'
import {isMobileVersion} from 'components/mobile'
import {Img, MAX_CONTENT_WIDTH, MIN_CONTENT_PADDING, SmoothTransitions} from 'components/theme'
import manImage from 'images/man-icon.svg'
import womanImage from 'images/woman-icon.svg'


interface TestimonialsProps {
  cardStyle?: React.CSSProperties
  carouselAutoRotationDurationMs: number
  children: ReactStylableElement[]
}


interface TestimonialsState {
  isTransitionBlocked: boolean
  previousTestimonial?: ReactStylableElement
  previousTestimonialIndex: number
  shownTestimonial: ReactStylableElement
  shownTestimonialIndex: number
}


const bulletStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, .6)',
  borderRadius: 6,
  cursor: 'pointer',
  display: 'inline-block',
  height: 6,
  margin: 4,
  width: 6,
}

const selectedBulletStyle: React.CSSProperties = {
  ...bulletStyle,
  backgroundColor: '#fff',
}


class Testimonials extends React.PureComponent<TestimonialsProps, TestimonialsState> {
  public static propTypes = {
    cardStyle: PropTypes.object,
    carouselAutoRotationDurationMs: PropTypes.number.isRequired,
    children: PropTypes.arrayOf(PropTypes.node.isRequired).isRequired,
  }

  public static defaultProps = {
    carouselAutoRotationDurationMs: 5000,
  }

  public state: TestimonialsState = {
    isTransitionBlocked: false,
    previousTestimonial: undefined,
    previousTestimonialIndex: 0,
    shownTestimonial: this.getStyledTestimonial(0),
    shownTestimonialIndex: 0,
  }

  public componentDidMount(): void {
    this.resetRotationTimer()
  }

  public componentWillUnmount(): void {
    clearInterval(this.interval)
    clearTimeout(this.timeout)
  }

  private interval?: number

  private timeout?: number

  private getStyledTestimonial(index: number): ReactStylableElement {
    const {cardStyle, children} = this.props
    const style = {
      margin: 'auto',
      ...cardStyle,
    }
    return React.cloneElement(children[index], {style}) || null
  }

  private resetRotationTimer(): void {
    const {carouselAutoRotationDurationMs} = this.props
    clearInterval(this.interval)
    this.interval = window.setInterval(
      this.handlePickTestimonial(this.state.shownTestimonialIndex + 1),
      carouselAutoRotationDurationMs)
  }

  private handlePickTestimonial = _memoize((index, isManuallyPicked?): (() => void) => (): void => {
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
    }, (): void => {
      clearTimeout(this.timeout)
      this.timeout = window.setTimeout((): void => this.setState({isTransitionBlocked: false}), 0)
    })
  }, (index, isManuallyPicked): string => (isManuallyPicked ? '!' : '') + index)

  private renderBullets(): React.ReactNode {
    const {children} = this.props
    const containerStyle: React.CSSProperties = {
      marginBottom: 0,
      padding: 0,
      textAlign: 'center',
    }
    return <ol style={containerStyle}>
      {children.map((card, i): React.ReactNode => <li
        key={'bullet-' + i} onClick={this.handlePickTestimonial(i, true)}
        style={i === this.state.shownTestimonialIndex ? selectedBulletStyle : bulletStyle} />)}
    </ol>
  }

  public render(): React.ReactNode {
    const {isTransitionBlocked, previousTestimonial, previousTestimonialIndex,
      shownTestimonial, shownTestimonialIndex} = this.state
    const style: React.CSSProperties = {
      height: 200,
      margin: 'auto',
      overflow: 'hidden',
      padding: isMobileVersion ? '45px 30px 10px' : '30px 100px 10px',
      position: 'relative',
    }
    const containerStyle: React.CSSProperties = {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      ...SmoothTransitions,
    }
    const leavingStyle: React.CSSProperties = {
      opacity: isTransitionBlocked ? 1 : 0,
      transform: `translateX(${isTransitionBlocked ? '0' : '-500px'})`,
      ...containerStyle,
    }
    const arrivingStyle: React.CSSProperties = {
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


interface CardProps extends WithTranslation {
  author: {
    age?: number
    imageLink?: string
    isMan?: boolean
    jobName?: string
    name: string
  }
  children: React.ReactNode
  isLong?: boolean
  style?: React.CSSProperties
}


const TestimonialCardBase: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {author, children, isLong, style, t} = props
  const horizontalPadding = isMobileVersion && !isLong ? 30 : 75
  const containerStyle = useMemo((): React.CSSProperties => ({
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
    ...style,
  }), [horizontalPadding, isLong, style])
  const authorStyle = useMemo((): React.CSSProperties => ({
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
  }), [author.imageLink, horizontalPadding, isLong])
  const authorPicto = <Img
    style={{height: 'auto', marginRight: 15, maxHeight: 100, maxWidth: 100, width: 'auto'}}
    src={author.imageLink ? author.imageLink : author.isMan ? manImage : womanImage}
    fallbackSrc={author.isMan ? manImage : womanImage}
    // We don't always have the isMan flag, so we cannot say for sure when it's a woman.
    alt={author.name || author.isMan ? 'homme' : ''} />

  const authorName = author.age || author.jobName ? `${author.name},` : author.name
  const authorAge = author.age ? t(' {{age}} ans', {age: author.age}) : ''
  const authorJobName = author.jobName ? `${author.jobName}` : ''

  return <div style={containerStyle}>
    {isLong ?
      <div style={authorStyle}>
        {authorPicto} {authorName}{authorAge}<br />{authorJobName}
      </div> : null}
    {children}
    {isLong ? null : <div style={authorStyle}> {authorName}{authorAge} {authorJobName}</div>}
  </div>
}
TestimonialCardBase.propTypes = {
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

const TestimonialCard = withTranslation()(TestimonialCardBase)


interface SectionProps {
  children: readonly React.ReactElement<{author: {name: string}}>[]
  maxShown?: number
  visualElement?: string
}


const sectionStyle: React.CSSProperties = {
  backgroundColor: colors.BOB_BLUE,
  flexDirection: 'column',
  padding: isMobileVersion ? '50px 20px' : `50px ${MIN_CONTENT_PADDING}px`,
}
const titleStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: 33,
  margin: 0,
  textAlign: 'center',
}
const containerStyle: React.CSSProperties = {
  alignItems: 'flex-start',
  display: 'flex',
  flexDirection: isMobileVersion ? 'column' : 'row',
  margin: '100px auto 0',
  maxWidth: isMobileVersion ? 320 : MAX_CONTENT_WIDTH,
}


// TODO(pascal): Move to the static_advice folder.
// i18next-extract-mark-ns-start staticAdvice
const TestimonialStaticSectionBase: React.FC<SectionProps> =
(props: SectionProps): React.ReactElement => {
  // TODO(cyrille): Use Carousel 3 by 3 on Desktop.
  const {children, maxShown = isMobileVersion ? 5 : 3, visualElement} = props
  const {t} = useTranslation('staticAdvice')
  const firstHelped = useMemo(
    (): string => children.slice(0, 2).map(({props: {author: {name}}}): string => name).join(', '),
    [children],
  )

  return <section style={sectionStyle}>
    <Trans style={titleStyle} t={t} parent="h2">
      {{productName: config.productName}} a aidé {{names: firstHelped}} et bien d'autres...<br />
      Pourquoi pas vous&nbsp;?
    </Trans>
    <div style={containerStyle}>
      {children.slice(0, maxShown)}
    </div>
    <LoginButton style={{display: 'block', margin: '88px auto 0'}} isSignUp={true}
      type="validation"
      visualElement={`testimonials${visualElement ? `-${visualElement}` : ''}`}>
      {t('Obtenir mes conseils personnalisés')}
    </LoginButton>
  </section>
}
TestimonialStaticSectionBase.propTypes = {
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
const TestimonialStaticSection = React.memo(TestimonialStaticSectionBase)
// i18next-extract-mark-ns-stop staticAdvice


export {TestimonialCard, Testimonials, TestimonialStaticSection}
