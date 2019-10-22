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
import {Link} from 'react-router-dom'
import VisibilitySensor from 'react-visibility-sensor'

import {DispatchAllActions, RomeJobGroup, RootState, changeSubmetricExpansion,
  fetchApplicationModes, followJobOffersLinkAction} from 'store/actions'
import {clearEmoji, clearMarkup} from 'store/clean_text'
import {YouChooser, inDepartement, lowerFirstLetter, vouvoyer} from 'store/french'
import {genderizeJob, getApplicationModeText, getApplicationModes,
  getPEJobBoardURL} from 'store/job'
import {Score, ScoreComponent, colorFromPercent, computeBobScore} from 'store/score'

import categories from 'components/advisor/data/categories.json'
import {FastForward} from 'components/fast_forward'
import {isMobileVersion} from 'components/mobile'
import {ModifyProjectModal} from 'components/navigation'
import {BubbleToRead, Discussion, DiscussionBubble, NoOpElement,
  WaitingElement} from 'components/phylactery'
import {RadiumExternalLink, SmartLink} from 'components/radium'
import {SignUpBanner} from 'components/pages/signup'
import {CategoriesTrain} from 'components/stats_charts'
import {BobScoreCircle, Button, GrowingNumber, JobGroupCoverImage, PercentBar, PieChart, Markdown,
  SmoothTransitions, UpDownIcon, colorToAlpha, colorToComponents} from 'components/theme'
import {STATS_PAGE} from 'components/url'
import bobHeadImage from 'images/bob-head.svg'
import missingDiplomaImage from 'images/missing-diploma.png'
import strongCompetitionImage from 'images/strong-competition.svg'
import warningSignImage from 'images/warning-sign.svg'
import workTimeImage from 'images/50000_hours.png'

import {DiagnosticAdvices} from './advice'
import {Strategies} from './strategy'
import {BobModal, BobTalk} from './speech'


const emptyArray = [] as const


const categorySets = _mapValues(categories, (list: string[]): Set<string> => new Set(list))

const APPLICATION_MODES_VC_CATEGORIES = new Set([
  'bravo',
  'enhance-methods-to-interview',
  'start-your-search',
])

const SECTION_COLOR = colorToAlpha(colors.DARK, .5)

