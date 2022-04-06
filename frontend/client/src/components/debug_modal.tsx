import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'

import useKeyListener from 'hooks/key_listener'
import type {RootState} from 'store/actions'
import {displayToasterMessage, listUserEmails, saveUser, sendUserEmail,
  useDispatch} from 'store/actions'
import {useProject} from 'store/project'
import {useAsynceffect} from 'store/promise'
import {useAuthTokens} from 'store/user'

import Button from 'components/button'
import type {SelectOption} from 'components/select'
import Select from 'components/select'
import Textarea from 'components/textarea'
import {Modal, useModal} from './modal'


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


type Props = Omit<React.ComponentProps<typeof Modal>, 'isShown'|'onClose'|'children'>

const DebugModal = ({style: parentStyle, ...props}: Props): React.ReactElement => {
  const [isShown, show, onClose] = useModal()
  useKeyListener('KeyE', show, {ctrl: true, shift: true})
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
  const authTokens = useAuthTokens(userId)
  const {i18n, t} = useTranslation('components')
  const defaultCampaigns = useMemo((): readonly bayes.bob.EmailSent[] => [
    {
      campaignId: 'first-followup-survey',
      subject: t('Envoyer le FFS'),
    },
    {
      campaignId: 'nps',
      subject: t('Envoyer le NPS'),
    },
    {
      campaignId: 'employment-status',
      subject: t('Envoyer le RER'),
    },
  ], [t])
  const [availableCampaigns, setAvailableCampaigns] = useState(defaultCampaigns)

  const [userJson, setUserJson, hasUserJsonBeenEdited] = useFrozenState(
    (): string => JSON.stringify(user, undefined, 2),
    !isShown,
  )

  const parseUser = useCallback((): bayes.bob.User|undefined => {
    const updatedUser = ((): bayes.bob.User|undefined => {
      try {
        return JSON.parse(userJson.replace(/ObjectId\(("[\da-f]+")\)/, '$1'))
      } catch (error) {
        dispatch(displayToasterMessage((error as Error).toString()))
      }
    })()
    if (!updatedUser) {
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

  useAsynceffect(async (checkIfCanceled) => {
    if (!isShown) {
      setAvailableCampaigns(defaultCampaigns)
      return
    }
    const response = await dispatch(listUserEmails())
    if (!checkIfCanceled() && response) {
      setAvailableCampaigns(response.campaigns || defaultCampaigns)
    }
  }, [defaultCampaigns, dispatch, isShown])

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

  const {locale = i18n.language} = user.profile || {}
  const hasAdvices = useProject()?.advices
  const buttonStyle: React.CSSProperties = {
    alignSelf: 'flex-end',
    margin: 20,
  }
  const style = useMemo((): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    height: '80%',
    width: '80%',
    ...parentStyle,
  }), [parentStyle])
  const formOptions = useMemo((): readonly SelectOption<string>[] => {
    const options: SelectOption<string>[] = [{
      name: t('Formulaires de retours'),
      value: '',
    }]
    if (authTokens?.ffsUrl) {
      const answer = Math.random() > .5 ? 'yes' : ''
      options.push({
        name: t('Ouvrir le FFS'),
        value: `${authTokens.ffsUrl}&answer=${answer}&hl=${locale}`,
      })
    }
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
  const emailOptions = useMemo((): readonly SelectOption<string>[] => ([
    {
      name: t("Envoi d'un email"),
      value: '',
    },
    ...availableCampaigns.map(({campaignId, subject}) => ({
      name: `${subject} (${campaignId})`,
      value: campaignId || '',
    })),
  ]), [t, availableCampaigns])
  return <Modal isShown={isShown} onClose={onClose} {...props} style={style}>
    <Textarea
      style={{flex: 1, fontFamily: 'Monospace', fontSize: 12}}
      value={userJson} onChange={setUserJson} />
    <div style={buttonStyle}>
      {emailOptions.length && email ? <Select
        options={emailOptions} menuPlacement="top"
        style={selectFormStyle} onChange={handleCampaignPick} value="" /> : null}
      {formOptions.length ? <Select
        options={formOptions} menuPlacement="top"
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


export default React.memo(DebugModal)
