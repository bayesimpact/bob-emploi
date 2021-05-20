import PropTypes from 'prop-types'
import React, {useCallback, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'

import {useSafeDispatch} from 'store/promise'
import {validateEmail, validateObjectId} from 'store/validations'

import Button from 'components/button'
import FieldSet from 'components/field_set'
import Trans from 'components/i18n_trans'
import Input, {Inputable} from 'components/input'
import LabeledToggle from 'components/labeled_toggle'
import {Modal} from 'components/modal'
import {SmoothTransitions} from 'components/theme'

import {DispatchAllEvalActions, createUseCase} from '../store/actions'


interface ModalProps {
  isShown?: boolean
  onClose?: () => void
}


interface CreatePoolModalProps extends ModalProps {
  onTransientCreated: (
    useCase: bayes.bob.UseCase, field: 'userId'|'email', emailOrId: string,
  ) => void
}


const CreatePoolModal = (props: CreatePoolModalProps): React.ReactElement => {
  const {onTransientCreated, ...otherProps} = props
  const dispatch = useSafeDispatch<DispatchAllEvalActions>()
  const {t} = useTranslation()
  const [emailOrId, setEmailOrId] = useState('')
  const [poolName, setPoolName] = useState('')
  const [shouldSaveCreated, setShouldSaveCreated] = useState(false)
  const [useCaseIdCreated, setUseCaseIdCreated] = useState<string|undefined>()
  const [emailSaved, setEmailSaved] = useState('')
  const emailInput = useRef<Inputable>(null)

  const hasInvalidInput = !validateEmail(emailOrId) && !validateObjectId(emailOrId) ||
    shouldSaveCreated && !poolName

  const handleCreate = useCallback(async (): Promise<void> => {
    if (hasInvalidInput) {
      return
    }
    const field = validateObjectId(emailOrId) ? 'userId' : 'email'
    const request = {
      [field]: emailOrId,
      ...shouldSaveCreated && {poolName},
    }
    const useCase = await dispatch(createUseCase(request))
    if (!useCase) {
      return
    }
    setEmailOrId('')
    if (onTransientCreated && !shouldSaveCreated) {
      onTransientCreated(useCase, field, emailOrId)
      return
    }
    if (shouldSaveCreated) {
      setEmailSaved(emailOrId)
      setUseCaseIdCreated(useCase.useCaseId)
    }
    emailInput.current?.focus()
  }, [dispatch, emailOrId, hasInvalidInput, onTransientCreated, poolName, shouldSaveCreated])

  const handlePoolNameChange = useCallback((poolName: string): void => {
    setEmailSaved('')
    setPoolName(poolName)
  }, [])

  const handleEmailOrIdChange = useCallback((emailOrId: string): void => {
    setEmailSaved('')
    setEmailOrId(emailOrId)
  }, [])

  const handleToggleSaveCreated = useCallback((): void => {
    setShouldSaveCreated((shouldSaveCreated: boolean): boolean => !shouldSaveCreated)
  }, [])

  return <Modal
    {...otherProps}
    title={shouldSaveCreated ? t('Créer un pool') : t("Consulter un cas d'utilisation")}
    style={{padding: '0 50px 40px', width: 550}}>
    <FieldSet style={{marginTop: 25}}>
      <LabeledToggle
        type="checkbox" label={t('Conserver dans un pool')}
        isSelected={shouldSaveCreated} onClick={handleToggleSaveCreated} />
    </FieldSet>
    {shouldSaveCreated ? <FieldSet label={t('Nom du pool')} style={{marginTop: 30}}>
      <Input
        placeholder={t('Saisir le nom du pool')}
        value={poolName} onChange={handlePoolNameChange} />
    </FieldSet> : null}
    <FieldSet label={t("Adresse email ou ID d'un utilisateur")} style={{marginBottom: 0}}>
      <Input
        placeholder={t('Saisir une adresse ou un ID')} ref={emailInput}
        value={emailOrId} onChange={handleEmailOrIdChange} />
      <Trans style={{opacity: emailSaved ? 1 : 0, ...SmoothTransitions}}>
        Utilisateur <strong>{{emailSaved}}</strong> ajouté
        en tant que <strong>{{useCaseIdCreated}}</strong>
      </Trans>
    </FieldSet>
    <div style={{marginBottom: 25}}>
      {t(
        'Une trace de votre requête sera conservée pour des raisons de protection de la vie ' +
        'privée de nos utilisateurs. ' +
        'Tout accès à des données personnelles doit être motivé par une raison précise ' +
        "(debug, support, demande explicite de l'utilisateur, …).")}
    </div>
    <div style={{textAlign: 'center'}}>
      <Button type="validation" disabled={hasInvalidInput} onClick={handleCreate}>
        {shouldSaveCreated ? t('Ajouter') : t('Consulter')}
      </Button>
    </div>
  </Modal>
}
CreatePoolModal.propTypes = {
  onTransientCreated: PropTypes.func,
}


export default React.memo(CreatePoolModal)
