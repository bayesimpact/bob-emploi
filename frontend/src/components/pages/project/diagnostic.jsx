import jsPDF from 'jspdf'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import DownloadIcon from 'mdi-react/DownloadIcon'
import PropTypes from 'prop-types'
import React from 'react'
import VisibilitySensor from 'react-visibility-sensor'

import config from 'config'

import {colorFromPercent, computeNewBobScore} from 'store/score'

import {Colors, Button, GrowingNumber, PercentBar, Markdown,
  SmoothTransitions, Styles, colorToComponents} from 'components/theme'


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
    const percentColor = !hasStartedGrowing ? Colors.RED_PINK : colorFromPercent(percent)
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


class ComponentScore extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    component: PropTypes.shape({
      isDefined: PropTypes.bool,
      percent: PropTypes.number.isRequired,
      text: PropTypes.string.isRequired,
      title: PropTypes.func.isRequired,
    }).isRequired,
    isFirstSubmetric: PropTypes.bool.isRequired,
    isTextShown: PropTypes.bool,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {children, component, isFirstSubmetric, isTextShown, userYou, style} = this.props
    const {isDefined, title, percent, text} = component
    const componentScoreStyle = {
      borderTop: isFirstSubmetric ? 'initial' : `1px solid ${Colors.MODAL_PROJECT_GREY}`,
      opacity: isDefined ? 'initial' : 0.5,
      paddingBottom: 17,
      paddingTop: isFirstSubmetric ? 'initial' : 18,
      width: '100%',
      ...style,
    }
    const titleStyle = {
      color: Colors.DARK_TWO,
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 9,
    }
    const textStyle = {
      color: Colors.SLATE,
      fontSize: 14,
      lineHeight: 1.29,
    }
    return <div style={componentScoreStyle}>
      <div style={titleStyle}>{title(userYou)}</div>
      <PercentBar percent={percent} color={colorFromPercent(percent)} showPercent={isDefined} />
      {isTextShown ? <div style={textStyle}><Markdown content={text} /></div> : null}
      {children}
    </div>
  }
}


class DiagnosticMetrics extends React.Component {
  static propTypes = {
    components: PropTypes.array.isRequired,
    isTextShown: PropTypes.bool,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {components, isTextShown, userYou} = this.props
    const subDiagnosticsStyle = {
      color: Colors.DARK_TWO,
    }
    return <div style={subDiagnosticsStyle}>
      <div style={{alignItems: 'center', display: 'flex', flexDirection: 'column'}}>
        {components.map((component, index) =>
          <ComponentScore
            key={index}
            isFirstSubmetric={index === 0}
            {...{component, isTextShown, userYou}} />
        )}
      </div>
    </div>
  }
}


class DiagnosticText extends React.Component {
  static propTypes = {
    diagnosticSentences: PropTypes.string,
  }

  static defaultProps = {
    diagnosticSentences: `Nous ne sommes pas encore capable de vous proposer une analyse globale de
votre situation. Certaines informations sur votre marché ne sont pas encore disponibles dans
notre base de données.

Cependant, vous pouvez déjà consulter les indicateurs ci-contre.

Nous allons vous proposer une sélection de conseils personnalisés pour vous aider dans votre
recherche.`,
  }

