import {FastForward} from 'components/fast_forward'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'
import {Link, Redirect} from 'react-router-dom'

import likeImage from 'images/mini/like.svg'

import {GenericPage} from './page'

export const MINI_ONBOARDING_RESTART = 'MINI_ONBOARDING_RESTART'


// TODO(pascal): Combine with the button in question.jsx.
const buttonStyle = {
  backgroundColor: colors.MINI_PEA,
  borderRadius: 15,
  boxShadow: '0px 10px 15px 0 rgba(0, 0, 0, 0.2)',
  color: colors.MINI_WHITE,
  cursor: 'pointer',
  fontFamily: 'Fredoka One',
  fontSize: 21,
  padding: '15px 70px',
  textDecoration: 'none',
}


class ThankYouPageBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    user: PropTypes.string.isRequired,
  }

  state = {}

  fastForward = () => {
    this.setState({isFastForwarded: true})
  }

  handleRestart = event => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer toutes les réponses\u00A0?')) {
      this.props.dispatch({type: MINI_ONBOARDING_RESTART})
    } else {
      event.preventDefault()
    }
  }

  renderBottom = () => {
    return <React.Fragment>
      <div style={{marginBottom: 30, width: 350}}>
        Tu peux maintenant imprimer ton bilan et tes réponses détaillées.
      </div>
      <a
        style={buttonStyle} target="_blank" rel="noopener noreferrer"
        href={`/mini/bilan/imprimer#${this.props.user}`}>
        Imprimer mon bilan
      </a>
    </React.Fragment>
  }

  renderRestartButton() {
    const style = {
      ...buttonStyle,
      backgroundColor: colors.MINI_FOOTER_GREY,
      color: colors.MINI_PEA,
      position: 'absolute',
      right: 30,
      top: 20,
    }
    return <Link to="/mini" style={style} onClick={this.handleRestart}>
      Recommencer
    </Link>
  }

  render() {
    if (this.state.isFastForwarded) {
      return <Redirect to="/mini/bilan" push={true} />
    }
    const pageStyle = {
      color: colors.MINI_WARM_GREY,
      fontSize: 19,
      textAlign: 'center',
    }
    const imageBackgroundStyle = {
      alignItems: 'center',
      backgroundColor: colors.MINI_FOOTER_GREY,
      borderRadius: 84,
      display: 'flex',
      height: 168,
      justifyContent: 'center',
      margin: '0 auto 15px',
      width: 168,
    }
    return <GenericPage bottomButton={this.renderBottom()} style={pageStyle} footerSize={216}>
      <FastForward onForward={this.fastForward} />
      {this.renderRestartButton()}
      <div style={{flex: 1}} />
      <div style={imageBackgroundStyle}>
        <img src={likeImage} style={{width: 140}} alt="" />
      </div>
      <div style={{color: colors.MINI_PEA, fontFamily: 'Fredoka One', fontSize: 40}}>
        Merci&nbsp;!
      </div>
      <div style={{marginBottom: 30, marginTop: 25, width: 420}}>
        Voici le bilan à partir duquel tu peux échanger avec un professionnel de la Mission Locale.
      </div>
      <Link style={buttonStyle} to="/mini/bilan">
        Afficher mon bilan
      </Link>
      <div style={{flex: 1}} />
    </GenericPage>
  }
}
const ThankYouPage = connect(({user}) => ({user: JSON.stringify(user)}))(ThankYouPageBase)


export {ThankYouPage}
