import EmailOutlineIcon from 'mdi-react/EmailOutlineIcon'
import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {useDispatch, useSelector} from 'react-redux'
import {ThunkAction} from 'redux-thunk'

import useFastForward from 'hooks/fast_forward'
import {aliUserDataPost} from 'store/api'
import {validateEmail} from 'store/validations'

import FieldSet from 'components/field_set'
import IconInput from 'components/icon_input'
import LabeledToggle from 'components/labeled_toggle'
import {Modal, ModalConfig, useModal} from 'components/modal'

import 'styles/fonts/Fredoka/font.css'
import 'styles/fonts/OpenSans/font.css'

import Button from './button'
import {DispatchActions, DisplayToasterMessageAction, MiniRootState, SaveAction,
  makeUrlUser} from '../store'

const trimAndLowerCase = (email: string): string => email.trim().toLowerCase()



const displayToasterMessage = (error: string): DisplayToasterMessageAction => ({
  error,
  type: 'MINI_DISPLAY_TOASTER_MESSAGE',
})


// Refacto with wrapAsyncAction if we ever use several async actions.
// TODO(sil): Avoid logging the save action twice.
const saveAction = (userEmail: string, counselorEmail: string|undefined, location: string):
ThunkAction<Promise<void>, MiniRootState, unknown, SaveAction> =>
  async (dispatch: DispatchActions, getState: () => MiniRootState):
  Promise<void> => {
    const action = {
      ASYNC_MARKER: 'ASYNC_MARKER',
      type: 'MINI_ONBOARDING_SAVE',
    } as const
    dispatch(action)
    dispatch({
      orgInfo: {
        email: counselorEmail,
      },
      type: 'MINI_UPDATE_ORG_INFO',
    })
    const {user, app: {orgInfo: {advisor: counselorName}}} = getState()
    const resultsUrl = `${location}?${makeUrlUser(user)}`
    try {
      const {hasCounselorEmail, hasUserEmail} = await aliUserDataPost({
        counselorEmail,
        counselorName,
        resultsUrl,
        userEmail,
      })
      dispatch({...action, response: undefined, status: 'success'})
      dispatch(displayToasterMessage(
        hasUserEmail ? 'Bilan sauvegardé par e-mail' : 'Impossible de sauvegarder le bilan'))
      if (counselorEmail && !hasCounselorEmail) {
        dispatch(displayToasterMessage("Le bilan n'a pas pu être envoyé au conseiller"))
      }
    } catch (error) {
      dispatch({...action, error, status: 'error'})
      // TODO(pascal): Add server error message in here as well.
      dispatch(displayToasterMessage('Impossible de sauvegarder le bilan'))
    }
  }


const modalContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  maxWidth: 500,
  padding: 50,
}


interface EmailModalProps extends Omit<ModalConfig, 'children'> {
  onClose: () => void
}


const EmailModalBase: React.FC<EmailModalProps> = ({onClose, isShown, ...modalProps}):
React.ReactElement => {
  const [email, setEmail] = useState('')
  const [advisorEmail, setAdvisorEmail] = useState('')
  const [shouldSendToAdvisor, setShouldSendToAdvisor] = useState(false)
  const storedAdvisorEmail = useSelector(({app: {orgInfo: {email}}}: MiniRootState): string =>
    email || '')
  useEffect((): void => setAdvisorEmail(storedAdvisorEmail), [storedAdvisorEmail])
  const [isValidated, setValidated] = useState(false)
  useEffect((): void => setValidated(false), [isShown])
  const changeSendToAdvisor = useCallback(
    (): void => setShouldSendToAdvisor(!shouldSendToAdvisor),
    [shouldSendToAdvisor],
  )
  const forceSendToAdvisor = useCallback(
    (): void => setShouldSendToAdvisor(true),
    [],
  )
  const maybeAdvisorEmail = shouldSendToAdvisor ? advisorEmail : undefined
  const isFormInvalid = !validateEmail(email) ||
    !!maybeAdvisorEmail && !validateEmail(maybeAdvisorEmail) ||
    shouldSendToAdvisor && !validateEmail(maybeAdvisorEmail)
  const {href} = window.location
  const dispatch = useDispatch<DispatchActions>()
  const dispatchEmail = useCallback((event?: React.SyntheticEvent): void => {
    event?.preventDefault()
    setValidated(true)
    if (isFormInvalid) {
      return
    }
    dispatch(saveAction(email, maybeAdvisorEmail, href.split(/[#?]/)[0]))
    // TODO(cyrille): Give feedback on whether the email was actually sent.
    onClose()
  }, [dispatch, email, isFormInvalid, maybeAdvisorEmail, onClose, href])
  const fillForm = useCallback((): void => {
    if (!shouldSendToAdvisor) {
      forceSendToAdvisor()
    }
    if (!advisorEmail) {
      setAdvisorEmail('pascal@example.com')
    }
    if (!email) {
      setEmail('youngpascal@example.com')
    }
  }, [advisorEmail, forceSendToAdvisor, email, shouldSendToAdvisor])
  useFastForward(advisorEmail && email ? dispatchEmail : fillForm)
  return <Modal title="Conserver mon bilan" onClose={onClose} isShown={isShown} {...modalProps}>
    <form style={modalContentStyle}>
      <FieldSet
        label="Je m'envoie un e-mail qui me permettra de retrouver
        ma progression là où j'en suis actuellement."
        isValid={validateEmail(email)} isValidated={isValidated}>
        <IconInput
          type="email" placeholder="Mon adresse email"
          value={email} iconComponent={EmailOutlineIcon}
          applyFunc={trimAndLowerCase}
          iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
          onChange={setEmail} />
      </FieldSet>
      <FieldSet
        isValid={!shouldSendToAdvisor || validateEmail(advisorEmail)}
        isValidated={isValidated && shouldSendToAdvisor}>
        <LabeledToggle
          type="checkbox" isSelected={shouldSendToAdvisor} onClick={changeSendToAdvisor}
          label="J'envoie une copie à mon conseiller (optionnel)." />
        <IconInput
          type="email" placeholder="L'adresse email de mon conseiller" value={advisorEmail}
          iconComponent={EmailOutlineIcon}
          applyFunc={trimAndLowerCase}
          iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
          onChange={setAdvisorEmail} onFocus={forceSendToAdvisor} />
      </FieldSet>
      <Button
        style={{alignSelf: 'center', marginTop: 20}} type="validation" onClick={dispatchEmail}>
        Envoyer
      </Button>
    </form>
  </Modal>
}
EmailModalBase.propTypes = {
  isShown: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
}
const EmailModal = React.memo(EmailModalBase)


const SaveButton: React.FC<React.ComponentProps<typeof Button>> = ({style, ...props}):
React.ReactElement => {
  const [isShown, showModal, closeModal] = useModal()
  const buttonStyle = useMemo((): React.CSSProperties => ({
    padding: '15px 30px',
    ...style,
  }), [style])
  return <React.Fragment>
    <EmailModal isShown={isShown} onClose={closeModal} />
    <Button style={buttonStyle} {...props} onClick={showModal}>Sauvegarder</Button>
  </React.Fragment>
}
SaveButton.propTypes = {
  style: PropTypes.object,
}


export default React.memo(SaveButton)
