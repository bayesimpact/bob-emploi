import jsPDF from 'jspdf'
import _keyBy from 'lodash/keyBy'
import _mapValues from 'lodash/mapValues'
import _memoize from 'lodash/memoize'
import _sortBy from 'lodash/sortBy'
import DownloadIcon from 'mdi-react/DownloadIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import {connect} from 'react-redux'
import VisibilitySensor from 'react-visibility-sensor'

import {DispatchAllActions, RootState, changeSubmetricExpansion,
  fetchApplicationModes, followJobOffersLinkAction, openStatsPageAction} from 'store/actions'
import {clearEmoji, clearMarkup} from 'store/clean_text'
import {YouChooser, inDepartement, lowerFirstLetter, vouvoyer} from 'store/french'
import {getApplicationModeText, getApplicationModes, getIMTURL, getPEJobBoardURL} from 'store/job'
import {Score, ScoreComponent, colorFromPercent, computeBobScore} from 'store/score'

import categories from 'components/advisor/data/categories.json'
import {FastForward} from 'components/fast_forward'
import {isMobileVersion} from 'components/mobile'
import {BubbleToRead, Discussion, DiscussionBubble, NoOpElement,
  WaitingElement} from 'components/phylactery'
import {RadiumExternalLink} from 'components/radium'
import {Button, GrowingNumber, PercentBar, PieChart, Markdown,
  SmoothTransitions, UpDownIcon, colorToAlpha, colorToComponents} from 'components/theme'
import bobHeadImage from 'images/bob-head.svg'
import missingDiplomaImage from 'images/missing-diploma.png'
import strongCompetitionImage from 'images/strong-competition.svg'
import warningSignImage from 'images/warning-sign.svg'
import workTimeImage from 'images/50000_hours.png'

import {DiagnosticAdvices} from './advice'
import {Strategies} from './strategy'
import {BobModal, BobTalk} from './speech'


const categorySets = _mapValues(categories, (list: string[]): Set<string> => new Set(list))

const SECTION_COLOR = colorToAlpha(colors.DARK, .5)

const defaultDiagnosticSentences = (userYou: YouChooser): string => `Nous ne sommes pas encore
capable de ${userYou('te', 'vous')} proposer une analyse globale de ${userYou('ta', 'votre')}
situation. Certaines informations sur ${userYou('ton', 'votre')} marché ne sont pas encore
disponibles dans notre base de données.

Cependant, ${userYou('tu peux', 'vous pouvez')} déjà consulter les indicateurs ci-contre.

Pour obtenir une analyse de ${userYou('ton', 'votre')} profil,
${userYou(' tu peux', ' vous pouvez')} nous envoyer [un message](${config.helpRequestUrl}).

Un membre de l'équipe de ${config.productName} ${userYou("t'", 'vous ')}enverra un diagnostic
personnalisé.`

interface Gauge {
  gaugeDataURL?: string
  gaugeHeight?: number
  gaugeWidth?: number
}


// Convert an inline SVG in the DOM to an image.
// (Move to a common library if it's needed somewhere else).
function svg2image(svgDom, mimeType, qualityOption): Promise<Gauge> {
  if (!svgDom) {
    return Promise.resolve({})
  }

  const width = svgDom.width.baseVal ? svgDom.width.baseVal.value : svgDom.clientWidth
  const height = svgDom.height.baseVal ? svgDom.height.baseVal.value : svgDom.clientHeight

  const svg = svgDom.cloneNode(true)
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  if (!svg.getAttribute('width')) {
    // Required for Firefox to work.
    svg.setAttribute('width', `${width}px`)
    svg.setAttribute('height', `${height}px`)
  }
  const imageDataURL = 'data:image/svg+xml,' + encodeURIComponent(svg.outerHTML)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  return new Promise((resolve): void => {
    const image = new Image()
    image.onload = (): void => {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve({
        gaugeDataURL: canvas.toDataURL(mimeType, qualityOption),
        gaugeHeight: canvas.height,
        gaugeWidth: canvas.width,
      })
    }
    image.src = imageDataURL
  })
}


interface CircleProps {
  durationMillisec: number
  gaugeRef?: React.RefObject<SVGSVGElement>
  halfAngleDeg: number
  isAnimated: boolean
  percent: number
  radius: number
  scoreSize: number
  strokeWidth: number
  style?: React.CSSProperties & {
    marginBottom?: number
    marginLeft?: number
    marginRight?: number
    marginTop?: number
  }
}


class BobScoreCircle extends React.PureComponent<CircleProps, {hasStartedGrowing: boolean}> {
  public static propTypes = {
    durationMillisec: PropTypes.number.isRequired,
    gaugeRef: PropTypes.shape({
      current: PropTypes.object,
    }),
    halfAngleDeg: PropTypes.number.isRequired,
    // TODO(cyrille): Fix the non-animated version.
    isAnimated: PropTypes.bool.isRequired,
    percent: PropTypes.number.isRequired,
    radius: PropTypes.number.isRequired,
    scoreSize: PropTypes.number.isRequired,
    strokeWidth: PropTypes.number.isRequired,
    style: PropTypes.object,
  }

  public static defaultProps = {
    durationMillisec: 1000,
    halfAngleDeg: 67.4,
    isAnimated: true,
    radius: 78.6,
    scoreSize: 36.4,
    strokeWidth: 5.2,
  }

  public state = {
    hasStartedGrowing: !this.props.isAnimated,
  }

  private startGrowing = (isVisible: boolean): void => {
    if (!isVisible) {
      return
    }
    this.setState({hasStartedGrowing: true})
  }

  // Gives the point on the Bob score circle according to clockwise angle with origin at the bottom.
  private getPointFromAngle = (rad: number): {x: number; y: number} => {
    const {radius} = this.props
    const x = -radius * Math.sin(rad)
    const y = radius * Math.cos(rad)
    return {x, y}
  }

