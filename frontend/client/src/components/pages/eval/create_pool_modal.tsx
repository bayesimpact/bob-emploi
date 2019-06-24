import _memoize from 'lodash/memoize'
import PropTypes from 'prop-types'
import React from 'react'

import {DispatchAllEvalActions, createUseCase} from 'store/actions'
import {validateEmail, validateObjectId} from 'store/validations'

import {Modal} from 'components/modal'
import {Button, LabeledToggle, Input, SmoothTransitions} from 'components/theme'
import {FieldSet} from 'components/pages/connected/form_utils'


interface ModalProps {
  isShown?: boolean
  onClose?: () => void
}


interface CreatePoolModalProps extends ModalProps {
  dispatch: DispatchAllEvalActions
  onTransientCreated: (useCase: bayes.bob.UseCase) => void
}


interface CreatePoolModalState {
  emailOrId?: string
  emailSaved?: string
  poolName?: string
  shouldSaveCreated?: boolean
  useCaseIdCreated?: string
}


class CreatePoolModal extends React.Component<CreatePoolModalProps, CreatePoolModalState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    onTransientCreated: PropTypes.func,
  }

  public state = {
    emailOrId: '',
    emailSaved: '',
    poolName: '',
    shouldSaveCreated: false,
    useCaseIdCreated: null,
  }

  public componentWillUnmount(): void {
    this.isUnmounting = true
  }

  private isUnmounting: boolean = false

  private emailInput: React.RefObject<Input> = React.createRef()

  private hasInvalidInput = (): boolean => {
    const {emailOrId, poolName, shouldSaveCreated} = this.state
    return !validateEmail(emailOrId) && !validateObjectId(emailOrId) ||
      shouldSaveCreated && !poolName
  }

  private handleCreate = (): void => {
    const {dispatch, onTransientCreated} = this.props
    const {emailOrId, poolName, shouldSaveCreated} = this.state
    if (this.hasInvalidInput()) {
      return
    }
    const field = validateObjectId(emailOrId) ? 'userId' : 'email'
    const request = {
      [field]: emailOrId,
      ...shouldSaveCreated && {poolName},
    }
    dispatch(createUseCase(request)).then((useCase): string => {
      if (!useCase || this.isUnmounting) {
        return
      }
      // TODO(cyrille): Handle the case when this callback might be very long.
      onTransientCreated && !shouldSaveCreated && onTransientCreated(useCase)
      this.setState({
        emailOrId: '',
        ...shouldSaveCreated && {
          emailSaved: emailOrId,
          useCaseIdCreated: useCase.useCaseId,
        },
      })
    })
    this.emailInput.current && this.emailInput.current.focus()
  }

  private handleFieldChange = _memoize((field: string): ((value: string) => void) =>
    (value: string): void => this.setState({emailSaved: '', [field]: value}))

  private handleToggleSaveCreated = (): void =>
    this.setState(({shouldSaveCreated}): CreatePoolModalState =>
      ({shouldSaveCreated: !shouldSaveCreated}))

  public render(): React.ReactNode {
    const {emailOrId, emailSaved, poolName, shouldSaveCreated, useCaseIdCreated} = this.state
    return <Modal
      {...this.props} title={shouldSaveCreated ? 'Créer un pool' : "Consulter un cas d'utilisation"}
      style={{padding: '0 50px 40px', width: 550}}>
      <FieldSet style={{marginTop: 25}}>
        <LabeledToggle
          type="checkbox" label="Conserver dans un pool"
          isSelected={shouldSaveCreated} onClick={this.handleToggleSaveCreated} />
      </FieldSet>
      {shouldSaveCreated ? <FieldSet label="Nom du pool" style={{marginTop: 30}}>
        <Input
          placeholder="Saisir le nom du pool"
          value={poolName} onChange={this.handleFieldChange('poolName')} />
      </FieldSet> : null}
      <FieldSet label="Adresse email ou ID d'un utilisateur" style={{marginBottom: 0}}>
        <Input
          placeholder="Saisir une adresse ou un ID" ref={this.emailInput}
          value={emailOrId} onChange={this.handleFieldChange('emailOrId')} />
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
        <Button type="validation" disabled={this.hasInvalidInput()} onClick={this.handleCreate}>
          {shouldSaveCreated ? 'Ajouter' : 'Consulter'}
        </Button>
      </div>
    </Modal>
  }
}


export {CreatePoolModal}
