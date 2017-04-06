import React from 'react'
import VisibilitySensor from 'react-visibility-sensor'

import {USER_PROFILE_SHAPE} from 'store/user'

import {Colors, Markdown, Styles} from 'components/theme'

import {AdviceBox, AdviceCard, GrowingNumber, PaddedOnMobile, PersonalizationBoxes} from './base'


class NetworkAdviceCard extends React.Component {
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  render() {
    const {isMobileVersion} = this.context
    const reasons = ['NETWORK_ESTIMATE', 'NO_OFFERS', 'ATYPIC_PROFILE', 'NO_OFFER_ANSWERS']
    const explanationStyle = {
      flex: 1,
      fontSize: 16,
      lineHeight: '21px',
      marginTop: 15,
    }
    return <AdviceCard {...this.props} reasons={reasons}>
      <section style={{alignItems: 'center', display: 'flex'}}>
        <div style={explanationStyle}>
          <strong style={{color: Colors.SKY_BLUE, fontSize: 40}}>
            <GrowingNumber number={44} isSteady={true} />%
          </strong> des
          gens retrouvent un emploi grâce à <strong>leurs contacts</strong> contre
          seulement <strong>12%</strong> via
          des offres <strong>sur internet</strong>.
        </div>
        {isMobileVersion ? null : <JobOriginChart />}
      </section>
    </AdviceCard>
  }
}


// A graph to compare the offers coming from web offers and those coming from network.
// For now, we give the same graph to everybody, so the data is not passed by the props.
class JobOriginChart extends React.Component {
  static propTypes = {
    // Duration of appearance of one bar.
    barEntranceDurationMillisec: React.PropTypes.number.isRequired,
    // Total duration of appearance animation.
    entranceAnimationDurationMillisec: React.PropTypes.number.isRequired,
    isLegendShown: React.PropTypes.bool,
    style: React.PropTypes.object,
  }
  static defaultProps = {
    barEntranceDurationMillisec: 500,
    entranceAnimationDurationMillisec: 500,
  }

