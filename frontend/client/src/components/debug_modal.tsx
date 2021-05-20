import React, {useCallback, useEffect, useMemo, useState} from 'react'
import PropTypes from 'prop-types'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'

import {RootState, displayToasterMessage, getAuthTokens, saveUser, sendUserEmail,
  useDispatch} from 'store/actions'
import {useAsynceffect} from 'store/promise'

import Button from 'components/button'
import Select, {SelectOption} from 'components/select'
import Textarea from 'components/textarea'
import {Modal, ModalConfig} from './modal'


const dropComputedFields = (project: bayes.bob.Project): bayes.bob.Project => {
  const {
    advices = undefined,
    diagnostic = undefined,
    strategies = undefined,
    openedStrategies = undefined,
    ...cleanProject
  } = project
  if (advices || diagnostic || strategies || openedStrategies) {
    return cleanProject
  }
  return project
}

const dropUserProjectsComputedFields = (user: bayes.bob.User): bayes.bob.User => ({
  ...user,
  projects: (user.projects || []).map(dropComputedFields),
})

const dropUnusedFields = (user: bayes.bob.User): void => {
  const fieldsToDelete: (keyof bayes.bob.User)[] = []
  for (const key in user) {
    if (key && key[0] === '_') {
      fieldsToDelete.push(key as keyof bayes.bob.User)
    }
  }
  for (const field of fieldsToDelete) {
    delete user[field]
  }
}


// Hook to get a state that can be updated by two different ways: from a setter function (the
// quick change), from a compute function used only once at the time the isFrozen flag changes from
// false to true.
//
// It returns the value of the state, the setter update it quickly and a flag showing
// if it was updated since the last time it was computed.
function useFrozenState<T>(compute: () => T, isFrozen: boolean):
[T, (value: T | (() => T)) => void, boolean] {
  const [state, setState] = useState(compute)
  const [initialState, setInitialState] = useState(state)
  const [wasFrozen, setWasFrozen] = useState(isFrozen)
  const hasJustUnfroze = !isFrozen && wasFrozen
  const finalState = hasJustUnfroze ? compute() : state
  useEffect((): void => {
    setWasFrozen(isFrozen)
    if (hasJustUnfroze) {
      setState(finalState)
      setInitialState(finalState)
    }
  }, [finalState, hasJustUnfroze, isFrozen])
  const hasBeenModifiedSinceLastUnfroze = !hasJustUnfroze && state !== initialState
  return [finalState, setState, hasBeenModifiedSinceLastUnfroze]
}


const openInNewWindow = (href: string): void => {
  if (!href) {
    return
  }
  window.open(href, '_blank', 'noopener noreferrer')
}


const selectFormStyle: React.CSSProperties = {
  display: 'inline-block',
  marginRight: 20,
  width: 205,
}


interface DebugModalProps extends Omit<ModalConfig, 'children'> {
  onClose: () => void
}

