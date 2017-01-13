import React from 'react'

import {ProfileStep} from 'components/pages/profile/step'
import {Colors} from 'components/theme'


class CountDown extends React.Component {
  static propTypes = {
    seconds: React.PropTypes.number.isRequired,
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
    onSubmit: React.PropTypes.func.isRequired,
  }

  handleSubmit = () => {
    this.props.onSubmit({})
  }

  constructor(props) {
    super(props)
    this.state = {
      isNextButtonDisabled: true,
    }
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
      marginTop: 70,
      maxWidth: 450,
      textAlign: 'center',
    }
    return <ProfileStep
        title="Vos réponses restent entre nous"
        fastForward={this.handleSubmit}
        onNextButtonClick={this.handleSubmit}
        {...this.props}
        isNextButtonDisabled={isNextButtonDisabled}
        nextButtonContent={isNextButtonDisabled ? <CountDown seconds={3} /> : null}>
      <div style={{textAlign: 'center'}}>
        <img src={require('images/lock-logo.png')} />
      </div>

      <div style={textStyle}>
        <p>
          Nous allons vous poser quelques questions sur vous, vos aspirations
          et vos frustrations.
        </p>
        <p>
          <strong>Toutes vos réponses resteront
          entièrement privées</strong> : elles ne seront pas partagées derrière
          votre dos, que ce soit avec les entreprises ou avec Pôle Emploi.
        </p>
        <p>
          Nous sommes une association indépendante à but non-lucratif et notre
          unique mission est d'essayer de vous être utile. Ces questions nous
          serviront à mieux vous connaître afin de <strong>vous</strong> aider
          de façon personnalisée.
        </p>
      </div>
    </ProfileStep>
  }
}

export {NoticeStep}