  componentWillMount() {
    this.graphData = [
      {percentage: 12, title: 'Retour grâce à des offres internet'},
      {isHighlighted: true, percentage: 44, title: "Retour grâce à l'etourage et les contacts"},
    ]
    this.setState({numBarToShow: 0, shouldAnimateOnVisible: true})
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  startAppearanceAnimation = isVisible => {
    if (!isVisible) {
      return
    }
    this.setState({shouldAnimateOnVisible: false})
    this.showNextBar(0)
  }

  showNextBar(numBarToShow) {
    if (numBarToShow > this.graphData.length) {
      return
    }
    this.setState({numBarShown: numBarToShow})
    this.timeout = setTimeout(
      () => this.showNextBar(numBarToShow + 1),
      this.props.entranceAnimationDurationMillisec / this.graphData.length,
    )
  }

  renderBar({isHighlighted, percentage, title}, indexBar) {
    const {barEntranceDurationMillisec, isLegendShown} = this.props
    const isShown = indexBar < this.state.numBarShown
    const transition =
      `all ${barEntranceDurationMillisec}ms cubic-bezier(0.23, 1, 0.32, 1)`
    const style = {
      display: 'inline-block',
      textAlign: 'center',
      verticalAlign: 'top',
      width: 100,
    }
    const titleStyle = {
      color: Colors.SLATE,
      fontSize: 12,
      lineHeight: 1.19,
      marginBottom: 5,
      padding: 5,
    }
    const valueStyle = {
      color: isHighlighted ? Colors.SKY_BLUE : Colors.SILVER,
      fontSize: 12,
      fontWeight: 'bold',
      lineHeight: 1.19,
      opacity: isShown ? 1 : 0,
      padding: 5,
      transition,
    }
    const barAndTextStyle = {
      borderBottom: '1px solid',
      borderColor: Colors.SILVER,
      display: 'flex',
      flexDirection: 'column',
      height: 140,
      justifyContent: 'flex-end',
      position: 'relative',
    }
    const coloredBarStyle = {
      backgroundColor: isHighlighted ? Colors.SKY_BLUE : Colors.SILVER,
      height: isShown ? `${percentage * 2}%` : 0,
      margin: '0 auto',
      transition,
      width: 65,
    }
    return <div style={style} key={indexBar}>
      <div style={barAndTextStyle}>
        <div style={valueStyle}>
          {percentage} %
        </div>
        <div style={coloredBarStyle}></div>
      </div>
      {isLegendShown ? <div style={titleStyle}>
        {title}
      </div> : null}
    </div>
  }

  render() {
    const graphStyle = {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 0,
      ...this.props.style,
    }
    return <div style={graphStyle}>
      <VisibilitySensor
          active={this.state.shouldAnimateOnVisible} intervalDelay={250}
          onChange={this.startAppearanceAnimation} />
      <div>
        {this.graphData.map((barData, indexBar) => this.renderBar(barData, indexBar))}
      </div>
    </div>
  }
}


const MESSAGE_EXAMPLES = require('./data/network_messages.json')


const networkPersonalizations = [
  {
    filters: ['ATYPIC_PROFILE'],
    tip: profile => `En passant par le réseau vous serez moins vite
      catalogué${profile.gender === 'FEMININE' ? 'e' : ''} si vous ne rentrez
      pas dans les cases`,
  },
  {
    filters: ['TIME_MANAGEMENT'],
    tip: <span>Donnez-vous des objectifs du type : « cette semaine je vais à
      deux événements »</span>,
  },
  {
    filters: ['MOTIVATION'],
    tip: `Commencer par contacter les personnes que vous connaissez le mieux
      qui vous aideront à retrouver du poil de la bête`,
  },
  {
    filters: ['NO_OFFERS'],
    tip: 'Attaquez-vous au marché caché en utilisant votre réseau',
  },
  {
    filters: ['SAME_JOB'],
    tip: `Contactez vos anciens collègues, ils pourraient avoir eu vent de
      bonnes opportunités qui pourraient vous intéresser`,
  },
  {
    filters: ['GRADUATE'],
    tip: 'Le réseau des anciens élèves peut vous débloquer',
  },
]


class NetworkAdvicePage extends React.Component {
  static propTypes = {
    circle: React.PropTypes.number.isRequired,
    intro: React.PropTypes.node,
    profile: USER_PROFILE_SHAPE.isRequired,
    project: React.PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  state = {
    messageExampleIndex: 0,
  }

  componentWillMount() {
    const {circle} = this.props
    this.setState({messageExampleIndex: MESSAGE_EXAMPLES.findIndex(example => {
      return example.circles.includes(circle)
    })})
  }

  previousExampleHandler = () => {
    this.increaseMessageExampleIndex(-1)
  }

  nextExampleHandler = () => {
    this.increaseMessageExampleIndex(1)
  }

  increaseMessageExampleIndex(increase) {
    const {messageExampleIndex} = this.state
    const numMessages = MESSAGE_EXAMPLES.length
    this.setState({
      messageExampleIndex: (messageExampleIndex + increase + numMessages) % numMessages,
    })
  }

  renderBackground() {
    if (this.context.isMobileVersion) {
      return null
    }

    const containerStyle = {
      alignItems: 'center',
      bottom: 0,
      display: 'flex',
      left: 0,
      overflow: 'hidden',
      position: 'absolute',
      top: 0,
    }
    return <div style={containerStyle}>
      <img src={require('images/network-circles-background.svg')} />
    </div>
  }

  renderCircle(number, numberText, style, description) {
    return <div style={style}>
      <strong>
        Votre {numberText} cercle
        {number === this.props.circle ?
          <span style={{color: Colors.SKY_BLUE}}> (recommandé pour vous)</span> : null}
      </strong>
      <br />
      {description}
    </div>
  }

  renderCirclesBox(style) {
    return <AdviceBox
        feature="network-circles" style={style}
        header={<div>
          <div style={{color: Colors.DARK_TWO, fontSize: 30, lineHeight: '40px'}}>
            <strong style={{color: Colors.GREENISH_TEAL, fontSize: 40}}>3</strong> cercles
          </div>
          pour découvrir son réseau
        </div>}>
      {this.renderBackground()}
      <div style={{marginLeft: this.context.isMobileVersion ? 0 : 130}}>
        {this.renderCircle(
          1, '1ᵉʳ', {},
          'Parents, proches de la famille, amis, anciens de votre école, etc.')}
        {this.renderCircle(
          2, '2ᵉ', {marginTop: 30},
          'Les amis et relations de votre 1ᵉʳ cercle et ceux qui vous connaissent de loin.')}
        {this.renderCircle(
          3, '3ᵉ', {marginTop: 30},
          'Toutes les personnes que vous pouvez contacter par le biais du 2ᵉ cercle.')}
      </div>
    </AdviceBox>
  }

  renderExamplesBox(style, {circleText, medium, text}) {
    const footerStyle = {
      alignItems: 'center',
      backgroundColor: Colors.SLATE,
      borderRadius: '0 0 4px 4px',
      bottom: 0,
      color: '#fff',
      display: 'flex',
      fontWeight: 500,
      height: 40,
      left: 0,
      padding: '0 20px',
      position: 'absolute',
      right: 0,
    }
    return <AdviceBox
        style={style} feature="network-examples"
        header={<div>
          <div style={{color: Colors.DARK_TWO, fontSize: 30, lineHeight: '40px'}}>
            <strong style={{color: Colors.GREENISH_TEAL, fontSize: 40}}>
              {MESSAGE_EXAMPLES.length}
            </strong> exemples
          </div>
          de demande simple
        </div>}>
      <div style={{display: 'flex', flex: 1, flexDirection: 'column'}}>
        <strong>Exemple pour une demande par {medium}&nbsp;:</strong>
        <span style={{fontStyle: 'italic', fontWeight: 500}}>
          Utile pour s'adresser au <strong style={{color: Colors.SKY_BLUE}}>
            {circleText} cercle
          </strong>
        </span>
        <div style={{lineHeight: 1.69}}>
          <Markdown content={`« ${text} »`} />
        </div>
        <div style={{height: 40}} />

        <footer style={footerStyle}>
          <span style={{cursor: 'pointer'}} onClick={this.previousExampleHandler}>
            ◀<span style={{marginLeft: '.5em', ...Styles.CENTER_FONT_VERTICALLY}}>
              Précédent
            </span>
          </span>

          <span style={{flex: 1}} />

          <span style={{cursor: 'pointer'}} onClick={this.nextExampleHandler}>
            <span style={{marginRight: '.5em', ...Styles.CENTER_FONT_VERTICALLY}}>
              Suivant
            </span>▶
          </span>
        </footer>
      </div>
    </AdviceBox>
  }

  render() {
    const {profile, project} = this.props
    const {isMobileVersion} = this.context
    const {messageExampleIndex} = this.state
    return <div>
      <PaddedOnMobile>{this.props.intro}</PaddedOnMobile>
      <div style={{display: 'flex', flexDirection: isMobileVersion ? 'column' : 'row'}}>
        {this.renderCirclesBox({flex: 1})}
        <div style={{height: 30, width: 30}} />
        {this.renderExamplesBox({flex: 1}, MESSAGE_EXAMPLES[messageExampleIndex])}
      </div>

      <PersonalizationBoxes
          style={{marginTop: 30}} profile={profile} project={project}
          personalizations={networkPersonalizations} />
    </div>
  }
}


export {NetworkAdviceCard, NetworkAdvicePage}