  private describeSvgArc = (startAngle: number, endAngle: number): string => {
    const {radius} = this.props
    const largeArcFlag = endAngle - startAngle <= Math.PI ? '0' : '1'
    const start = this.getPointFromAngle(startAngle)
    const end = this.getPointFromAngle(endAngle)
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`
  }

  public render(): React.ReactNode {
    const {
      durationMillisec,
      gaugeRef,
      halfAngleDeg,
      isAnimated,
      percent,
      radius,
      scoreSize,
      strokeWidth,
      style,
      ...extraProps
    } = this.props
    const {hasStartedGrowing} = this.state

    const startAngle = halfAngleDeg * Math.PI / 180
    const endAngle = 2 * Math.PI - startAngle
    const percentAngle = 2 * (Math.PI - startAngle) * percent / 100 + startAngle

    const largeRadius = radius + 3 * strokeWidth
    const totalWidth = 2 * largeRadius
    const totalHeight = largeRadius + strokeWidth + this.getPointFromAngle(startAngle).y

    const arcLength = radius * (percentAngle - startAngle)
    const percentPath = this.describeSvgArc(startAngle, percentAngle)
    const fullPath = this.describeSvgArc(startAngle, endAngle)
    const containerStyle: React.CSSProperties = {
      height: totalHeight,
      position: 'relative',
      width: totalWidth,
      ...style,
      marginBottom: (style && style.marginBottom || 0) - strokeWidth,
      marginLeft: (style && style.marginLeft || 0) + 20 - strokeWidth,
      marginRight: (style && style.marginRight || 0) + 20 - strokeWidth,
      marginTop: (style && style.marginTop || 0) - 3 * strokeWidth,
    }
    const percentStyle: React.CSSProperties = {
      display: 'flex',
      fontSize: scoreSize,
      fontWeight: 'bold',
      justifyContent: 'center',
      left: 0,
      lineHeight: '40px',
      marginRight: 'auto',
      position: 'absolute',
      right: 0,
      top: largeRadius, // center in circle, not in svg
      transform: 'translate(0, -50%)',
    }
    const percentColor = !hasStartedGrowing ? colors.RED_PINK : colorFromPercent(percent)
    const transitionStyle: React.CSSProperties = {
      transition: `stroke ${durationMillisec}ms linear,
        stroke-dashoffset ${durationMillisec}ms linear`,
    }
    return <div {...extraProps} style={containerStyle}>
      <VisibilitySensor
        active={!hasStartedGrowing} intervalDelay={250} partialVisibilty={true}
        onChange={this.startGrowing}>
        <div style={percentStyle}>
          {isAnimated ?
            <GrowingNumber durationMillisec={durationMillisec} number={percent} isSteady={true} /> :
            percent
          }%
        </div>
      </VisibilitySensor>
      <svg
        fill="none" ref={gaugeRef}
        viewBox={`${-largeRadius} ${-largeRadius} ${totalWidth} ${totalHeight}`}>
        <g strokeLinecap="round">
          <path d={fullPath} stroke={colors.MODAL_PROJECT_GREY} strokeWidth={strokeWidth} />
          <path
            style={transitionStyle}
            d={percentPath}
            stroke={percentColor}
            strokeDasharray={`${arcLength}, ${2 * arcLength}`}
            strokeDashoffset={hasStartedGrowing ? 0 : arcLength}
            strokeWidth={2 * strokeWidth}
          />
          <path
            d={percentPath}
            style={transitionStyle}
            stroke={percentColor}
            strokeDasharray={`0, ${arcLength}`}
            strokeDashoffset={hasStartedGrowing ? -arcLength + 1 : 0}
            strokeWidth={6 * strokeWidth} />
          <path
            d={percentPath}
            stroke="#fff"
            style={transitionStyle}
            strokeDasharray={`0, ${arcLength}`}
            strokeDashoffset={hasStartedGrowing ? -arcLength + 1 : 0}
            strokeWidth={2 * strokeWidth} />
        </g>
      </svg>
    </div>
  }
}


interface ComponentScoreProps {
  component: {
    isDefined?: boolean
    percent: number
    text: string
    title: (youChooser: YouChooser) => string
  }
  style?: React.CSSProperties
  userYou: YouChooser
}


// TODO(cyrille): Drop, since unused
class ComponentScore extends React.PureComponent<ComponentScoreProps> {
  public static propTypes = {
    children: PropTypes.node,
    component: PropTypes.shape({
      isDefined: PropTypes.bool,
      percent: PropTypes.number.isRequired,
      text: PropTypes.string.isRequired,
      title: PropTypes.func.isRequired,
    }).isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {children, component, userYou, style} = this.props
    const {isDefined, title, percent, text} = component
    const componentScoreStyle: React.CSSProperties = {
      borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
      color: colors.DARK_TWO,
      opacity: isDefined ? 'initial' : 0.5,
      paddingBottom: 17,
      width: '100%',
      ...style,
    }
    const titleStyle: React.CSSProperties = {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 9,
    }
    const textStyle: React.CSSProperties = {
      fontSize: 14,
      lineHeight: 1.29,
      margin: '10px 0 0 13px',
    }
    return <div style={componentScoreStyle}>
      <div style={titleStyle}>{title(userYou)}</div>
      <PercentBar percent={percent} color={colorFromPercent(percent)} isPercentShown={isDefined} />
      <div style={textStyle}><Markdown content={text} /></div>
      {children}
    </div>
  }
}


interface SubmetricDropDownConnectedProps {
  submetricsExpansion?: {[topicId: string]: boolean}
}


interface SubmetricDropDownProps extends SubmetricDropDownConnectedProps {
  advices: bayes.bob.Advice[]
  dispatch: DispatchAllActions
  isAlwaysExpanded?: boolean
  isDefined?: boolean
  isFirstSubmetric?: boolean
  makeAdviceLink: (adviceId: string) => string
  percent: number
  style?: React.CSSProperties
  text: string
  title?: string
  topic: string
  userYou: YouChooser
}


class SubmetricDropDownBase extends React.PureComponent<SubmetricDropDownProps> {
  public static propTypes = {
    advices: PropTypes.array.isRequired,
    children: PropTypes.node,
    dispatch: PropTypes.func.isRequired,
    isAlwaysExpanded: PropTypes.bool,
    isDefined: PropTypes.bool,
    isFirstSubmetric: PropTypes.bool,
    makeAdviceLink: PropTypes.func.isRequired,
    percent: PropTypes.number.isRequired,
    style: PropTypes.object,
    submetricsExpansion: PropTypes.objectOf(PropTypes.bool.isRequired),
    text: PropTypes.string.isRequired,
    title: PropTypes.string,
    topic: PropTypes.string.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  private handleExpansionChange = _memoize((isExpanded: boolean): (() => void) => (): void => {
    const {dispatch, topic} = this.props
    dispatch(changeSubmetricExpansion(topic, !isExpanded))
  })

  public render(): React.ReactNode {
    const {advices, children, isAlwaysExpanded, isDefined, isFirstSubmetric,
      makeAdviceLink, percent, submetricsExpansion, style, text, title, topic,
      userYou} = this.props
    const isExpanded = isAlwaysExpanded || submetricsExpansion && submetricsExpansion[topic]
    const border = `1px solid ${colors.NEW_GREY}`
    const containerStyle: React.CSSProperties = {
      borderBottom: isMobileVersion ? border : 'initial',
      borderTop: isFirstSubmetric && isMobileVersion ? border : 'initial',
      boxShadow: isMobileVersion ? 'initial' : '0 5px 25px 0 rgba(0, 0, 0, 0.2)',
      fontSize: 13,
      width: isMobileVersion ? 'initial' : 700,
      ...style,
    }
    const headerStyle: React.CSSProperties = {
      alignItems: 'center',
      cursor: isAlwaysExpanded ? 'initial' : 'pointer',
      display: 'flex',
      fontSize: 15,
      height: 50,
      padding: isMobileVersion ? '0 20px' : '0 45px',
    }
    const contentStyle: React.CSSProperties = {
      height: isExpanded ? 'initial' : 0,
      overflow: 'hidden',
      padding: isExpanded ? (isMobileVersion ? '10px 20px' : '13px 45px 45px') :
        (isMobileVersion ? '0 20px' : '0 45px'),
      ...SmoothTransitions,
    }
    const color = colorFromPercent(percent)
    const percentStyle: React.CSSProperties = {
      color,
      fontWeight: 'bold',
      margin: isMobileVersion ? '0 22px' : '0 0 0 30px',
      visibility: isDefined ? 'initial' : 'hidden',
    }
    const advicesProps = {advices, makeAdviceLink, userYou}
    const bobTalkStyle: React.CSSProperties = {
      marginTop: 10,
      maxWidth: isMobileVersion ? 'initial' : 380,
    }
    return <div style={containerStyle}>
      <div
        style={headerStyle}
        onClick={isAlwaysExpanded ? null : this.handleExpansionChange(isExpanded)}>
        <span>{title}</span>
        <div style={{flex: 1}} />
        <PercentBar
          {...{color, percent}} height={10}
          style={{margin: 'auto 0', maxWidth: isMobileVersion ? 47 : 224}} isPercentShown={false} />
        <span style={percentStyle}>{percent}%</span>
        {isAlwaysExpanded ? null : <UpDownIcon
          icon="chevron" isUp={isExpanded} size={20} style={{flexShrink: 0, margin: '0 -5px'}} />}
      </div>
      <div style={contentStyle}>
        <BobTalk style={bobTalkStyle} bobSize={isMobileVersion ? 30 : 51}>
          {text}
          {isMobileVersion ? <DiagnosticAdvices {...advicesProps} /> : null}
        </BobTalk>

        {isMobileVersion ? null :
          <DiagnosticAdvices style={{marginTop: 32}} {...advicesProps} />}
        {children}
      </div>
    </div>
  }
}
const SubmetricDropDown = connect(
  ({app: {submetricsExpansion}}: RootState): SubmetricDropDownConnectedProps =>
    ({submetricsExpansion}))(SubmetricDropDownBase)


interface SubmetricScoreProps {
  color?: string
  icon?: string
  observations?: {
    isAttentionNeeded?: boolean
    text?: string
  }[]
  percent?: number
  shortTitle: string
  size: number
  style?: React.CSSProperties
}


interface SubmetricScoreState {
  areDetailsShown: boolean
}


class SubmetricScore extends React.PureComponent<SubmetricScoreProps, SubmetricScoreState> {
  public static propTypes = {
    color: PropTypes.string,
    icon: PropTypes.string,
    observations: PropTypes.arrayOf(PropTypes.shape({
      isAttentionNeeded: PropTypes.bool,
      text: PropTypes.string,
    })),
    percent: PropTypes.number,
    shortTitle: PropTypes.string.isRequired,
    size: PropTypes.number.isRequired,
    style: PropTypes.object,
  }

  public static defaultProps = {
    size: 24,
  }

  public state = {
    areDetailsShown: false,
  }

  private handleShowDetails = _memoize((areDetailsShown): (() => void) =>
    (): void => this.setState({areDetailsShown}))

  public render(): React.ReactNode {
    const {color, icon, percent, observations = [], shortTitle, size, style} = this.props
    const {areDetailsShown} = this.state
    const detailsStyle: React.CSSProperties = {
      backgroundColor: '#fff',
      borderRadius: 10,
      bottom: 'calc(100% + 20px)',
      boxShadow: '0 10px 35px 0 rgba(0, 0, 0, 0.2)',
      fontSize: 13,
      left: '50%',
      opacity: areDetailsShown ? 1 : 0,
      position: 'absolute',
      transform: 'translateX(-50%)',
      zIndex: 1,
      ...SmoothTransitions,
    }
    const detailsHeaderStyle: React.CSSProperties = {
      alignItems: 'center',
      backgroundColor: color,
      borderTopLeftRadius: detailsStyle.borderRadius,
      borderTopRightRadius: detailsStyle.borderRadius,
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      fontSize: 16,
      fontWeight: 'bold',
      padding: '20px 30px',
    }
    const pieChartStyle: React.CSSProperties = {
      borderRadius: '50%',
      boxShadow: areDetailsShown ? '0 10px 35px 0 rgba(0, 0, 0, 0.2)' : 'initial',
      color,
    }
    const obsContainerStyle = {
      padding: '0 30px 20px',
    }
    const observationStyle = (index, isAttentionNeeded): React.CSSProperties => ({
      alignItems: 'center',
      borderTop: index ? `solid 1px ${colors.MODAL_PROJECT_GREY}` : 'initial',
      display: 'flex',
      height: 40,
      whiteSpace: 'nowrap',
      ...isAttentionNeeded && {
        color: colors.RED_PINK,
        fontStyle: 'italic',
      },
    })
    const tailStyle: React.CSSProperties = {
      borderLeft: '20px solid transparent',
      borderRight: '20px solid transparent',
      borderTop: '10px solid #fff',
      height: 0,
      left: '50%',
      position: 'absolute',
      top: '100%',
      transform: 'translateX(-50%)',
      width: 0,
    }
    return <div
      style={{position: 'relative', ...style}}>
      <div
        onMouseEnter={this.handleShowDetails(true)}
        onMouseLeave={this.handleShowDetails(false)}>
        <PieChart
          backgroundColor={colors.MODAL_PROJECT_GREY}
          percentage={percent} style={pieChartStyle} size={size} strokeWidth={size / 6}>
          <img src={icon} alt={shortTitle} />
        </PieChart>
      </div>
      <div style={detailsStyle}>
        <div style={detailsHeaderStyle}>
          <span>{shortTitle}</span>
        </div>
        <div style={obsContainerStyle}>
          {observations.map(({isAttentionNeeded, text}, index): React.ReactNode =>
            <div key={index} style={observationStyle(index, isAttentionNeeded)}>
              {text}
              <div style={{flex: 1}} />
              {isAttentionNeeded ?
                <img src={warningSignImage} alt="warning" style={{marginLeft: 10}} /> : null}
            </div>)}
        </div>
        <div style={tailStyle} />
      </div>
    </div>
  }
}


interface DiagnosticSummaryProps {
  components: ScoreComponent[]
  isSmall?: boolean
  style?: React.CSSProperties
}


// TODO(marielaure): Maybe refactorize with SubmetricDropDown and DiagnosticMetrics.
class DiagnosticSummary extends React.PureComponent<DiagnosticSummaryProps> {
  public static propTypes = {
    components: PropTypes.arrayOf(PropTypes.shape({
      topic: PropTypes.string.isRequired,
    }).isRequired),
    isSmall: PropTypes.bool,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {components, isSmall, style} = this.props
    return <div style={{display: 'flex', margin: '0 auto 40px', ...style}}>
      {components.map((component, index): React.ReactNode => <SubmetricScore
        key={component.topic} style={{marginLeft: index ? isSmall ? 11 : 22 : 0}}
        size={isSmall ? 18 : 24}
        {...component} />)}
    </div>
  }
}


interface DiagnosticMetricsProps {
  advices?: bayes.bob.Advice[]
  components: ScoreComponent[]
  makeAdviceLink: (adviceId: string, topicId: string) => string
  style?: React.CSSProperties
  submetricsExpansion?: {[topicId: string]: boolean}
  topicChildren?: (c: ScoreComponent) => React.ReactNode
  userYou: YouChooser
}


class DiagnosticMetrics extends React.PureComponent<DiagnosticMetricsProps> {
  public static propTypes = {
    advices: PropTypes.array,
    components: PropTypes.arrayOf(PropTypes.shape({
      isDefined: PropTypes.bool,
      isEnticing: PropTypes.bool,
      percent: PropTypes.number,
      text: PropTypes.string,
      title: PropTypes.func.isRequired,
      topic: PropTypes.string.isRequired,
    }).isRequired),
    makeAdviceLink: PropTypes.func.isRequired,
    style: PropTypes.object,
    submetricsExpansion: PropTypes.object,
    // A function that takes a submetric component as parameter, and returns a node to insert
    // inside its corresponding component.
    topicChildren: PropTypes.func,
    userYou: PropTypes.func,
  }

  // TODO(cyrille): Drop the topic id, and replace with something more user-friendly.
  private makeAdviceLink = _memoize((topic: string): ((a: string) => string) =>
    (adviceId: string): string => this.props.makeAdviceLink(adviceId, topic))

  public render(): React.ReactNode {
    const {advices = [], components, style, topicChildren, userYou = vouvoyer} = this.props
    const subDiagnosticsStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }
    return <div style={subDiagnosticsStyle}>
      {_sortBy(components, ({isDefined, percent}): (boolean | number)[] => [!isDefined, percent]).
        map((component, index): React.ReactNode => {
          const {isAlwaysExpanded, isDefined, isEnticing, percent, text, title, topic} = component
          return <SubmetricDropDown
            key={topic} makeAdviceLink={this.makeAdviceLink(topic)}
            style={{marginTop: index && !isMobileVersion ? 40 : 0}}
            isFirstSubmetric={!index} title={title(userYou)}
            isAlwaysExpanded={isAlwaysExpanded || (!isMobileVersion && !isEnticing)}
            topic={topic}
            advices={advices.
              filter(({adviceId, diagnosticTopics}): boolean =>
                diagnosticTopics ? diagnosticTopics.includes(topic) :
                  (categorySets[topic] || new Set()).has(adviceId))}
            {...{isDefined, percent, text, userYou}} >
            {topicChildren ? topicChildren(component) : null}
          </SubmetricDropDown>
        })}
    </div>
  }
}


interface DiagnosticTextProps {
  diagnosticSentences: string
  userYou: YouChooser
}


// TODO(cyrille): Drop, since unused.
class DiagnosticText extends React.PureComponent<DiagnosticTextProps> {
  public static propTypes = {
    diagnosticSentences: PropTypes.string,
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {diagnosticSentences, userYou} = this.props
    const pepTalkStyle = {
      color: colors.DARK_TWO,
      fontSize: 17,
      lineHeight: '25px',
      margin: '0 auto',
      maxWidth: 500,
    }
    return <div style={pepTalkStyle}>
      <Markdown content={diagnosticSentences || defaultDiagnosticSentences(userYou)} />
    </div>
  }
}


interface HoverableBobHeadProps extends React.HTMLProps<HTMLDivElement> {
  width: number
}


class HoverableBobHeadBase extends React.PureComponent<HoverableBobHeadProps> {
  public static propTypes = {
    style: PropTypes.object,
    width: PropTypes.number.isRequired,
  }

  public static defaultProps = {
    width: 55,
  }

  public render(): React.ReactNode {
    const {style, width, ...otherProps} = this.props
    const hoverStyle: React.CSSProperties & {':hover': React.CSSProperties} = {
      ':hover': {
        boxShadow: '0 10px 15px 0 rgba(0, 0, 0, 0.2)',
      },
      borderRadius: width,
      bottom: 0,
      height: width,
      left: 0,
      position: 'absolute',
      right: 0,
      width,
    }
    return <div style={{position: 'relative', ...style}} {...otherProps}>
      <div style={hoverStyle} />
      <img src={bobHeadImage} alt={config.productName} style={{display: 'block', width}} />
    </div>
  }
}
const HoverableBobHead = Radium(HoverableBobHeadBase)


interface SideLinkProps extends Omit<React.HTMLProps<HTMLAnchorElement>, 'href' | 'ref'> {
  href?: string
}

class SideLink extends React.PureComponent<SideLinkProps> {
  public static prop = {
    children: PropTypes.node,
    href: PropTypes.string,
  }

  public render(): React.ReactNode {
    const {children, href, ...otherProps} = this.props
    if (!href) {
      return null
    }
    const style: RadiumCSSProperties = {
      ':hover': {
        backgroundColor: colors.LIGHT_GREY,
      },
      alignItems: 'center',
      borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
      color: colors.SLATE,
      display: 'flex',
      fontSize: 14,
      padding: '15px 20px',
      textDecoration: 'none',
    }
    return <RadiumExternalLink href={href} style={style} {...otherProps}>
      <div style={{flex: 1}}>{children}</div>
      <ChevronRightIcon size={20} style={{marginRight: -7}} />
    </RadiumExternalLink>
  }
}
interface VisualCardConnectedProps {
  jobGroupInfo: bayes.bob.JobGroup
}

interface VisualCardConfig {
  category?: string
  children?: never
  project: bayes.bob.Project
  style?: React.CSSProperties
  userYou: YouChooser
}

interface VisualCardProps extends VisualCardConnectedProps, VisualCardConfig {
  dispatch: DispatchAllActions
}

class BobThinksVisualCardBase extends React.PureComponent<VisualCardProps> {
  public static propTypes = {
    category: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    // Information on jobGroup fetched asynchronously.
    // Merge them in connect, if there ever are several different pieces.
    jobGroupInfo: PropTypes.shape({
      applicationModes: PropTypes.object,
    }).isRequired,
    project: PropTypes.shape({
      localStats: PropTypes.shape({
        imt: PropTypes.shape({
          yearlyAvgOffersPer10Candidates: PropTypes.number,
        }),
      }),
    }),
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }


  public componentDidMount(): void {
    const {category, dispatch, jobGroupInfo: {applicationModes},
      project: {targetJob: {jobGroup}}} = this.props
    if (category === 'enhance-methods-to-interview' && !applicationModes) {
      dispatch(fetchApplicationModes(jobGroup))
    }
  }

  private renderStrongCompetition(offersPerCandidates): React.ReactNode {
    const containerStyle: React.CSSProperties = {
      position: 'relative',
      ...this.props.style,
    }
    const textStyle: React.CSSProperties = {
      paddingBottom: 20,
      textAlign: 'center',
    }
    const offers = Math.round(20 * offersPerCandidates)
    return <div style={containerStyle}>
      <img alt="" src={strongCompetitionImage} style={{width: '100%'}} />
      <div style={textStyle}>
        <div style={{fontSize: 13}}>
          pour {offers} offres d'emploi pourvues
        </div>
        <div style={{fontSize: 18, fontWeight: 900}}>
          {20 - offers} candidats sur 20 restent au chômage
        </div>
      </div>
    </div>
  }

  // TODO(marielaure): Refactor this when there are more.
  private renderWorkTime(): React.ReactNode {
    const {userYou} = this.props
    const containerStyle: React.CSSProperties = {
      position: 'relative',
      ...this.props.style,
    }
    const textStyle: React.CSSProperties = {
      paddingBottom: 20,
      textAlign: 'center',
    }
    return <div style={containerStyle}>
      <img alt="50000" src={workTimeImage} style={{padding: '25px 25px 20px', width: '100%'}} />
      <div style={textStyle}>
        <div style={{fontSize: 13}}>
          heures de {userYou('ta', 'votre')} vie
        </div>
        <div style={{fontSize: 18, fontWeight: 900}}>
          seront passées au travail
        </div>
      </div>
    </div>
  }

  private renderEnhanceMethodsToInterview(): React.ReactNode {
    const {jobGroupInfo, project: {city, targetJob: {jobGroup: {name}}}, style} = this.props
    if (!jobGroupInfo.applicationModes) {
      return null
    }
    const [{mode: bestMode = undefined} = {}, ...otherModes] = getApplicationModes(jobGroupInfo)
    if (!bestMode || bestMode === 'OTHER_CHANNELS') {
      // We don't know what we can say that would be meaningful here.
      return null
    }
    const {mode: worstMode = undefined} = otherModes[otherModes.length - 1] || {}
    const containerStyle: React.CSSProperties = {
      ...style,
      fontSize: 13,
      padding: '20px 25px',
    }
    const titleStyle: React.CSSProperties = {
      fontSize: 16,
      margin: '0 auto 25px',
      maxWidth: 230,
      textAlign: 'center',
    }
    const itemStyle = (backgroundColor: string): React.CSSProperties => ({
      backgroundColor,
      borderRadius: 4,
      flex: 'none',
      height: 25,
      marginRight: 5,
      width: 34,
    })
    const footnote = !worstMode || worstMode === 'OTHER_CHANNELS' ? '*' : ''
    const footnoteStyle: React.CSSProperties = {
      borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
      fontStyle: 'italic',
      marginTop: 25,
      paddingTop: 10,
    }
    return <div style={containerStyle}>
      <h2 style={titleStyle}>
        Recrutement en {lowerFirstLetter(name)} {inDepartement(city) || null}
      </h2>
      <div style={{alignItems: 'center', display: 'flex', marginBottom: 10}}>
        {new Array(4).fill(undefined).map((unused, index): React.ReactNode =>
          <div key={index} style={itemStyle(colors.BOB_BLUE)} />)}
        <span style={{fontWeight: 'bold', marginLeft: 15}}>{getApplicationModeText(bestMode)}</span>
      </div>
      <div style={{alignItems: 'center', display: 'flex', marginBottom: 10}}>
        {new Array(4).fill(undefined).map((unused, index): React.ReactNode =>
          <div
            key={index} style={itemStyle(index ? colors.MODAL_PROJECT_GREY : colors.BOB_BLUE)} />)}
        <span style={{marginLeft: 15}}>{getApplicationModeText(worstMode)}{footnote}</span>
      </div>
      {footnote ? <div style={footnoteStyle}>
        *Seulement 7 personnes sur 100 trouvent un emploi grâce aux offres d'emploi
      </div> : null}
    </div>
  }

  private renderMissingDiploma(): React.ReactNode {
    return <div style={this.props.style}>
      <img
        src={missingDiplomaImage} alt="Un diplôme peut faire la différence"
        style={{width: '100%'}} />
    </div>
  }

  public render(): React.ReactNode {
    const {category, project} = this.props
    // TODO(pascal): Refactor when we have many of those.
    if (category === 'stuck-market') {
      const {yearlyAvgOffersPer10Candidates = undefined} =
        project && project.localStats && project.localStats.imt || {}
      if (!yearlyAvgOffersPer10Candidates) {
        return null
      }
      const offers = yearlyAvgOffersPer10Candidates === -1 ? 0 : yearlyAvgOffersPer10Candidates
      return this.renderStrongCompetition(offers / 10)
    }
    if (category === 'find-what-you-like') {
      return this.renderWorkTime()
    }
    if (category === 'missing-diploma') {
      return this.renderMissingDiploma()
    }
    if (category === 'enhance-methods-to-interview') {
      return this.renderEnhanceMethodsToInterview()
    }
    return null
  }
}
const BobThinksVisualCard = connect(
  (
    {app: {applicationModes = {}}}: RootState,
    {project: {targetJob: {jobGroup: {romeId}}}}: VisualCardConfig):
  VisualCardConnectedProps => ({
    jobGroupInfo: {applicationModes: applicationModes[romeId]},
  }))(BobThinksVisualCardBase)


interface IntroductionProps {
  onClick: () => void
  text?: string
}


class StrategiesIntroduction extends React.PureComponent<IntroductionProps> {
  public static propTypes = {
    onClick: PropTypes.func.isRequired,
    text: PropTypes.string,
  }

  public render(): React.ReactNode {
    const {onClick, text} = this.props
    const introductionStyle: React.CSSProperties = {
      color: colors.SLATE,
      fontSize: 16,
      fontWeight: 'normal',
      lineHeight: 1.5,
      margin: 20,
      maxWidth: 410,
      textAlign: 'center',
    }
    return <div style={{alignItems: 'center', display: 'flex', flexDirection: 'column'}}>
      <FastForward onForward={onClick} />
      {text ? <div style={introductionStyle}>{text}</div> : null}
      <Button type="validation" onClick={onClick} style={{margin: 20}}>
        Découvrir mes stratégies
      </Button>
    </div>
  }
}


interface ScoreSectionProps {
  maxBarLength: number
  score: {
    color: string
    percent: number
  }
  strokeWidth: number
  style?: React.CSSProperties
}


// TODO(marielaure): Animate the score.
class FlatScoreSection extends React.PureComponent<ScoreSectionProps> {
  public static propTypes = {
    maxBarLength: PropTypes.number.isRequired,
    score: PropTypes.shape({
      color: PropTypes.string.isRequired,
      percent: PropTypes.number.isRequired,
    }).isRequired,
    strokeWidth: PropTypes.number.isRequired,
    style: PropTypes.object,
  }

  public static defaultProps = {
    maxBarLength: 200,
    strokeWidth: 4,
  }

  public render(): React.ReactNode {
    const {maxBarLength, score: {color, percent}, strokeWidth, style} = this.props
    const containerStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0 20px',
      textAlign: 'left',
      ...style,
    }
    return <div style={containerStyle}>
      <div style={{display: 'flex', flexDirection: 'column', paddingTop: 10}}>
        <div style={{fontSize: 16, fontWeight: 900}}>Score global</div>
        <div style={{width: maxBarLength}}>
          <svg fill="none" viewBox={`0 0 ${maxBarLength} 30`}>
            <g strokeLinecap="round">
              <path
                stroke={colors.SILVER}
                d={`M ${strokeWidth} 10 H ${maxBarLength - strokeWidth}`} opacity={0.8}
                strokeWidth={strokeWidth} />
              <path
                stroke={color}
                d={`M ${strokeWidth} 10 H ${percent * maxBarLength / 100}`}
                strokeWidth={2 * strokeWidth}
              />
            </g>
          </svg>
        </div>
      </div>
      <div style={{fontSize: 22, fontWeight: 900}}>{`${percent}%`}</div>
    </div>
  }
}


interface PdfDownloadLinkProps {
  diagnosticData: bayes.bob.Diagnostic
  gaugeRef?: React.RefObject<SVGSVGElement>
  onDownloadAsPdf?: () => void
  style?: React.CSSProperties
  userYou: YouChooser
}


class PdfDownloadLinkBase extends React.PureComponent<PdfDownloadLinkProps> {
  public static propTypes = {
    diagnosticData: PropTypes.object,
    gaugeRef: PropTypes.object,
    onDownloadAsPdf: PropTypes.func,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  private exportToPdf = (): void => {
    svg2image(this.props.gaugeRef.current, 'image/jpeg', 1).then(this.createPdf)
  }

  private createPdf = ({gaugeDataURL, gaugeWidth, gaugeHeight}): void => {
    const {diagnosticData, onDownloadAsPdf, userYou} = this.props
    const {components, percent, shortTitle, title} = computeBobScore(diagnosticData)
    const doc = new jsPDF({format: 'a4', orientation: 'landscape', unit: 'cm'})

    const centerWidth = 14.85 // 29.7 cm / 2

    // Header.
    if (gaugeDataURL && gaugeWidth) {
      doc.addImage(gaugeDataURL, 'JPEG', centerWidth - 1.5, 2.4, 3, 3 * gaugeHeight / gaugeWidth)
    }
    doc.setFontSize(14)
    doc.text(`Diagnostic de ${config.productName}`, centerWidth, 2, 'center')
    doc.setTextColor(colors.DARK_TWO)
    doc.setFontSize(20)
    doc.setFontType('bold')
    doc.text(`${percent}%`, centerWidth, 4.2, 'center')
    doc.setFontSize(22)
    if (shortTitle || title) {
      doc.text(clearEmoji(clearMarkup(shortTitle || title)), centerWidth, 5.5, 'center')
    }
    doc.setFontType('normal')

    let cursorHeight = 7.5

    // Text on the left.
    doc.setFontSize(14)
    if (diagnosticData.text) {
      const textLines = doc.setFontSize(14).splitTextToSize(
        clearEmoji(clearMarkup(diagnosticData.text)), centerWidth - 1.5)
      doc.text(textLines, 1, cursorHeight)
    }

    // Components on the right.
    const rightPageLeftOffset = centerWidth + .5
    components.filter(({percent}): boolean => !!percent).forEach(({percent, text, title}): void => {
      doc.setFontSize(14)
      doc.setTextColor(...colorToComponents(colors.DARK_TWO))
      doc.setFontType('bold')
      doc.text(title(userYou), rightPageLeftOffset, cursorHeight)
      doc.setFontType('normal')

      cursorHeight += .3

      // Progress bar.
      doc.setFillColor(...colorToComponents(colors.MODAL_PROJECT_GREY))
      doc.roundedRect(
        rightPageLeftOffset, cursorHeight,
        centerWidth - 2.5, .57, .57 / 2, .57 / 2, 'F')
      doc.setFillColor(...colorToComponents(colorFromPercent(percent)))
      doc.roundedRect(
        rightPageLeftOffset, cursorHeight,
        (centerWidth - 2.5) * percent / 100, .57, .57 / 2, .57 / 2, 'F')
      doc.setTextColor(255)
      doc.setFontSize(11)
      doc.setFontType('bold')
      doc.text(percent + '%', rightPageLeftOffset + .3, cursorHeight + .45)

      cursorHeight += .57

      doc.setFontSize(9)
      doc.setFontType('normal')
      doc.setTextColor(...colorToComponents(colors.SLATE))
      if (text) {
        const textLines = doc.splitTextToSize(clearEmoji(clearMarkup(text)), centerWidth - 1.5)
        doc.text(textLines, rightPageLeftOffset, cursorHeight + .57)
        cursorHeight += .37 * textLines.length
      }
      cursorHeight += .57 + .6
    })

    doc.save(`Diagnostic de ${config.productName}`)
    onDownloadAsPdf()
  }

  public render(): React.ReactNode {
    const {onDownloadAsPdf, style} = this.props
    if (!onDownloadAsPdf) {
      return
    }
    const getColorStyle = (name): React.CSSProperties & {':hover': React.CSSProperties} => ({
      ':hover': {[name]: 'inherit'},
      [name]: colors.COOL_GREY,
    })
    const downloadStyle: React.CSSProperties & {':hover': React.CSSProperties} = {
      ...getColorStyle('color'),
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 500,
      padding: isMobileVersion ? '20px 0' : '10px 0',
      textDecoration: 'underline',
      ...SmoothTransitions,
      ...style,
    }
    const downloadIconStyle: React.CSSProperties & {':hover': React.CSSProperties} = {
      ...getColorStyle('fill'),
      height: 16,
      verticalAlign: 'middle',
      ...SmoothTransitions,
    }
    return <a onClick={this.exportToPdf} style={downloadStyle}>
      <DownloadIcon style={downloadIconStyle} />
      Télécharger mon diagnostic en PDF
    </a>
  }
}
const PdfDownloadLink = Radium(PdfDownloadLinkBase)


// A component to even the filling of rows in a text element.
// NOTE: Move to theme if we ever use it elsewhere.
class BalancedTitle extends React.PureComponent<{}, {lineWidth: number}> {

  public state = {
    lineWidth: 0,
  }

  private handleHiddenTitle = (dom: HTMLDivElement): void =>
    dom && this.setState({
      lineWidth:
        // Target width is that of in-flow div, which is dom's grand-parent.
        dom.clientWidth / Math.ceil(dom.clientWidth / dom.parentElement.parentElement.clientWidth),
    })

  public render(): React.ReactNode {
    const {children} = this.props
    const {lineWidth} = this.state
    const titleStyle = {
      margin: '0 auto',
      ...!!lineWidth && {maxWidth: `calc(2em + ${lineWidth}px`},
    }
    return <React.Fragment>
      {lineWidth ? null : <div style={{opacity: 0, overflow: 'hidden'}}>
        <div style={{position: 'absolute', width: '300vw'}}>
          <div ref={this.handleHiddenTitle} style={{position: 'absolute'}}>{children}</div>
        </div>
      </div>}
      <div style={titleStyle}>{children}</div>
    </React.Fragment>
  }
}


interface DiagnosticProps {
  advices?: bayes.bob.Advice[]
  areStrategiesEnabled?: boolean
  diagnosticData: bayes.bob.Diagnostic
  dispatch: DispatchAllActions
  isFirstTime?: boolean
  makeAdviceLink: (adviceId: string, strategyId: string) => string
  makeStrategyLink: (strategyId: string) => string
  onDiagnosticTextShown?: () => void
  onDownloadAsPdf?: () => void
  onFullDiagnosticShown?: () => void
  project?: bayes.bob.Project
  strategies?: bayes.bob.Strategy[]
  style?: React.CSSProperties
  userName: string
  userYou: YouChooser
}


class DiagnosticBase extends React.PureComponent<DiagnosticProps> {
  public static propTypes = {
    advices: PropTypes.array,
    // TODO(pascal): Convert other cases to the strategies and drop this.
    areStrategiesEnabled: PropTypes.bool,
    diagnosticData: PropTypes.object.isRequired,
    isFirstTime: PropTypes.bool,
    makeAdviceLink: PropTypes.func.isRequired,
    makeStrategyLink: PropTypes.func.isRequired,
    onDiagnosticTextShown: PropTypes.func,
    onDownloadAsPdf: PropTypes.func,
    onFullDiagnosticShown: PropTypes.func,
    project: PropTypes.shape({
      localStats: PropTypes.shape({
        imt: PropTypes.shape({
          yearlyAvgOffersPer10Candidates: PropTypes.number,
        }),
      }),
    }),
    strategies: PropTypes.array,
    style: PropTypes.object,
    userName: PropTypes.string.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public state = {
    areStrategiesShown: !this.props.isFirstTime,
    isDiagnosticTextShown: this.props.isFirstTime,
    isFullTextShown: false,
  }

  public componentDidMount(): void {
    const {onDiagnosticTextShown, onFullDiagnosticShown} = this.props
    const onShown = this.state.isDiagnosticTextShown ? onDiagnosticTextShown : onFullDiagnosticShown
    onShown && onShown()
  }

  public componentDidUpdate(prev): void {
    const {diagnosticData, userName, userYou} = this.props
    if (prev.userName === userName && prev.userYou(true, false) === userYou(true, false) &&
      prev.diagnosticData === diagnosticData) {
      return
    }
    this._score = undefined
  }

  private gaugeRef: React.RefObject<SVGSVGElement> = React.createRef()

  private _score: Score

  private getScore = (): Score => {
    if (this._score) {
      return this._score
    }
    const {diagnosticData, userName, userYou} = this.props
    this._score = computeBobScore(diagnosticData, userName, userYou)
    return this._score
  }

  private onTextForward = (): void => {
    if (this.state.isFullTextShown) {
      this.handleCloseDiagnosticText()
      return
    }
    this.setState({isFullTextShown: true})
  }

  private handleCloseDiagnosticText = (): void => {
    const {onFullDiagnosticShown} = this.props
    this.setState({isDiagnosticTextShown: false}, (): void => {
      onFullDiagnosticShown && onFullDiagnosticShown()
      window.scrollTo(0, 0)
    })
  }

  private handleReopenDiagnosticText = (): void => {
    const {onDiagnosticTextShown} = this.props
    this.setState({isDiagnosticTextShown: true, isFullTextShown: true}, onDiagnosticTextShown)
  }

  private handleOpenStrategies = (): void => {
    this.setState({areStrategiesShown: true})
  }

  private handleFullTextShown = (): void => this.setState({isFullTextShown: true})

  private handleDispatch = _memoize((action): (() => void) => (): void =>
    this.props.dispatch(action))

  private renderDiagnosticText(isModal?: boolean): React.ReactNode {
    const {diagnosticData: {text}, isFirstTime, style, userYou} = this.props
    const {percent, title} = this.getScore()
    const sentences = (text || defaultDiagnosticSentences(userYou)).split('\n\n')
    const sentencesToDisplay = title ? [title, ...sentences] : sentences
    if (isModal) {
      return <BobModal
        isShown={true} onConfirm={this.handleCloseDiagnosticText}
        buttonText="OK, voir mon diagnostic">
        {sentencesToDisplay.join('\n\n')}
      </BobModal>
    }
    const {isFullTextShown} = this.state
    const circleAnimationDuration = 1000
    const pageStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      paddingTop: 20,
      ...style,
    }
    return <div style={pageStyle}>
      <FastForward onForward={this.onTextForward} />
      <Discussion
        style={{flex: 1, margin: '0 10px', maxWidth: 400}}
        isOneBubble={true} isFastForwarded={isFullTextShown}
        onDone={this.handleFullTextShown}>
        <NoOpElement style={{margin: '0 auto 20px'}}>
          <BobScoreCircle
            percent={percent} isAnimated={!isFullTextShown}
            durationMillisec={circleAnimationDuration} />
        </NoOpElement>
        <WaitingElement waitingMillisec={circleAnimationDuration * 1.5} />
        <DiscussionBubble>
          {sentencesToDisplay.map((sentence, index): React.ReactElement<BubbleToRead['props']> =>
            <BubbleToRead key={index}>
              <Markdown
                content={sentence}
                renderers={{
                  paragraph: (props): React.ReactElement => <p style={{margin: 0}} {...props} />,
                }} />
            </BubbleToRead>)}
        </DiscussionBubble>
        <NoOpElement style={{margin: '20px auto 0'}}>
          <Button type="validation" onClick={this.handleCloseDiagnosticText}>
            {isFirstTime ? 'Étape suivante' : 'Revenir au détail'}
          </Button>
        </NoOpElement>
      </Discussion>
    </div>
  }

  private renderBobScore({shortTitle, color, percent}, isTitleShown = true): React.ReactNode {
    const bobCircleProps = isMobileVersion ? {
      halfAngleDeg: 66.7,
      radius: 60,
      scoreSize: 35,
      strokeWidth: 4,
    } : {}
    const bobScoreStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      margin: '0 auto',
      maxWidth: isMobileVersion ? 320 : 470,
    }
    const titleStyle: React.CSSProperties = {
      fontSize: isMobileVersion ? 18 : 25,
      fontWeight: 'bold',
      lineHeight: 1,
      margin: isMobileVersion ? '20px 0 20px 10px' : '0 0 0 40px',
      textAlign: 'center',
    }
    // TODO(cyrille): Handle isMobileVersion.
    return <div style={bobScoreStyle}>
      <BobScoreCircle
        {...bobCircleProps}
        style={{flexShrink: 0}}
        percent={percent}
        isAnimated={!this.state.isFullTextShown}
        gaugeRef={this.gaugeRef} />
      {isTitleShown ? <Markdown
        content={shortTitle}
        renderers={{
          paragraph: (props): React.ReactElement => <div {...props} style={titleStyle} />,
          strong: (props): React.ReactElement => <span style={{color}} {...props} />,
        }} /> : null}
    </div>
  }

  private renderScoreSeparator(): React.ReactNode {
    const containerStyle = {
      alignItems: 'center',
      color: SECTION_COLOR,
      display: 'flex',
      margin: '76px auto 55px',
    }
    return <div style={containerStyle}>
      <div style={{backgroundColor: colors.MODAL_PROJECT_GREY, height: 1, width: 50}} />
      <span style={{fontSize: 11, fontWeight: 'bold', margin: '0 20px'}}>
        Éléments pris en compte&nbsp;:
      </span>
      <div style={{backgroundColor: colors.MODAL_PROJECT_GREY, height: 1, width: 50}} />
    </div>
  }

  private renderMobileTopSections(score: Score, cardStyle: React.CSSProperties): React.ReactNode {
    const {diagnosticData: {strategiesIntroduction}} = this.props
    const {areStrategiesShown} = this.state
    const scoreSectionStyle: React.CSSProperties = {
      fontSize: 26,
      fontWeight: 900,
      marginBottom: 35,
      textAlign: 'center',
    }
    const introductionStyle: React.CSSProperties = {
      ...cardStyle,
      padding: 15,
    }

    return <React.Fragment>
      <div style={scoreSectionStyle}>
        <BalancedTitle><Markdown content={score.shortTitle} /></BalancedTitle>
        <FlatScoreSection score={score} style={cardStyle} />
      </div>
      {areStrategiesShown ? null : <div style={introductionStyle}>
        <StrategiesIntroduction onClick={this.handleOpenStrategies} text={strategiesIntroduction} />
      </div>}
    </React.Fragment>
  }

  public render(): React.ReactNode {
    const {areStrategiesShown, isDiagnosticTextShown} = this.state
    const {advices = [], areStrategiesEnabled, diagnosticData, onDownloadAsPdf,
      makeAdviceLink, makeStrategyLink, project, project: {city, targetJob}, strategies = [], style,
      userYou} = this.props
    const {categoryId, strategiesIntroduction} = diagnosticData
    const isBobTalksModalShown = areStrategiesEnabled && isDiagnosticTextShown && !isMobileVersion
    if (isDiagnosticTextShown && !isBobTalksModalShown) {
      return this.renderDiagnosticText()
    }
    const score = this.getScore()
    const adviceProps = _mapValues(
      _keyBy(advices, 'adviceId'),
      ({isForAlphaOnly, status}): bayes.bob.Advice => ({isForAlphaOnly, status}))
    if (areStrategiesEnabled) {
      // TODO(pascal): Add mobile version as well.
      const pageStyle: React.CSSProperties = {
        backgroundColor: isMobileVersion ? '#fff' : 'initial',
        display: 'flex',
        flexDirection: isMobileVersion ? 'column-reverse' : 'row',
        justifyContent: 'center',
        paddingBottom: 50,
        paddingTop: isMobileVersion ? 0 : 48,
      }
      const cardStyle: React.CSSProperties = {
        backgroundColor: '#fff',
        border: isMobileVersion ? `solid 2px ${colors.SILVER}` : 'initial',
        borderRadius: 10,
        boxShadow: isMobileVersion ? 'initial' : '0 4px 14px 0 rgba(0, 0, 0, 0.05)',
        margin: isMobileVersion ? 15 : '20px 0',
      }
      const titleCardStyle: React.CSSProperties = {
        ...cardStyle,
        fontSize: 30,
        fontWeight: 900,
        marginBottom: 35,
        padding: '15px 35px',
        textAlign: 'center',
      }
      const strategiesTitleStyle: React.CSSProperties = {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 20,
        marginLeft: isMobileVersion ? 0 : 20,
        textAlign: isMobileVersion ? 'center' : 'initial',
        textTransform: 'uppercase',
      }
      const scoreCardStyle: React.CSSProperties = {
        ...cardStyle,
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 30,
        padding: 25,
      }
      return <div style={pageStyle}>
        {isBobTalksModalShown ? this.renderDiagnosticText(true) : null}
        <div style={{marginRight: 40, width: isMobileVersion ? '100%' : 600}}>
          {isMobileVersion ? this.renderMobileTopSections(score, cardStyle) :
            <div style={titleCardStyle}>
              <BalancedTitle><Markdown content={score.shortTitle} /></BalancedTitle>
              {areStrategiesShown ? null :
                <StrategiesIntroduction
                  onClick={this.handleOpenStrategies} text={strategiesIntroduction} />}
            </div>}
          {areStrategiesShown ?
            <React.Fragment>
              <div style={strategiesTitleStyle}>Les stratégies de {config.productName}</div>
              <Strategies
                {...{adviceProps, makeAdviceLink, makeStrategyLink,
                  project, strategies, userYou}}
                strategyStyle={cardStyle} />
            </React.Fragment> : null}
        </div>
        {isMobileVersion ? null : <div style={{width: 360}}>
          <div style={scoreCardStyle}>
            <div style={{marginBottom: 25}}>Score global</div>
            {this.renderBobScore(score, false)}
            <DiagnosticSummary
              components={score.components} style={{margin: '35px 0 0'}} isSmall={true} />
          </div>
          <div style={{...cardStyle, overflow: 'hidden'}}>
            <BobThinksVisualCard category={categoryId} {...{project, userYou}} />
            {/* TODO(pascal): Replace with a link to the stats page when it exists. */}
            <SideLink
              onClick={this.handleDispatch(openStatsPageAction)}
              href={getIMTURL(targetJob, city)}>Découvrir le marché de l'emploi</SideLink>
            <SideLink
              onClick={this.handleDispatch(followJobOffersLinkAction)}
              href={getPEJobBoardURL(targetJob, city)}>Voir les offres d'emploi</SideLink>
          </div>
          {/* TODO(pascal): Re-enable PDF */}
        </div>}
      </div>
    }
    const pageStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: isMobileVersion ? 20 : 50,
      paddingTop: 48,
      position: 'relative',
      ...style,
    }
    const bobHeadStyle: React.CSSProperties = {
      cursor: 'pointer',
      left: isMobileVersion ? 'initial' : '100%',
      marginLeft: isMobileVersion ? 0 : 15,
      position: 'absolute',
      right: isMobileVersion ? 20 : 'initial',
      top: isMobileVersion ? 20 : 40,
    }
    const headerStyle: React.CSSProperties = {
      alignSelf: 'stretch',
      display: 'flex',
      flexDirection: 'column',
      marginBottom: 20,
    }
    const downloadLinkStyle: React.CSSProperties = isMobileVersion ?
      {display: 'block', textAlign: 'center'} :
      {position: 'absolute', right: 0, top: 0}
    return <div style={pageStyle}>
      <HoverableBobHead
        style={bobHeadStyle}
        onClick={this.handleReopenDiagnosticText} />
      {isMobileVersion ? this.renderBobScore(score) : <React.Fragment>
        <div style={headerStyle}>
          {this.renderBobScore(score)}
          {this.renderScoreSeparator()}
          <DiagnosticSummary components={score.components} style={{flex: 1}} />
        </div>
      </React.Fragment>}
      <DiagnosticMetrics components={score.components} {...{advices, makeAdviceLink, userYou}} />
      <PdfDownloadLink
        {...{diagnosticData, onDownloadAsPdf, userYou}}
        gaugeRef={this.gaugeRef} style={downloadLinkStyle} />
    </div>
  }
}
const Diagnostic = connect()(DiagnosticBase)

export {BobScoreCircle, ComponentScore, DiagnosticText, DiagnosticMetrics, Diagnostic}