  render() {
    const {diagnosticSentences} = this.props
    const pepTalkStyle = {
      color: Colors.DARK_TWO,
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


class Diagnostic extends React.Component {
  static propTypes = {
    diagnosticData: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
    onDownloadAsPdf: PropTypes.func,
    onShown: PropTypes.func,
    userName: PropTypes.string.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  state = {}

  componentWillMount() {
    const {onShown} = this.props
    onShown && onShown()
  }

  exportToPdf = () => {
    svg2image(this.gaugeDom, 'image/jpeg', 1).then(this.createPdf)
  }

  createPdf = ({gaugeDataURL, gaugeWidth, gaugeHeight}) => {
    const {diagnosticData, onDownloadAsPdf, userYou} = this.props
    const {components, percent, title} = computeNewBobScore(diagnosticData)
    const doc = new jsPDF({format: 'a4', orientation: 'landscape', unit: 'cm'})

    const centerWidth = 14.85 // 29.7 cm / 2

    // Header.
    if (gaugeDataURL && gaugeWidth) {
      doc.addImage(gaugeDataURL, 'JPEG', centerWidth - 1.5, 2.4, 3, 3 * gaugeHeight / gaugeWidth)
    }
    doc.setFontSize(14)
    doc.text('Diagnostic de Bob', centerWidth, 2, 'center')
    doc.setTextColor(Colors.DARK_TWO)
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
      doc.setTextColor(...colorToComponents(Colors.DARK_TWO))
      doc.setFontType('bold')
      doc.text(title(userYou), rightPageLeftOffset, cursorHeight)
      doc.setFontType('normal')

      cursorHeight += .3

      // Progress bar.
      doc.setFillColor(...colorToComponents(Colors.MODAL_PROJECT_GREY))
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
      doc.setTextColor(...colorToComponents(Colors.SLATE))
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
    const color = isDownloadLinkHovered ? Colors.DARK_TWO : Colors.COOL_GREY
    const downloadStyle = {
      color,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 500,
      textDecoration: 'underline',
      ...SmoothTransitions,
      ...style,
    }
    return <a
      onClick={this.exportToPdf} style={downloadStyle}
      onMouseEnter={() => this.setState({isDownloadLinkHovered: true})}
      onMouseLeave={() => this.setState({isDownloadLinkHovered: false})}>
      <DownloadIcon
        fill={color} height={16} style={{verticalAlign: 'middle', ...SmoothTransitions}} />
      Télécharger mon diagnostic en PDF
    </a>
  }

  render() {
    const {diagnosticData, onClose, userYou, userName} = this.props
    const {isMobileVersion} = this.context
    const centerOnMobile = isMobileVersion ? {
      margin: '0 auto',
    } : {}
    const bobScoreStyle = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      margin: '0 auto 51px',
    }
    const titleStyle = {
      color: Colors.DARK_TWO,
      fontSize: 25,
      fontWeight: 'bold',
      lineHeight: 1,
      marginTop: 41.2,
    }
    const generalLayoutStyle = {
      alignItems: isMobileVersion ? 'center' : 'initial',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      margin: '0 auto',
      padding: isMobileVersion ? '0 20px' : 'initial',
    }
    const adviceButtonStyle = {
      ...centerOnMobile,
      display: 'block',
      marginBottom: 30,
      marginTop: 30,
    }
    const pepTalkStyle = {
      marginBottom: 30,
      marginRight: isMobileVersion ? 'auto' : 57,
      maxWidth: isMobileVersion ? 425 : 500,
    }
    const subDiagnosticsStyle = {
      ...centerOnMobile,
      borderLeft: isMobileVersion ? 'initial' : `1px solid ${Colors.MODAL_PROJECT_GREY}`,
      marginTop: 13,
      maxWidth: 425 + (isMobileVersion ? 0 : 18),
      paddingBottom: 20,
      paddingLeft: isMobileVersion ? 0 : 17,
    }
    const {components, percent, title} = computeNewBobScore(diagnosticData, userName, userYou)
    const sendAMailStyle = {
      color: Colors.DARK_TWO,
      fontSize: 15,
      fontStyle: 'italic',
      lineHeight: '23px',
    }
    const fixedScrollButtonStyle = {
      borderRadius: 0,
      bottom: 0,
      fontSize: 13,
      width: '100%',
    }
    const chevronMobileButtonStyle = {
      alignItems: 'center',
      bottom: 0,
      display: 'flex',
      position: 'absolute',
      right: 10,
      top: 0,
    }
    return <div ref={dom => {
      this.dom = dom
    }} style={{position: 'relative'}}>
      <div style={bobScoreStyle}>
        <BobScoreCircle percent={percent} gaugeRef={gaugeDom => this.gaugeDom = gaugeDom} />
        <div style={titleStyle}>{title}</div>
      </div>
      {this.renderDownloadLink(
        isMobileVersion ?
          {display: 'block', textAlign: 'center'} :
          {position: 'absolute', right: 0, top: 0})}
      <div style={generalLayoutStyle}>
        <div style={pepTalkStyle}>
          <DiagnosticText diagnosticSentences={diagnosticData.text} />
          {isMobileVersion ? null : <div style={adviceButtonStyle}>
            <Button onClick={onClose}>
              Voir mes conseils maintenant
            </Button>
          </div>}
          {diagnosticData.text ? null : <p style={sendAMailStyle}>
            Pour obtenir une analyse de votre profil vous pouvez nous
            envoyer <a href={config.helpRequestUrl}>un message</a>.

            Un membre de l'équipe de {config.productName} vous enverra un diagnostic personnalisé.
          </p>}
        </div>
        <div style={subDiagnosticsStyle}>
          <DiagnosticMetrics isTextShown={true} {...{components, userYou}} />
        </div>
        {isMobileVersion ? <React.Fragment>
          <Button style={{...fixedScrollButtonStyle, position: 'fixed'}} onClick={onClose}>
            Voir mes conseils maintenant
            <div style={chevronMobileButtonStyle}>
              <ChevronRightIcon fill="#fff" />
            </div>
          </Button>
          <div style={fixedScrollButtonStyle} />
        </React.Fragment> : null}
      </div>
    </div>
  }
}

export {BobScoreCircle, ComponentScore, DiagnosticText, DiagnosticMetrics, Diagnostic}