const DebugModal = (props: DebugModalProps): React.ReactElement => {
  const {isShown, onClose} = props
  const {email, keepProps, keepProps: {userId}, user} = useSelector(({user}: RootState) => {
    const {facebookId, googleId, linkedInId, peConnectId, userId, ...userProps} = user
    return {
      email: user.profile && user.profile.email,
      keepProps: {facebookId, googleId, linkedInId, peConnectId, userId},
      user: userProps,
    }
  })
  const wasEmployed = user?.projects?.[0]?.kind === 'FIND_ANOTHER_JOB' ? 'True' : 'False'
  const dispatch = useDispatch()
  const [authTokens, setAuthTokens] = useState<bayes.bob.AuthTokens|undefined>()
  useAsynceffect(async (checkIfCanceled): Promise<void> => {
    if (userId) {
      const authTokens = await dispatch(getAuthTokens())
      if (!checkIfCanceled()) {
        setAuthTokens(authTokens || undefined)
      }
    }
  }, [dispatch, userId])

  const [userJson, setUserJson, hasUserJsonBeenEdited] = useFrozenState(
    (): string => JSON.stringify(user, undefined, 2),
    !isShown,
  )

  const parseUser = useCallback((): bayes.bob.User|undefined => {
    let updatedUser: bayes.bob.User
    try {
      updatedUser = JSON.parse(userJson.replace(/ObjectId\(("[\da-f]+")\)/, '$1'))
    } catch (error) {
      dispatch(displayToasterMessage(error.toString()))
      return
    }
    // Delete fields starting with "_".
    dropUnusedFields(updatedUser)
    return updatedUser
  }, [dispatch, userJson])

  const saveUpdatedUser = useCallback(async (updatedUser: bayes.bob.User): Promise<void> => {
    await dispatch(saveUser({
      ...updatedUser,
      profile: {...updatedUser.profile, email},
      revision: (updatedUser.revision || 0) + 1,
      ...keepProps,
    }))
    onClose()
  }, [dispatch, keepProps, email, onClose])

  const handleSaveAndClose = useCallback((): void => {
    if (!hasUserJsonBeenEdited) {
      onClose()
    }
    const updatedUser = parseUser()
    updatedUser && saveUpdatedUser(updatedUser)
  }, [hasUserJsonBeenEdited, onClose, parseUser, saveUpdatedUser])

  const diagnoseAgain = useCallback((): void => {
    const updatedUser = parseUser()
    updatedUser && saveUpdatedUser(dropUserProjectsComputedFields(updatedUser))
  }, [parseUser, saveUpdatedUser])

  const {i18n, t} = useTranslation()
  const {profile: {locale = i18n.language} = {}, projects} = user
  const hasAdvices = projects && projects[0] && projects[0].advices
  const buttonStyle: React.CSSProperties = {
    alignSelf: 'flex-end',
    margin: 20,
  }
  const style: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '80%',
    width: '80%',
  }
  const formOptions = useMemo((): readonly SelectOption<string>[] => {
    const options: SelectOption<string>[] = [{
      name: t('Formulaires de retours'),
      value: '',
    }]
    const score = Math.floor(Math.random() * 10)
    if (authTokens?.npsUrl) {
      options.push({
        name: t('Ouvrir le NPS ({{score}})', {score}),
        value: `${authTokens.npsUrl}&score=${score}&hl=${locale}`,
      })
    }
    if (authTokens?.employmentStatusUrl) {
      options.push({
        name: t('Ouvrir le RER'),
        value: `${authTokens.employmentStatusUrl}&hl=${locale}&employed=${wasEmployed}`,
      })
    }
    if (options.length === 1) {
      return []
    }
    return options
  }, [authTokens, locale, t, wasEmployed])
  const handleCampaignPick = useCallback(async (campaignId: string) => {
    if (!campaignId) {
      return
    }
    const response = await dispatch(sendUserEmail(campaignId))
    if (response) {
      dispatch(displayToasterMessage(t('Email envoyé')))
    }
  }, [dispatch, t])
  // TODO(pascal): Create an endpoint to get the list of available campaigns.
  const emailOptions = useMemo((): readonly SelectOption<string>[] => ([
    {
      name: t("Envoi d'un email"),
      value: '',
    },
    {
      name: t('Envoyer le NPS'),
      value: 'nps',
    },
    {
      name: t('Envoyer le RER'),
      value: 'employment-status',
    },
  ]), [t])
  return <Modal {...props} style={style}>
    <Textarea
      style={{flex: 1, fontFamily: 'Monospace', fontSize: 12}}
      value={userJson} onChange={setUserJson} />
    <div style={buttonStyle}>
      {emailOptions.length ? <Select
        options={emailOptions}
        style={selectFormStyle} onChange={handleCampaignPick} value="" /> : null}
      {formOptions.length ? <Select
        options={formOptions}
        style={selectFormStyle} onChange={openInNewWindow} value="" /> : null}
      {hasAdvices ? <Button
        onClick={diagnoseAgain} isRound={true}
        style={{marginRight: 20}}>
        {t('Conseiller à nouveau')}
      </Button> : null}
      <Button type="validation" onClick={handleSaveAndClose} isRound={true}>
        {t('Enregistrer')}
      </Button>
    </div>
  </Modal>
}
DebugModal.propTypes = {
  isShown: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
}


export default React.memo(DebugModal)
