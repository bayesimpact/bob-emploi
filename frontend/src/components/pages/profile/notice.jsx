import React from 'react'
import PropTypes from 'prop-types'

import bobCircleImage from 'images/bob-circle-picto.svg'
import {Step} from 'components/pages/profile/step'
import {Colors} from 'components/theme'


class CountDown extends React.Component {
  static propTypes = {
    seconds: PropTypes.number.isRequired,
  }

  componentWillMount() {
    this.update(this.props.seconds)
  }

  componentWillUnmount() {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
  }

  update = seconds => {
    this.setState({seconds})
    if (seconds > 0) {
      this.timeout = setTimeout(() => this.update(seconds - 1), 1000)
    }
  }

  render() {
    return <span>{this.state.seconds}</span>
  }
}


// TODO(pascal): Don't show the notice after back-navigation from the succeeding step.
class NoticeStep extends React.Component {
  static propTypes = {
    onSubmit: PropTypes.func.isRequired,
  }

  handleSubmit = () => {
    this.props.onSubmit({})
  }

  componentWillMount() {
    this.setState({isNextButtonDisabled: true})
    this.timeout = setTimeout(() => this.setState({isNextButtonDisabled: false}), 3000)
  }

  componentWillUnmount() {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
  }

  render() {
    const {isNextButtonDisabled} = this.state
    const textStyle = {
      color: Colors.CHARCOLAL_GREY_TWO,
      fontSize: 15,
      fontWeight: 'normal',
      lineHeight: '20px',
      marginTop: 33,
      maxWidth: 450,
      textAlign: 'center',
    }
    return <Step
        title="Commençons par nous connaître un peu mieux"
        fastForward={this.handleSubmit}
        onNextButtonClick={this.handleSubmit}
        {...this.props}
        isNextButtonDisabled={isNextButtonDisabled}
        nextButtonContent={isNextButtonDisabled ? <CountDown seconds={3} /> : null}>
      <div style={{margin: 20, textAlign: 'center'}}>
        <img src={bobCircleImage} />
      </div>

      <div style={textStyle}>
        <p>
          Nous sommes une association indépendante à but non-lucratif. Notre
          but est d'utiliser le big data pour donner à chacun le pouvoir de
          s'appuyer sur l'expérience combinée de tous les demandeurs d'emploi
          afin de booster sa recherche.
        </p>
        <p style={{marginTop: '2em'}}>
          Nous allons vous poser quelques questions pour mieux vous connaître
          et vous aider de façon personnalisée, cela prendra quelques minutes
          mais c'est important.
        </p>
      </div>
    </Step>
  }
}

export {NoticeStep}
