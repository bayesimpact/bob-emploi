import jsPDF from 'jspdf'
import _mapValues from 'lodash/mapValues'
import _sortBy from 'lodash/sortBy'
import DownloadIcon from 'mdi-react/DownloadIcon'
import PropTypes from 'prop-types'
import React from 'react'
import VisibilitySensor from 'react-visibility-sensor'
import setPropType from 'es6-set-proptypes'

import {colorFromPercent, computeBobScore} from 'store/score'

import categories from 'components/advisor/data/categories.json'
import {FastForward} from 'components/fast_forward'
import {isMobileVersion} from 'components/mobile'
import {BubbleToRead, Discussion, DiscussionBubble, NoOpElement,
  WaitingElement} from 'components/phylactery'
import {Button, GrowingNumber, PercentBar, Markdown,
  SmoothTransitions, Styles, UpDownIcon, colorToComponents} from 'components/theme'
import bobHeadImage from 'images/bob-head.svg'

import {DiagnosticAdvices} from './advice'


const categorySets = _mapValues(categories, list => new Set(list))

const defaultDiagnosticSentences = `Nous ne sommes pas encore capable de vous proposer une analyse
globale de votre situation. Certaines informations sur votre marché ne sont pas encore disponibles
dans notre base de données.

Cependant, vous pouvez déjà consulter les indicateurs ci-contre.

Pour obtenir une analyse de votre profil vous pouvez nous
envoyer [un message](${config.helpRequestUrl}).

Un membre de l'équipe de ${config.productName} vous enverra un diagnostic personnalisé.`

