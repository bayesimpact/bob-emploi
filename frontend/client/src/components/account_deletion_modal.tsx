import type {TOptions} from 'i18next'
import React, {useCallback, useMemo} from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'
import {useHistory} from 'react-router-dom'

import type {RootState} from 'store/actions'
import {deleteUser, displayToasterMessage, useDispatch} from 'store/actions'

import Button from 'components/button'
import Emoji from 'components/emoji'
import ExternalLink from 'components/external_link'
import Trans from 'components/i18n_trans'
import {Routes} from 'components/url'
import type {ModalConfig} from 'components/modal'
import {Modal} from 'components/modal'


interface AccountDeletionModalProps extends Omit<ModalConfig, 'children' | 'title'> {
  onClose: () => void
}

const buttonsBarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '35px 0 50px',
}
const contentStyle: React.CSSProperties = {
  padding: '30px 50px 0',
  width: 700,
}

const AccountDeletionModal = (props: AccountDeletionModalProps): React.ReactElement => {
  const dispatch = useDispatch()
  const user = useSelector(({user}: RootState) => user)
  const history = useHistory()
  const {t} = useTranslation('components')
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

  const tOptions = useMemo((): TOptions => ({context: gender}), [gender])
  const deleteText = hasAccount ? t('Supprimer définitivement mon compte') :
    t('Supprimer définitivement mes données')
  const title = <Trans parent={null} t={t}>
    Vous voulez nous quitter&nbsp;? <Emoji size={18} aria-hidden={true}>😢</Emoji>
  </Trans>

  return <Modal {...props} title={title}>
    {hasAccount ? <Trans style={contentStyle} parent="p" t={t}>
      Si vous décidez de supprimer votre compte, toutes vos données personnelles seront
      définitivement effacées, notamment votre profil, vos projets, et vos actions effectuées.
      Il sera ensuite impossible de les récupérer.
      <br /><br />
      Nous sommes tristes de vous voir partir, n'hésitez pas à nous dire ce que nous pouvons
      améliorer <ExternalLink
        style={{color: colors.BOB_BLUE}} href="https://airtable.com/shr3pFteo6ERIHnpH">
        en cliquant ici
      </ExternalLink>&nbsp;!
    </Trans> : <Trans style={contentStyle} tOptions={tOptions} parent="p" t={t}>
      Êtes-vous sûr·e de vouloir supprimer <strong>définitivement</strong> vos données&nbsp;?
    </Trans>}
    <div style={buttonsBarStyle}>
      <Button onClick={onClose} style={{marginRight: 13}} type="discreet" isRound={true}>
        {t('Annuler la suppression')}
      </Button>
      <Button onClick={handleDeletionClick} type="deletion" isRound={true} aria-label={deleteText}>
        {deleteText}
      </Button>
    </div>
  </Modal>
}


export default React.memo(AccountDeletionModal)
