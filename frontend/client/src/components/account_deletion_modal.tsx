import {TOptions} from 'i18next'
import PropTypes from 'prop-types'
import React, {useCallback, useMemo} from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'
import {useHistory} from 'react-router-dom'

import {RootState, deleteUser, displayToasterMessage, useDispatch} from 'store/actions'

import Button from 'components/button'
import ExternalLink from 'components/external_link'
import Trans from 'components/i18n_trans'
import {Routes} from 'components/url'
import {Modal, ModalConfig} from 'components/modal'


interface AccountDeletionModalProps extends Omit<ModalConfig, 'children' | 'title'> {
  onClose: () => void
}

const buttonsBarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '35px 0 50px',
}


const AccountDeletionModal = (props: AccountDeletionModalProps): React.ReactElement => {
  const dispatch = useDispatch()
  const user = useSelector(({user}: RootState) => user)
  const history = useHistory()
  const {t} = useTranslation()
  const {onClose} = props
  const {hasAccount, profile: {gender = undefined} = {}} = user

  const handleDeletionClick = useCallback(async () => {
    if (!await dispatch(deleteUser(user))) {
      return
    }
    dispatch(displayToasterMessage(
      hasAccount ? t('Votre compte a été définitivement supprimé') :
        t('Vos données ont été définitivement supprimées')))
    history.push(Routes.ROOT)
  }, [dispatch, hasAccount, history, t, user])

  const contentStyle = useMemo((): React.CSSProperties => ({
    padding: '30px 50px 0',
    width: hasAccount ? 700 : 400,
  }), [hasAccount])
  const tOptions = useMemo((): TOptions => ({context: gender}), [gender])
  return <Modal {...props} title={t('Vous voulez nous quitter\u00A0? 😢')}>
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
AccountDeletionModal.propTypes = {
  onClose: PropTypes.func.isRequired,
}


export default React.memo(AccountDeletionModal)
