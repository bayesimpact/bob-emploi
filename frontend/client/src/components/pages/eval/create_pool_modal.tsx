import PropTypes from 'prop-types'
import React, {useCallback, useRef, useState} from 'react'

import {DispatchAllEvalActions, createUseCase} from 'store/actions'
import {useSafeDispatch} from 'store/promise'
import {validateEmail, validateObjectId} from 'store/validations'

import {Modal} from 'components/modal'
import {Button, LabeledToggle, Input, Inputable, SmoothTransitions} from 'components/theme'
import {FieldSet} from 'components/pages/connected/form_utils'


interface ModalProps {
  isShown?: boolean
  onClose?: () => void
}


interface CreatePoolModalProps extends ModalProps {
  onTransientCreated: (useCase: bayes.bob.UseCase) => void
}


const CreatePoolModalBase = (props: CreatePoolModalProps): React.ReactElement => {
  const {onTransientCreated, ...otherProps} = props
  const dispatch = useSafeDispatch<DispatchAllEvalActions>()
  const [emailOrId, setEmailOrId] = useState('')
  const [poolName, setPoolName] = useState('')
  const [shouldSaveCreated, setShouldSaveCreated] = useState(false)
  const [useCaseIdCreated, setUseCaseIdCreated] = useState<string|undefined>()
  const [emailSaved, setEmailSaved] = useState('')
  const emailInput = useRef<Inputable>(null)

  const hasInvalidInput = !validateEmail(emailOrId) && !validateObjectId(emailOrId) ||
    shouldSaveCreated && !poolName

  const handleCreate = useCallback((): void => {
    if (hasInvalidInput) {
      return
    }
    const field = validateObjectId(emailOrId) ? 'userId' : 'email'
    const request = {
      [field]: emailOrId,
      ...shouldSaveCreated && {poolName},
    }
    dispatch(createUseCase(request)).then((useCase): void => {
      if (!useCase) {
        return
      }
      // TODO(cyrille): Handle the case when this callback might be very long.
      onTransientCreated && !shouldSaveCreated && onTransientCreated(useCase)
      setEmailOrId('')
      if (shouldSaveCreated) {
        setEmailSaved(emailOrId)
        setUseCaseIdCreated(useCase.useCaseId)
      }
    })
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
    {...otherProps} title={shouldSaveCreated ? 'Créer un pool' : "Consulter un cas d'utilisation"}
    style={{padding: '0 50px 40px', width: 550}}>
    <FieldSet style={{marginTop: 25}}>
      <LabeledToggle
        type="checkbox" label="Conserver dans un pool"
        isSelected={shouldSaveCreated} onClick={handleToggleSaveCreated} />
    </FieldSet>
    {shouldSaveCreated ? <FieldSet label="Nom du pool" style={{marginTop: 30}}>
      <Input
        placeholder="Saisir le nom du pool"
        value={poolName} onChange={handlePoolNameChange} />
    </FieldSet> : null}
    <FieldSet label="Adresse email ou ID d'un utilisateur" style={{marginBottom: 0}}>
      <Input
        placeholder="Saisir une adresse ou un ID" ref={emailInput}
        value={emailOrId} onChange={handleEmailOrIdChange} />
      <div style={{opacity: emailSaved ? 1 : 0, ...SmoothTransitions}}>
        Utilisateur <strong>{emailSaved}</strong> ajouté
        en tant que <strong>{useCaseIdCreated}</strong>
      </div>
    </FieldSet>
    <div style={{marginBottom: 25}}>
      Une trace de votre requête sera conservée pour des raisons de protection de la vie privée de
      nos utilisateurs.
      Tout accès à des données personnelles doit être motivé par une raison précise
      (debug, support, demande explicite de l'utilitateur, &hellip;).
    </div>
    <div style={{textAlign: 'center'}}>
      <Button type="validation" disabled={hasInvalidInput} onClick={handleCreate}>
        {shouldSaveCreated ? 'Ajouter' : 'Consulter'}
      </Button>
    </div>
  </Modal>
}
CreatePoolModalBase.propTypes = {
  onTransientCreated: PropTypes.func,
}
const CreatePoolModal = React.memo(CreatePoolModalBase)


export {CreatePoolModal}
