import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import {RouteComponentProps, withRouter} from 'react-router'
import ReactRouterPropTypes from 'react-router-prop-types'

import {DispatchAllActions, RootState, deleteUser, displayToasterMessage} from 'store/actions'
import {YouChooser, genderize} from 'store/french'
import {youForUser} from 'store/user'

import {Button, ExternalLink} from 'components/theme'
import {Routes} from 'components/url'
import {Modal} from 'components/modal'


interface AccountDeletionModalConnectedProps {
  user: bayes.bob.User
  userYou: YouChooser
}


interface AccountDeletionModalProps
  extends AccountDeletionModalConnectedProps, RouteComponentProps<{}> {
  dispatch: DispatchAllActions
  isShown?: boolean
  onClose: () => void
}


class AccountDeletionModalBase extends React.PureComponent<AccountDeletionModalProps> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    history: ReactRouterPropTypes.history.isRequired,
    isShown: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    user: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  private handleDeletionClick = (): void => {
    const {dispatch, history, user, userYou} = this.props
    dispatch(deleteUser(user)).
      then((response): void => {
        if (response) {
          dispatch(displayToasterMessage(
            user.hasAccount ? `${userYou('Ton', 'Votre')} compte a été définitivement supprimé.` :
              `${userYou('Tes', 'Vos')} données ont été définitivement supprimées.`))
          history.push(Routes.ROOT)
        }
      })
  }

  public render(): React.ReactNode {
    const {isShown, onClose, user: {hasAccount, profile: {gender = undefined} = {}},
      userYou} = this.props
    const contentStyle = {
      padding: '30px 50px 0',
      width: hasAccount ? 700 : 400,
    }
    const buttonsBarStyle = {
      display: 'flex',
      justifyContent: 'center',
      padding: '35px 0 50px',
    }
    const your = userYou('ton', 'votre')
    const yours = userYou('tes', 'vos')
    return <Modal isShown={isShown} onClose={onClose} title="Vous voulez nous quitter&nbsp;? 😢">
      <div style={contentStyle}>
        {hasAccount ? <React.Fragment>
          Si {userYou('tu décides', 'vous décidez')} de supprimer {your} compte,
          toutes {yours} données personnelles seront définitivement effacées,
          notamment {your} profil, {yours} projets, et {yours} actions effectuées.
          Il sera ensuite impossible de les récupérer.
          <br /><br />
          Nous sommes tristes de {userYou('te', 'vous')} voir partir, n'hésite{userYou('', 'z')} pas
          à nous dire ce que nous pouvons améliorer <ExternalLink
            style={{color: colors.BOB_BLUE}} href="https://airtable.com/shr3pFteo6ERIHnpH">
            en cliquant ici
          </ExternalLink>&nbsp;!
        </React.Fragment> : <React.Fragment>
          {userYou('Es-tu', 'Êtes-vous')} sûr{genderize('·e', 'e', '', gender)} de vouloir
          supprimer <strong>définitivement</strong> {yours} données&nbsp;?
        </React.Fragment>}
      </div>
      <div style={buttonsBarStyle}>
        <Button onClick={onClose} style={{marginRight: 13}} type="back" isRound={true}>
          Annuler
        </Button>
        <Button onClick={this.handleDeletionClick} type="deletion" isRound={true}>
          Supprimer{hasAccount ? ' définitivement mon compte' : null}
        </Button>
      </div>
    </Modal>
  }
}
const AccountDeletionModal = connect(({user}: RootState): AccountDeletionModalConnectedProps => ({
  user,
  userYou: youForUser(user),
}))(withRouter(AccountDeletionModalBase))


export {AccountDeletionModal}