// Convert an inline SVG in the DOM to an image.
// (Move to a common library if it's needed somewhere else).
function svg2image(svgDom, mimeType, qualityOption) {
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

  return new Promise(resolve => {
    const image = new Image()
    image.onload = () => {
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


class BobScoreCircle extends React.Component {
  static propTypes = {
    durationMillisec: PropTypes.number.isRequired,
    gaugeRef: PropTypes.func,
    halfAngleDeg: PropTypes.number.isRequired,
    isAnimated: PropTypes.bool.isRequired,
    percent: PropTypes.number.isRequired,
    radius: PropTypes.number.isRequired,
    scoreSize: PropTypes.number.isRequired,
    strokeWidth: PropTypes.number.isRequired,
  }

  static defaultProps = {
    durationMillisec: 1000,
    halfAngleDeg: 67.4,
    isAnimated: true,
    radius: 78.6,
    scoreSize: 36.4,
    strokeWidth: 5.2,
  }

  state = {
    hasStartedGrowing: !this.props.isAnimated,
  }

  startGrowing = isVisible => {
    if (!isVisible) {
      return
    }
    this.setState({hasStartedGrowing: true})
  }

  // Gives the point on the Bob score circle according to clockwise angle with origin at the bottom.
  getPointFromAngle = rad => {
    const {radius} = this.props
    const x = -radius * Math.sin(rad)
    const y = radius * Math.cos(rad)
    return {x, y}
  }

  describeSvgArc = (startAngle, endAngle) => {
    const {radius} = this.props
    const largeArcFlag = endAngle - startAngle <= Math.PI ? '0' : '1'
    const start = this.getPointFromAngle(startAngle)
    const end = this.getPointFromAngle(endAngle)
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`
  }

  render() {
    const {
      durationMillisec,
      gaugeRef,
      halfAngleDeg,
      isAnimated,
      percent,
      radius,
      scoreSize,
      strokeWidth,
      ...extraProps
    } = this.props
    const {hasStartedGrowing} = this.state

    const startAngle = halfAngleDeg * Math.PI / 180
    const endAngle = 2 * Math.PI - startAngle
    const percentAngle = 2 * (Math.PI - startAngle) * percent / 100 + startAngle

    const largeRadius = radius + strokeWidth
    const totalWidth = 2 * largeRadius
    const totalHeight = largeRadius + strokeWidth + this.getPointFromAngle(startAngle).y

    const arcLength = radius * (percentAngle - startAngle)
    const partialArcLength = hasStartedGrowing ? arcLength : 0
    const percentPath = this.describeSvgArc(startAngle, percentAngle)
    const fullPath = this.describeSvgArc(startAngle, endAngle)
    const containerStyle = {
      height: totalHeight,
      marginBottom: -strokeWidth,
      marginTop: -strokeWidth,
      position: 'relative',
      width: totalWidth,
    }
    const percentStyle = {
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
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    const percentColor = !hasStartedGrowing ? colors.RED_PINK : colorFromPercent(percent)
    const transitionStyle = {
      transition: `stroke ${durationMillisec}ms cubic-bezier(1,0,.53,1),
       stroke-dasharray ${durationMillisec}ms linear`,
    }
    return <div {...extraProps} style={containerStyle}>
      <VisibilitySensor
        active={!hasStartedGrowing} intervalDelay={250}
        onChange={this.startGrowing} />
      <div style={percentStyle}>
        {isAnimated ?
          <GrowingNumber durationMillisec={durationMillisec} number={percent} isSteady={true} /> :
          percent
        }%
      </div>
      <svg
        fill="none" ref={gaugeRef}
        viewBox={`${-largeRadius} ${-largeRadius} ${totalWidth} ${totalHeight}`}>
        <g stroke={percentColor} strokeLinecap="round">
          <path d={fullPath} opacity={0.3} strokeWidth={strokeWidth} />
          <path
            style={transitionStyle}
            d={percentPath}
            strokeDasharray={`${partialArcLength}, ${arcLength}`}
            strokeWidth={2 * strokeWidth}
          />
        </g>
      </svg>
    </div>
  }
}


// This is a simplified component, for eval use only.
// TODO(cyrille): Merge with SubmetricDropDown to avoid discrepancies between app and eval.
class ComponentScore extends React.Component {
  static propTypes = {
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

  render() {
    const {children, component, userYou, style} = this.props
    const {isDefined, title, percent, text} = component
    const componentScoreStyle = {
      borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
      color: colors.DARK_TWO,
      opacity: isDefined ? 'initial' : 0.5,
      paddingBottom: 17,
      width: '100%',
      ...style,
    }
    const titleStyle = {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 9,
    }
    const textStyle = {
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


class SubmetricDropDown extends React.Component {
  static propTypes = {
    advices: PropTypes.array.isRequired,
    isAlwaysExpanded: PropTypes.bool,
    isDefined: PropTypes.bool,
    isFirstSubmetric: PropTypes.bool,
    lockedAdvices: setPropType.isRequired,
    makeAdviceLink: PropTypes.func.isRequired,
    percent: PropTypes.number.isRequired,
    style: PropTypes.object,
    text: PropTypes.string.isRequired,
    title: PropTypes.string,
    userYou: PropTypes.func.isRequired,
  }

  state = {
    isExpanded: this.props.isAlwaysExpanded,
  }

  render() {
    const {advices, isAlwaysExpanded, isDefined, isFirstSubmetric, lockedAdvices, makeAdviceLink,
      percent, style, text, title, userYou} = this.props
    if (!isDefined) {
      return null
    }
    const {isExpanded} = this.state
    const border = `1px solid ${colors.NEW_GREY}`
    const containerStyle = {
      borderBottom: isMobileVersion ? border : 'initial',
      borderTop: isFirstSubmetric && isMobileVersion ? border : 'initial',
      boxShadow: isMobileVersion ? 'initial' : '0 5px 25px 0 rgba(0, 0, 0, 0.2)',
      fontSize: 13,
      maxWidth: 700,
      ...style,
    }
    const headerStyle = {
      alignItems: 'center',
      cursor: isAlwaysExpanded ? 'initial' : 'pointer',
      display: 'flex',
      fontSize: 15,
      height: 50,
      padding: isMobileVersion ? '0 20px' : '0 45px',
    }
    const contentStyle = {
      height: isExpanded ? 'initial' : 0,
      overflow: 'hidden',
      padding: isExpanded ? (isMobileVersion ? '10px 20px' : '13px 45px 45px') : '0 20px',
      ...SmoothTransitions,
    }
    const headAndBubbleStyle = {
      alignItems: 'flex-start',
      display: 'flex',
    }
    const textStyle = {
      backgroundColor: colors.NEW_GREY,
      borderRadius: '5px 15px 15px',
      flex: 1,
      fontSize: 14,
      lineHeight: 1.29,
      margin: '10px 0 0 13px',
      maxWidth: isMobileVersion ? 'initial' : 350,
      padding: '10px 15px',
    }
    const color = colorFromPercent(percent)
    const percentStyle = {
      color,
      fontWeight: 'bold',
      margin: isMobileVersion ? '0 22px' : '0 0 0 30px',
    }
    const advicesProps = {advices, lockedAdvices, makeAdviceLink, userYou}
    return <div style={containerStyle}>
      <div
        style={headerStyle}
        onClick={isAlwaysExpanded ? null : () => this.setState({isExpanded: !isExpanded})}>
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
        <div style={headAndBubbleStyle}>
          <img src={bobHeadImage} alt="" style={{width: isMobileVersion ? 30 : 51}} />
          <div style={textStyle}>
            {text}
            {isMobileVersion ? <DiagnosticAdvices {...advicesProps} /> : null}
          </div>
        </div>
        {isMobileVersion ? null :
          <DiagnosticAdvices style={{marginTop: 32}} {...advicesProps} />}
      </div>
    </div>
  }
}


// TODO(marielaure): Maybe refactorize with SubmetricDropDown and DiagnosticMetrics.
class DiagnosticSummary extends React.Component {
  static propTypes = {
    components: PropTypes.arrayOf(PropTypes.shape({
      percent: PropTypes.number,
      shortTitle: PropTypes.string.isRequired,
      topic: PropTypes.string.isRequired,
    }).isRequired),
    style: PropTypes.object,
  }

  renderPercentBar(color, percent) {
    const percentStyle = {
      color,
      fontWeight: 'bold',
      marginLeft: 15,
    }
    return <React.Fragment>
      <PercentBar
        {...{color, percent}} height={10}
        style={{marginBottom: 0, maxWidth: 140}} isPercentShown={false} />
      <span style={percentStyle}>{percent}%</span>
    </React.Fragment>
  }

  render() {
    const {components, style} = this.props
    const summaryStyle = {
      color: colors.DARK_TWO,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-around',
      padding: '0 15px',
      ...style,
    }
    const componentStyle = {
      alignItems: 'center',
      display: 'flex',
    }
    return <div style={summaryStyle}>
      {_sortBy(components, 'percent').map(({percent, shortTitle, topic}) =>
        <div key={topic} style={componentStyle}>
          <span>{shortTitle}</span>
          <div style={{flex: 1}} />
          {this.renderPercentBar(colorFromPercent(percent), percent)}
        </div>
      )}
    </div>
  }
}


class DiagnosticMetrics extends React.Component {
  static propTypes = {
    advices: PropTypes.array.isRequired,
    components: PropTypes.arrayOf(PropTypes.shape({
      isDefined: PropTypes.bool,
      percent: PropTypes.number,
      text: PropTypes.string,
      title: PropTypes.func.isRequired,
      topic: PropTypes.string.isRequired,
    }).isRequired),
    lockedAdvices: setPropType.isRequired,
    makeAdviceLink: PropTypes.func.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {advices, components, lockedAdvices, makeAdviceLink, style, userYou} = this.props
    const subDiagnosticsStyle = {
      color: colors.DARK_TWO,
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }
    return <div style={subDiagnosticsStyle}>
      {_sortBy(components, 'percent').map(({isDefined, percent, text, title, topic}, index) =>
        <SubmetricDropDown
          key={topic} makeAdviceLink={adviceId => makeAdviceLink(adviceId, topic)}
          style={{marginTop: index && !isMobileVersion ? 40 : 0}}
          isFirstSubmetric={!index} title={title(userYou)} isAlwaysExpanded={!isMobileVersion}
          advices={advices.
            filter(({adviceId}) => (categorySets[topic] || new Set()).has(adviceId))}
          {...{isDefined, lockedAdvices, percent, text, userYou}} />
      )}
    </div>
  }
}


class DiagnosticText extends React.Component {
  static propTypes = {
    diagnosticSentences: PropTypes.string,
  }

  static defaultProps = {
    diagnosticSentences: defaultDiagnosticSentences,
  }

  render() {
    const {diagnosticSentences} = this.props
    const pepTalkStyle = {
      color: colors.DARK_TWO,
      fontSize: 17,
      lineHeight: '25px',
      margin: '0 auto',
      maxWidth: 500,
    }
    return <div style={pepTalkStyle}>
      <Markdown content={diagnosticSentences} />
    </div>
  }
}


class HoverableBobHead extends React.Component {
  static propTypes = {
    style: PropTypes.object,
    width: PropTypes.number.isRequired,
  }

  static defaultProps = {
    width: 55,
  }

  state = {
    isHovered: false,
  }

  render() {
    const {style, width, ...otherProps} = this.props
    const {isHovered} = this.state
    const hoverStyle = {
      borderRadius: width,
      bottom: 0,
      boxShadow: isHovered ? ' 0 10px 15px 0 rgba(0, 0, 0, 0.2)' : 'initial',
      height: width,
      left: 0,
      position: 'absolute',
      right: 0,
      width,
    }
    return <div
      onMouseEnter={() => this.setState({isHovered: true})}
      onMouseLeave={() => this.setState({isHovered: false})}
      style={{position: 'relative', ...style}} {...otherProps}>
      <div style={hoverStyle} />
      <img src={bobHeadImage} alt={config.productName} style={{display: 'block', width}} />
    </div>
  }
}


class Diagnostic extends React.Component {
  static propTypes = {
    advices: PropTypes.array,
    diagnosticData: PropTypes.object.isRequired,
    isFirstTime: PropTypes.bool,
    lockedAdvices: setPropType.isRequired,
    makeAdviceLink: PropTypes.func.isRequired,
    onDownloadAsPdf: PropTypes.func,
    onShown: PropTypes.func,
    style: PropTypes.object,
    userName: PropTypes.string.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  state = {
    isDiagnosticTextShown: this.props.isFirstTime,
  }

  componentDidMount() {
    const {onShown} = this.props
    onShown && onShown()
  }

  componentDidUpdate(prev) {
    const {diagnosticData, userName, userYou} = this.props
    if (prev.userName === userName && prev.userYou(true, false) === userYou(true, false) &&
      prev.diagnosticData === diagnosticData) {
      return
    }
    this._score = undefined
  }

  getScore = () => {
    if (this._score) {
      return this._score
    }
    const {diagnosticData, userName, userYou} = this.props
    this._score = computeBobScore(diagnosticData, userName, userYou)
    return this._score
  }

  exportToPdf = () => {
    svg2image(this.gaugeDom, 'image/jpeg', 1).then(this.createPdf)
  }

  createPdf = ({gaugeDataURL, gaugeWidth, gaugeHeight}) => {
    const {diagnosticData, onDownloadAsPdf, userYou} = this.props
    const {components, percent, title} = computeBobScore(diagnosticData)
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
    if (title) {
      doc.text(title, centerWidth, 5.5, 'center')
    }
    doc.setFontType('normal')

    let cursorHeight = 7.5

    // Text on the left.
    doc.setFontSize(14)
    if (diagnosticData.text) {
      const textLines = doc.setFontSize(14).splitTextToSize(diagnosticData.text, centerWidth - 1.5)
      doc.text(textLines, 1, cursorHeight)
    }

    // Components on the right.
    const rightPageLeftOffset = centerWidth + .5
    components.filter(({percent}) => percent).forEach(({percent, text, title}) => {
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
        const textLines = doc.splitTextToSize(text, centerWidth - 1.5)
        doc.text(textLines, rightPageLeftOffset, cursorHeight + .57)
        cursorHeight += .37 * textLines.length
      }
      cursorHeight += .57 + .6
    })

    doc.save(`Diagnostic de ${config.productName}`)
    onDownloadAsPdf()
  }

  renderDownloadLink(style) {
    const {onDownloadAsPdf} = this.props
    if (!onDownloadAsPdf) {
      return
    }
    const {isDownloadLinkHovered} = this.state
    const color = isDownloadLinkHovered ? colors.DARK_TWO : colors.COOL_GREY
    const downloadStyle = {
      color,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 500,
      padding: isMobileVersion ? '20px 0' : '10px 0',
      textDecoration: 'underline',
      ...SmoothTransitions,
      ...style,
    }
    return <a
      onClick={this.exportToPdf} style={downloadStyle}
      onMouseEnter={() => this.setState({isDownloadLinkHovered: true})}
      onMouseLeave={() => this.setState({isDownloadLinkHovered: false})}>
      <DownloadIcon
        style={{fill: color, height: 16, verticalAlign: 'middle', ...SmoothTransitions}} />
      Télécharger mon diagnostic en PDF
    </a>
  }

  onTextForward = () => {
    if (this.state.isFullTextShown) {
      this.setState({isDiagnosticTextShown: false})
      return
    }
    this.setState({isFullTextShown: true})
  }

  handleCloseDiagnosticText = () => {
    this.setState({isDiagnosticTextShown: false}, () => window.scrollTo(0, 0))
  }

  renderDiagnosticText() {
    const {diagnosticData: {text}, isFirstTime, style} = this.props
    const {isFullTextShown} = this.state
    const {percent, title} = this.getScore()
    const sentences = (text || defaultDiagnosticSentences).split('\n\n')
    const circleAnimationDuration = 1000
    const pageStyle = {
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
        onDone={() => this.setState({isFullTextShown: true})}>
        <NoOpElement style={{margin: '0 auto 20px'}}>
          <BobScoreCircle
            percent={percent} isAnimated={!isFullTextShown}
            durationMillisec={circleAnimationDuration} />
        </NoOpElement>
        <WaitingElement waitingMillisec={circleAnimationDuration * 1.5} />
        <DiscussionBubble>
          {[title].concat(sentences).map((sentence, index) =>
            <BubbleToRead key={index}>
              <Markdown
                content={sentence}
                renderers={{paragraph: props => <p style={{margin: 0}} {...props} />}} />
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

  renderBobScore({adjective, color, percent}) {
    const bobCircleProps = isMobileVersion ? {
      halfAngleDeg: 66.7,
      radius: 60,
      scoreSize: 35,
      strokeWidth: 4,
    } : {}
    const titleStyle = {
      color: colors.DARK_TWO,
      fontSize: isMobileVersion ? 18 : 25,
      fontWeight: 'bold',
      lineHeight: 1,
      margin: isMobileVersion ? '30px 25px 25px 25px' : '30px 0',
      textAlign: 'center',
    }
    return <React.Fragment>
      <BobScoreCircle
        {...bobCircleProps}
        percent={percent}
        isAnimated={!this.state.isFullTextShown}
        gaugeRef={gaugeDom => this.gaugeDom = gaugeDom} />
      <div style={titleStyle}>
        Objectif <span style={{color}}>{adjective}</span>{percent >= 40 ? '\u00A0!' : ''}
      </div>
    </React.Fragment>
  }

  render() {
    const {isDiagnosticTextShown} = this.state
    if (isDiagnosticTextShown) {
      return this.renderDiagnosticText()
    }
    const {advices = [], lockedAdvices, makeAdviceLink, style, userYou} = this.props
    const pageStyle = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: isMobileVersion ? 20 : 50,
      paddingTop: 48,
      position: 'relative',
      ...style,
    }
    const score = this.getScore()
    const bobHeadStyle = {
      cursor: 'pointer',
      left: isMobileVersion ? 'initial' : '100%',
      marginLeft: isMobileVersion ? 0 : 15,
      position: 'absolute',
      right: isMobileVersion ? 20 : 'initial',
      top: isMobileVersion ? 20 : 40,
    }
    const bobScoreStyle = {
      alignItems: 'center',
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      justifyContent: 'center',
    }
    const metricsTitleStyle = {
      borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
      fontSize: 11,
      padding: '30px 0 25px',
      textAlign: 'center',
      textTransform: 'uppercase',
      width: 700,
    }
    return <div style={pageStyle}>
      <HoverableBobHead
        style={bobHeadStyle}
        onClick={() => this.setState({isDiagnosticTextShown: true, isFullTextShown: true})} />
      {isMobileVersion ? this.renderBobScore(score) : <React.Fragment>
        <div style={{alignSelf: 'stretch', display: 'flex', marginBottom: 20}}>
          <div style={bobScoreStyle}>
            {this.renderBobScore(score)}
          </div>
          <div style={{borderLeft: `solid 1px ${colors.SILVER}`, margin: '0 10px'}} />
          <DiagnosticSummary components={score.components} style={{flex: 1}} />
        </div>
        <div style={metricsTitleStyle}>Détails de l'évaluation</div>
      </React.Fragment>}
      <DiagnosticMetrics components={score.components}
        {...{advices, lockedAdvices, makeAdviceLink, userYou}} />
      {this.renderDownloadLink(
        isMobileVersion ?
          {display: 'block', textAlign: 'center'} :
          {position: 'absolute', right: 0, top: 0})}
    </div>
  }
}

export {BobScoreCircle, ComponentScore, DiagnosticText, DiagnosticMetrics, Diagnostic}
