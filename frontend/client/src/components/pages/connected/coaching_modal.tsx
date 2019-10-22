import React from 'react'
import {connect} from 'react-redux'

import {DispatchAllActions, emailCheck, silentlyRegisterUser} from 'store/actions'
import {YouChooser} from 'store/french'
import {validateEmail} from 'store/validations'

import {LoginLink} from 'components/login'
import {isMobileVersion} from 'components/mobile'
import {Modal} from 'components/modal'
import {Button, Input} from 'components/theme'


interface CoachingConfirmModalProps {
  coachingEmailFrequency?: bayes.bob.EmailFrequency
  dispatch: DispatchAllActions
  onCloseModal: () => void
  userYou: YouChooser
}


interface CoachingConfirmModalState {
  email?: string
  isEmailAlreadyUsed?: boolean
}


class CoachingConfirmationModalBase
  extends React.PureComponent<CoachingConfirmModalProps, CoachingConfirmModalState> {

  public state: CoachingConfirmModalState = {
    email: '',
  }

  private handleEmailChange = (email): void => {
    this.setState({email})
  }

  private submitEmailViaForm = (event): void => {
    event.preventDefault()
    this.submitEmail()
  }

  private submitEmail = (): void => {
    const {email} = this.state
    if (!validateEmail(email)) {
      return
    }
    const {dispatch} = this.props
    dispatch(emailCheck(email)).then((response): void => {
      if (!response) {
        return
      }
      if (!response.isNewUser) {
        this.setState({isEmailAlreadyUsed: true})
        return
      }
      dispatch(silentlyRegisterUser(email))
    })
  }

  public render(): React.ReactNode {
    const {coachingEmailFrequency, onCloseModal, userYou} = this.props
    const {email, isEmailAlreadyUsed} = this.state
    const registrationContentStyle: React.CSSProperties = {
      padding: '30px 50px 50px',
    }
    const formStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      marginTop: 12,
      ...isMobileVersion ? {} : {maxWidth: 500},
    }
    const errorStyle = {
      border: `1px solid ${colors.RED_PINK}`,
    }
    const isEmailValid = validateEmail(email)
    return <Modal
      style={{margin: 20, maxWidth: 500}}
      isShown={!!coachingEmailFrequency && coachingEmailFrequency !== 'EMAIL_NONE'}
      onClose={onCloseModal} title="Une adresse email est nécessaire">
      <div style={registrationContentStyle}>
        Pour {userYou('te', 'vous')} coacher, j'ai besoin de {userYou('ton', 'votre')} adresse
        email.
        <form onSubmit={this.submitEmailViaForm} style={formStyle}>
          <Input
            value={this.state.email} onChange={this.handleEmailChange}
            placeholder={`${userYou('ton', 'votre')}@email.com`}
            style={isEmailAlreadyUsed ? errorStyle : undefined} />
          <Button
            disabled={!isEmailValid} onClick={this.submitEmail} isRound={true}
            style={{marginLeft: 15}} isNarrow={true}>
            Valider
          </Button>
        </form>
        <div style={{fontSize: 13, marginTop: 10}}>
          {isEmailAlreadyUsed ? <React.Fragment>
            Cet email est déjà lié à un compte, <LoginLink
              email={email} isSignUp={false} visualElement="coaching">
              connecte{userYou('-toi', 'z-vous')}
            </LoginLink> pour continuer.
          </React.Fragment> : <React.Fragment>
            {userYou('Tu peux', 'Vous pouvez')} aussi créer un compte en{' '}
            <LoginLink visualElement="coaching" isSignUp={true} email={email}>
              cliquant ici
            </LoginLink>.
          </React.Fragment>}
        </div>
      </div>
    </Modal>
  }
}
const CoachingConfirmationModal = connect()(CoachingConfirmationModalBase)


export {CoachingConfirmationModal}
