import {TOptions} from 'i18next'
import PropTypes from 'prop-types'
import React, {useCallback, useMemo} from 'react'
import {WithTranslation, withTranslation} from 'react-i18next'
import {connect} from 'react-redux'
import {RouteComponentProps, withRouter} from 'react-router'
import ReactRouterPropTypes from 'react-router-prop-types'

import {DispatchAllActions, RootState, deleteUser, displayToasterMessage} from 'store/actions'

import {Trans} from 'components/i18n'
import {Button, ExternalLink} from 'components/theme'
import {Routes} from 'components/url'
import {Modal} from 'components/modal'


interface AccountDeletionModalConnectedProps {
  user: bayes.bob.User
}


interface AccountDeletionModalProps
  extends AccountDeletionModalConnectedProps, RouteComponentProps<{}>, WithTranslation {
  dispatch: DispatchAllActions
  isShown?: boolean
  onClose: () => void
}


const buttonsBarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '35px 0 50px',
}


const AccountDeletionModalBase = (props: AccountDeletionModalProps): React.ReactElement => {
  const {dispatch, history, t, user} = props
  const {isShown, onClose, user: {hasAccount, profile: {gender = undefined} = {}}} = props

  const handleDeletionClick = useCallback((): void => {
    dispatch(deleteUser(user)).
      then((response): void => {
        if (response) {
          dispatch(displayToasterMessage(
            user.hasAccount ? t('Votre compte a été définitivement supprimé') :
              t('Vos données ont été définitivement supprimées')))
          history.push(Routes.ROOT)
        }
      })
  }, [dispatch, history, t, user])

  const contentStyle = useMemo((): React.CSSProperties => ({
    padding: '30px 50px 0',
    width: hasAccount ? 700 : 400,
  }), [hasAccount])
  const tOptions = useMemo((): TOptions => ({context: gender}), [gender])
  return <Modal
    isShown={isShown} onClose={onClose} title={t('Vous voulez nous quitter\u00A0? 😢')}>
    {hasAccount ? <Trans style={contentStyle}>
      Si vous décidez de supprimer votre compte, toutes vos données personnelles seront
      définitivement effacées, notamment votre profil, vos projets, et vos actions effectuées.
      Il sera ensuite impossible de les récupérer.
      <br /><br />
      Nous sommes tristes de vous voir partir, n'hésitez pas à nous dire ce que nous pouvons
      améliorer <ExternalLink
        style={{color: colors.BOB_BLUE}} href="https://airtable.com/shr3pFteo6ERIHnpH">
        en cliquant ici
      </ExternalLink>&nbsp;!
    </Trans> : <Trans style={contentStyle} tOptions={tOptions}>
      Êtes-vous sûr·e de vouloir supprimer <strong>définitivement</strong> vos données&nbsp;?
    </Trans>}
    <Trans style={buttonsBarStyle}>
      <Button onClick={onClose} style={{marginRight: 13}} type="back" isRound={true}>
        Annuler
      </Button>
      <Button onClick={handleDeletionClick} type="deletion" isRound={true}>
        Supprimer{{myAccount: hasAccount ? t(' définitivement mon compte') : null}}
      </Button>
    </Trans>
  </Modal>
}
AccountDeletionModalBase.propTypes = {
  dispatch: PropTypes.func.isRequired,
  history: ReactRouterPropTypes.history.isRequired,
  isShown: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
  user: PropTypes.object.isRequired,
}
const AccountDeletionModal = connect(({user}: RootState): AccountDeletionModalConnectedProps => ({
  user,
}))(withRouter(withTranslation()(React.memo(AccountDeletionModalBase))))


export {AccountDeletionModal}