// TODO(cyrille): Use HelpDeskLink component here.
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
  if (!ctx) {
    return Promise.resolve({})
  }
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
    const isExpanded = !!(isAlwaysExpanded || submetricsExpansion && submetricsExpansion[topic])
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
        onClick={isAlwaysExpanded ? undefined : this.handleExpansionChange(isExpanded)}>
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
  observations?: readonly {
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
      pointerEvents: areDetailsShown ? 'auto' : 'none',
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
          percentage={percent || 0} style={pieChartStyle} radius={size} strokeWidth={size / 6}>
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
  advices?: readonly bayes.bob.Advice[]
  components: readonly ScoreComponent[]
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

  private makeAdviceLink = (adviceId: string): string =>
    this.props.makeAdviceLink(adviceId, 'conseil')

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
            key={topic} makeAdviceLink={this.makeAdviceLink}
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


function hasRomeId(jobGroup?: bayes.bob.JobGroup): jobGroup is RomeJobGroup {
  return !!(jobGroup && jobGroup.romeId)
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
      project: {targetJob: {jobGroup = undefined} = {}}} = this.props
    if (!applicationModes && category && APPLICATION_MODES_VC_CATEGORIES.has(category)
      && hasRomeId(jobGroup)) {
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

  private renderApplicationModes(): React.ReactNode {
    const {jobGroupInfo, project: {city, targetJob: {jobGroup: {name = ''} = {}} = {}}, style} =
      this.props
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
        Recrutement en {lowerFirstLetter(name)} {city && inDepartement(city) || null}
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
    if (category && APPLICATION_MODES_VC_CATEGORIES.has(category)) {
      return this.renderApplicationModes()
    }
    return null
  }
}
const BobThinksVisualCard = connect(
  (
    {app: {applicationModes = {}}}: RootState,
    {project: {targetJob: {jobGroup: {romeId = undefined} = {}} = {}}}: VisualCardConfig):
  VisualCardConnectedProps => ({
    jobGroupInfo: {applicationModes: romeId ? applicationModes[romeId] : undefined},
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

  public state = {
    hasStartedGrowing: false,
  }

  private startGrowing = (isVisible: boolean): void => {
    if (!isVisible) {
      return
    }
    this.setState({hasStartedGrowing: true})
  }

  public render(): React.ReactNode {
    const {maxBarLength, score: {color, percent}, strokeWidth, style} = this.props
    const {hasStartedGrowing} = this.state
    const durationMillisec = 1000
    const percentColor = !hasStartedGrowing ? colors.RED_PINK : color
    const containerStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0 20px',
      textAlign: 'left',
      ...style,
    }
    const transitionStyle: React.CSSProperties = {
      transition: `stroke ${durationMillisec}ms linear,
        stroke-dashoffset ${durationMillisec}ms linear`,
    }
    const barLength = percent * maxBarLength / 100
    return <VisibilitySensor
      active={!hasStartedGrowing} intervalDelay={250} partialVisibility={true}
      onChange={this.startGrowing}>
      <div style={containerStyle}>
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
                  stroke={percentColor}
                  style={transitionStyle}
                  d={`M ${strokeWidth} 10 H ${percent * maxBarLength / 100}`}
                  strokeDashoffset={hasStartedGrowing ? 0 : barLength}
                  strokeDasharray={barLength}
                  strokeWidth={2 * strokeWidth}
                />
              </g>
            </svg>
          </div>
        </div>
        <div style={{fontSize: 22, fontWeight: 900}}>
          <GrowingNumber durationMillisec={durationMillisec} number={percent} isSteady={true} />%
        </div>
      </div>
    </VisibilitySensor>
  }
}


interface PdfDownloadLinkProps {
  diagnosticData: bayes.bob.Diagnostic
  gaugeRef: React.RefObject<SVGSVGElement>
  onDownloadAsPdf?: () => void
  style?: React.CSSProperties
  userYou: YouChooser
}


class PdfDownloadLinkBase extends React.PureComponent<PdfDownloadLinkProps> {
  public static propTypes = {
    diagnosticData: PropTypes.object,
    gaugeRef: PropTypes.object.isRequired,
    onDownloadAsPdf: PropTypes.func,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  private exportToPdf = (): void => {
    svg2image(this.props.gaugeRef.current, 'image/jpeg', 1).then(this.createPdf)
  }

  private createPdf = ({gaugeDataURL, gaugeWidth, gaugeHeight}): void => {
    const {diagnosticData, onDownloadAsPdf, userYou} = this.props
    if (!onDownloadAsPdf) {
      return
    }
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
    const bestTitle = shortTitle || title
    if (bestTitle) {
      doc.text(clearEmoji(clearMarkup(bestTitle)), centerWidth, 5.5, 'center')
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

  private handleHiddenTitle = (dom: HTMLDivElement|null): void => {
    if (!dom) {
      return
    }
    // Target width is that of in-flow div, which is dom's grand-parent.
    const {clientWidth} = dom && dom.parentElement && dom.parentElement.parentElement || {}
    clientWidth && this.setState({
      lineWidth: dom.clientWidth / Math.ceil(dom.clientWidth / clientWidth),
    })
  }

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


interface BobScoreProps {
  gaugeRef?: React.RefObject<SVGSVGElement>
  isAnimated?: boolean
  isTitleShown?: boolean
  score: Score
}

const scoreTitleStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 18 : 25,
  fontWeight: 'bold',
  lineHeight: 1,
  margin: isMobileVersion ? '20px 0 20px 10px' : '0 0 0 40px',
  textAlign: 'center',
}

const ScoreTitleParagraph = (props): React.ReactElement =>
  <div {...props} style={scoreTitleStyle} />

const getScoreTitleStrong = _memoize((color: string) =>
  function ScoreTitleStrong(props): React.ReactElement {
    return <span style={{color}} {...props} />
  })

const BobScoreBase: React.FC<BobScoreProps> =
({gaugeRef, isAnimated, isTitleShown, score: {color, percent, shortTitle}}): React.ReactElement => {
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
    justifyContent: 'center',
    margin: '0 auto',
    maxWidth: isMobileVersion ? 320 : 470,
  }
  // TODO(cyrille): Handle isMobileVersion.
  return <div style={bobScoreStyle}>
    <BobScoreCircle
      {...bobCircleProps}
      color={colorFromPercent(percent)}
      style={{flexShrink: 0}}
      percent={percent}
      isAnimated={isAnimated}
      gaugeRef={gaugeRef} />
    {isTitleShown ? <Markdown
      content={shortTitle}
      renderers={{
        paragraph: ScoreTitleParagraph,
        strong: getScoreTitleStrong(color),
      }} /> : null}
  </div>
}
BobScoreBase.propTypes = {
  gaugeRef: PropTypes.object,
  isAnimated: PropTypes.bool,
  isTitleShown: PropTypes.bool,
  score: PropTypes.shape({
    color: PropTypes.string,
    percent: PropTypes.number.isRequired,
    shortTitle: PropTypes.string.isRequired,
  }).isRequired,
}
BobScoreBase.defaultProps = {
  isTitleShown: true,
}
const BobScore = React.memo(BobScoreBase)


const cardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  border: isMobileVersion ? `solid 2px ${colors.SILVER}` : 'initial',
  borderRadius: 10,
  boxShadow: isMobileVersion ? 'initial' : '0 4px 14px 0 rgba(0, 0, 0, 0.05)',
  margin: isMobileVersion ? 15 : '20px 0',
}


interface ScoreWithHeaderProps {
  baseUrl: string
  gender?: bayes.bob.Gender
  openModifyModal: () => void
  project: bayes.bob.Project
  score: Score
  userYou: YouChooser
}

const scoreHeaderStyle: React.CSSProperties = {
  ...cardStyle,
  alignItems: 'center',
  color: '#fff',
  display: 'flex',
  flexDirection: 'column',
  fontWeight: 'bold',
  marginBottom: -100,
  padding: '35px 20px 125px',
  position: 'relative',
  textShadow: '0 3px 4px rgba(0, 0, 0, 0.5)',
  zIndex: -1,
}

const headerJobCoverStyle = {
  borderRadius: scoreHeaderStyle.borderRadius,
  overflow: 'hidden',
  zIndex: -1,
}

const jobStyle: React.CSSProperties = {
  fontSize: 18,
  margin: '0 0 4px',
  textAlign: 'center',
  textTransform: 'uppercase',
}

const cityStyle: React.CSSProperties = {
  fontSize: 15,
  margin: 0,
  textAlign: 'center',
}

const modifyProjectStyle: RadiumCSSProperties = {
  ':hover': {
    opacity: 1,
  },
  fontSize: 13,
  opacity: .7,
  position: 'absolute',
  right: 20,
  textDecoration: 'underline',
  top: 10,
}

const scoreCardStyle: React.CSSProperties = {
  ...cardStyle,
  alignItems: 'center',
  fontSize: 18,
  fontWeight: 'bold',
  margin: '0 0 30px',
  padding: '45px 25px 20px',
}

const mainSentenceStyle: React.CSSProperties = {
  color: colors.DARK_TWO,
  fontSize: 26,
  fontStyle: 'italic',
  lineHeight: '31px',
  margin: '30px 0',
  textAlign: 'center',
}

const statsLinkStyle: React.CSSProperties = {
  alignItems: 'center',
  color: colors.COOL_GREY,
  display: 'flex',
  fontSize: 13,
  fontWeight: 'bold',
  justifyContent: 'center',
  padding: '15px 0',
  textDecoration: 'none',
}

const separatorStyle: React.CSSProperties = {
  borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
  marginTop: 15,
}

const ScoreWithHeaderBase: React.FC<ScoreWithHeaderProps> =
  (props: ScoreWithHeaderProps): React.ReactElement => {
    const {baseUrl, openModifyModal, gender, project, score, userYou} = props
    const {
      city: {name: cityName = undefined} = {}, diagnostic: {categories = emptyArray} = {},
      targetJob, targetJob: {jobGroup: {romeId = undefined} = {}} = {},
    } = project
    const jobName = genderizeJob(targetJob, gender)
    return <React.Fragment>
      <div style={scoreHeaderStyle}>
        {romeId ? <JobGroupCoverImage romeId={romeId} style={headerJobCoverStyle} /> : null}
        <p style={jobStyle}>{jobName}</p>
        <p style={cityStyle}>{cityName}</p>
        <SmartLink onClick={openModifyModal} style={modifyProjectStyle}>Modifier</SmartLink>
      </div>
      <div style={scoreCardStyle}>
        <BobScore score={score} isTitleShown={false} isAnimated={true} />
        {/* TODO(marielaure): Make sure the title is well balanced. */}
        <div style={mainSentenceStyle}>{score.shortTitle}</div>
        <div style={{margin: '0 20px'}}>
          <CategoriesTrain
            areDetailsShownAsHover={true}
            categories={categories} userYou={userYou} gender={gender} />
          <div style={separatorStyle} />
        </div>
        <Link to={`${baseUrl}/${STATS_PAGE}`} style={statsLinkStyle}>
          En savoir plus
          <ChevronRightIcon size={18} style={{marginLeft: '.2em'}} />
        </Link>
      </div>
    </React.Fragment>
  }
ScoreWithHeaderBase.propTypes = {
  baseUrl: PropTypes.string.isRequired,
  gender: PropTypes.oneOf(['FEMININE', 'MASCULINE', 'UNKNOWN_GENDER']),
  project: PropTypes.shape({
    city: PropTypes.shape({
      name: PropTypes.string.isRequired,
    }).isRequired,
    targetJob: PropTypes.shape({
      jobGroup: PropTypes.shape({
        romeId: PropTypes.string.isRequired,
      }).isRequired,
    }).isRequired,
  }).isRequired,
  score: PropTypes.shape({
    color: PropTypes.string,
    percent: PropTypes.number.isRequired,
    shortTitle: PropTypes.string.isRequired,
  }).isRequired,
  userYou: PropTypes.func.isRequired,
}
const ScoreWithHeader = React.memo(ScoreWithHeaderBase)


interface DiagnosticConnectedProps {
  gender?: bayes.bob.Gender
  hasAccount: boolean
}


interface DiagnosticProps extends DiagnosticConnectedProps {
  advices?: readonly bayes.bob.Advice[]
  areStrategiesEnabled?: boolean
  baseUrl: string
  diagnosticData: bayes.bob.Diagnostic
  dispatch: DispatchAllActions
  isFirstTime?: boolean
  makeAdviceLink: (adviceId: string, strategyId: string) => string
  makeStrategyLink: (strategyId: string) => string
  onDiagnosticTextShown?: () => void
  onDownloadAsPdf?: () => void
  onFullDiagnosticShown?: () => void
  project: bayes.bob.Project
  strategies?: readonly bayes.bob.Strategy[]
  style?: React.CSSProperties
  userName?: string
  userYou: YouChooser
}


const panelTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 'bold',
  margin: '0 0 15px',
  paddingLeft: isMobileVersion ? 0 : 10,
  textAlign: isMobileVersion ? 'center' : 'initial',
}

const titleCardStyle: React.CSSProperties = {
  ...cardStyle,
  fontSize: 30,
  fontWeight: 900,
  marginBottom: 35,
  padding: '15px 35px',
  textAlign: 'center',
}

class DiagnosticBase extends React.PureComponent<DiagnosticProps> {
  public static propTypes = {
    advices: PropTypes.array,
    // TODO(pascal): Convert other cases to the strategies and drop this.
    areStrategiesEnabled: PropTypes.bool,
    baseUrl: PropTypes.string.isRequired,
    diagnosticData: PropTypes.object.isRequired,
    hasAccount: PropTypes.bool,
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
    userName: PropTypes.string,
    userYou: PropTypes.func.isRequired,
  }

  public state = {
    areStrategiesShown: !this.props.isFirstTime,
    isDiagnosticTextShown: this.props.isFirstTime,
    isFullTextShown: false,
    isModifyModalShown: false,
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

  private _score: Score|undefined

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

  private setModifyModalShown = _memoize((isModifyModalShown): (() => void) => (): void =>
    this.setState({isModifyModalShown}))

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
            percent={percent} isAnimated={!isFullTextShown} color={colorFromPercent(percent)}
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
    const {areStrategiesShown, isDiagnosticTextShown, isFullTextShown,
      isModifyModalShown} = this.state
    const {advices = [], areStrategiesEnabled, baseUrl, diagnosticData, gender, hasAccount,
      isFirstTime, onDownloadAsPdf, makeAdviceLink, makeStrategyLink, project,
      project: {city, targetJob}, strategies = [], style, userYou} = this.props
    const {categoryId, strategiesIntroduction} = diagnosticData
    const isBobTalksModalShown = areStrategiesEnabled && isDiagnosticTextShown && !isMobileVersion
    if (isDiagnosticTextShown && !isBobTalksModalShown) {
      return this.renderDiagnosticText()
    }
    const isSignUpBannerShown = !hasAccount && !isFirstTime
    const score = this.getScore()
    const adviceProps = _mapValues(
      _keyBy(advices, 'adviceId'),
      ({isForAlphaOnly, status}): bayes.bob.Advice => ({isForAlphaOnly, status}))
    if (areStrategiesEnabled) {
      const pageStyle: React.CSSProperties = {
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 50,
      }
      // TODO(pascal): Add mobile version as well.
      const contentStyle: React.CSSProperties = {
        backgroundColor: isMobileVersion ? '#fff' : 'initial',
        display: 'flex',
        flexDirection: isMobileVersion ? 'column' : 'row',
        justifyContent: 'center',
        paddingBottom: 50,
        paddingTop: 0,
      }
      // TODO(marielaure): Put a smooth transition when closing the sign up banner.
      return <div style={pageStyle}>
        {isMobileVersion ? null : <ModifyProjectModal
          project={project} isShown={isModifyModalShown}
          onClose={this.setModifyModalShown(false)} />}
        {isSignUpBannerShown ?
          <SignUpBanner style={{margin: '0 0 50px', width: 1000}} userYou={userYou} /> : null}
        <div style={contentStyle}>
          {isBobTalksModalShown ? this.renderDiagnosticText(true) : null}
          {isMobileVersion ? null : <div style={{position: 'relative', width: 360, zIndex: 0}}>
            <h2 style={panelTitleStyle}>{userYou('Ton', 'Votre')} projet</h2>
            <ScoreWithHeader
              openModifyModal={this.setModifyModalShown(true)}
              {...{baseUrl, gender, project, score, userYou}} />
            <div style={{...cardStyle, overflow: 'hidden'}}>
              <BobThinksVisualCard category={categoryId} {...{project, userYou}} />
              {/* TODO(cyrille): Only hide the link when the footnote is
                actually present in the visual card. */}
              {categoryId && APPLICATION_MODES_VC_CATEGORIES.has(categoryId) ?
                null : <SideLink
                  onClick={this.handleDispatch(followJobOffersLinkAction)}
                  href={getPEJobBoardURL(targetJob, city)}>Voir les offres d'emploi</SideLink>}
            </div>
            {/* TODO(pascal): Re-enable PDF */}
          </div>}
          <div
            style={{marginLeft: isMobileVersion ? 0 : 40, width: isMobileVersion ? '100%' : 600}}>
            {isMobileVersion ? this.renderMobileTopSections(score, cardStyle) :
              areStrategiesShown ? null : <React.Fragment>
                <h2 style={{...panelTitleStyle, visibility: 'hidden'}}>Stratégies possibles</h2>
                <div style={titleCardStyle}>
                  <StrategiesIntroduction
                    onClick={this.handleOpenStrategies} text={strategiesIntroduction} />
                </div>
              </React.Fragment>}
            {areStrategiesShown ? <Strategies
              {...{adviceProps, makeAdviceLink, makeStrategyLink,
                project, userYou}}
              strategies={strategies}
              strategyStyle={cardStyle} titleStyle={panelTitleStyle} /> : null}
          </div>
        </div>
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
      top: (isMobileVersion ? 20 : 40) + (isSignUpBannerShown ? 170 : 0),
    }
    const headerStyle: React.CSSProperties = {
      alignSelf: 'stretch',
      display: 'flex',
      flexDirection: 'column',
      marginBottom: 20,
    }
    const downloadLinkStyle: React.CSSProperties = isMobileVersion ?
      {display: 'block', textAlign: 'center'} :
      {
        position: 'absolute',
        right: 0,
        top: isSignUpBannerShown ? 170 : 0,
        transition: SmoothTransitions.transition + ', top 0s',
      }
    return <div style={pageStyle}>
      {isSignUpBannerShown ?
        <SignUpBanner style={{margin: '0 0 50px', width: 1000}} userYou={userYou} /> : null}
      <HoverableBobHead
        style={bobHeadStyle}
        onClick={this.handleReopenDiagnosticText} />
      {isMobileVersion ? <BobScore score={score} isAnimated={!isFullTextShown} /> : <React.Fragment>
        <div style={headerStyle}>
          <BobScore score={score} isAnimated={!isFullTextShown} gaugeRef={this.gaugeRef} />
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
const Diagnostic = connect(({user: {hasAccount, profile: {gender} = {}}}: RootState):
DiagnosticConnectedProps => ({
  gender,
  hasAccount: !!hasAccount,
}))(DiagnosticBase)


export {BobThinksVisualCard, ComponentScore, DiagnosticText, DiagnosticMetrics, Diagnostic}
