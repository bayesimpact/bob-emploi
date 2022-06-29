import React, {useCallback, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'

import {useSafeDispatch} from 'store/promise'
import {getUserExample} from 'store/user'
import {validateEmail, validateObjectId} from 'store/validations'

import Button from 'components/button'
import {OneField} from 'components/field_set'
import Trans from 'components/i18n_trans'
import type {Inputable} from 'components/input'
import Input from 'components/input'
import LabeledToggle from 'components/labeled_toggle'
import {Modal} from 'components/modal'
import {SmoothTransitions} from 'components/theme'
import Toggle from 'components/toggle'

import type {DispatchAllEvalActions} from '../store/actions'
import {createUseCase, deleteUser} from '../store/actions'


interface ModalProps {
  isShown?: boolean
  onClose?: () => void
}


interface CreatePoolModalProps extends ModalProps {
  onTransientCreated: (
    useCase: bayes.bob.UseCase, field: 'userId'|'email'|'example', emailOrId: string,
  ) => void
}

const deleteStyle: React.CSSProperties = {
  marginLeft: 20,
}

const CreatePoolModal = (props: CreatePoolModalProps): React.ReactElement => {
  const {onTransientCreated, onClose, ...otherProps} = props
  const dispatch = useSafeDispatch<DispatchAllEvalActions>()
  const {t} = useTranslation()
  const [emailOrId, setEmailOrId] = useState('')
  const [poolName, setPoolName] = useState('')
  const [shouldSaveCreated, setShouldSaveCreated] = useState(false)
  const [useCaseIdCreated, setUseCaseIdCreated] = useState<string|undefined>()
  const [emailSaved, setEmailSaved] = useState('')
  const [isExampleSelected, setIsExampleSelected] = useState(false)
  const emailInput = useRef<Inputable>(null)

  const hasInvalidInput =
    !isExampleSelected && !validateEmail(emailOrId) && !validateObjectId(emailOrId) ||
    shouldSaveCreated && !poolName
  const field = isExampleSelected ? 'example' : validateObjectId(emailOrId) ? 'userId' : 'email'

  const handleCreate = useCallback(async (): Promise<void> => {
    if (hasInvalidInput) {
      return
    }
    const getUseCase = (): Promise<bayes.bob.UseCase|void> => {
      if (field === 'example') {
        return Promise.resolve({userData: getUserExample(true, t)})
      }
      const request = {
        [field]: emailOrId,
        ...shouldSaveCreated && {poolName},
      }
      return dispatch(createUseCase(request))
    }
    const useCase = await getUseCase()
    if (!useCase) {
      return
    }
    setEmailOrId('')
    if (onTransientCreated && !shouldSaveCreated) {
      onTransientCreated(useCase, field, emailOrId)
      return
    }
    if (shouldSaveCreated && field !== 'example') {
      setEmailSaved(emailOrId)
      setUseCaseIdCreated(useCase.useCaseId)
    }
    emailInput.current?.focus()
  }, [
    dispatch, emailOrId, field, hasInvalidInput, onTransientCreated, poolName, t,
    shouldSaveCreated,
  ])

  const handleDelete = useCallback(async () => {
    if (field !== 'email' || hasInvalidInput) {
      return
    }
    await dispatch(deleteUser(emailOrId))
    onClose?.()
  }, [dispatch, emailOrId, field, hasInvalidInput, onClose])

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

  const handleToggleExampleSelected = useCallback((): void => {
    setEmailSaved('')
    setEmailOrId('')
    setShouldSaveCreated(false)
    setIsExampleSelected((wasSelected: boolean): boolean => !wasSelected)
  }, [])

  return <Modal
    {...otherProps} onClose={onClose}
    title={shouldSaveCreated ? t('Créer un pool') : t("Consulter un cas d'utilisation")}
    style={{padding: '0 50px 40px', width: 550}}>
    <LabeledToggle
      type="checkbox" label={t('Conserver dans un pool')}
      isSelected={shouldSaveCreated} onClick={handleToggleSaveCreated} />
    {shouldSaveCreated ? <OneField label={t('Nom du pool')} style={{marginTop: 30}}>
      <Input
        placeholder={t('Saisir le nom du pool')} name="pool-name"
        value={poolName} onChange={handlePoolNameChange} />
    </OneField> : null}
    <OneField
      label={t("Adresse email ou ID d'un utilisateur")} style={{marginBottom: 0}}
      note={<Trans style={{opacity: emailSaved ? 1 : 0, ...SmoothTransitions}}>
        Utilisateur <strong>{{emailSaved}}</strong> ajouté
        en tant que <strong>{{useCaseIdCreated}}</strong>
      </Trans>}>
      <Input
        placeholder={t('Saisir une adresse ou un ID')} ref={emailInput} name="email-or-id"
        value={emailOrId} onChange={handleEmailOrIdChange} disabled={isExampleSelected} />
    </OneField>
    <div style={{marginBottom: 25}}>
      {t(
        'Une trace de votre requête sera conservée pour des raisons de protection de la vie ' +
        'privée de nos utilisateurs. ' +
        'Tout accès à des données personnelles doit être motivé par une raison précise ' +
        "(debug, support, demande explicite de l'utilisateur, …).")}
    </div>
    <Trans parent="label" style={{alignItems: 'center', display: 'flex', marginBottom: 25}}>
      Ou utiliser un exemple aléatoire <Toggle
        style={{marginLeft: 20}} isSelected={isExampleSelected}
        onClick={handleToggleExampleSelected} />
    </Trans>
    <div style={{textAlign: 'center'}}>
      <Button type="validation" disabled={hasInvalidInput} onClick={handleCreate}>
        {shouldSaveCreated ? t('Ajouter') : t('Consulter')}
      </Button>
      {field === 'email' && !hasInvalidInput ?
        <Button style={deleteStyle} type="deletion" onClick={handleDelete}>
          {t('Supprimer')}
        </Button> : null}
    </div>
  </Modal>
}


export default React.memo(CreatePoolModal)
