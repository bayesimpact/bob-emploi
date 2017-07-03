import React from 'react'
import PropTypes from 'prop-types'

import networkCirclesBackground from 'images/network-circles-background.svg'
import {Colors, GrowingNumber, Markdown, PaddedOnMobile, Styles} from 'components/theme'

import {AdviceBox} from './base'
import MESSAGE_EXAMPLES from './data/network_messages.json'



class NetworkAdviceCard extends React.Component {
  render() {
    const explanationStyle = {
      fontSize: 30,
    }
    return <section style={explanationStyle}>
      <strong>
        <GrowingNumber number={44} isSteady={true} />%
      </strong> des
      gens retrouvent un emploi grâce à <strong>leurs contacts</strong> contre
      seulement 12% via des offres sur internet.
    </section>
  }
}


class NetworkAdvicePage extends React.Component {
  static propTypes = {
    circle: PropTypes.number.isRequired,
    intro: PropTypes.node,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
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
      <img src={networkCirclesBackground} />
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
    const {isMobileVersion} = this.context
    const {messageExampleIndex} = this.state
    return <div>
      <PaddedOnMobile>{this.props.intro}</PaddedOnMobile>
      <div style={{display: 'flex', flexDirection: isMobileVersion ? 'column' : 'row'}}>
        {this.renderCirclesBox({flex: 1})}
        <div style={{height: 30, width: 30}} />
        {this.renderExamplesBox({flex: 1}, MESSAGE_EXAMPLES[messageExampleIndex])}
      </div>
    </div>
  }
}


export {NetworkAdviceCard, NetworkAdvicePage}
