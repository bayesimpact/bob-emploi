import React, {useCallback, useEffect, useState} from 'react'
import PropTypes from 'prop-types'
import {useSelector} from 'react-redux'

import {RootState, displayToasterMessage, getAuthTokens, saveUser, useDispatch} from 'store/actions'

import {Modal, ModalConfig} from './modal'
import {Button, ExternalLink, Textarea} from './theme'


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
  fieldsToDelete.forEach((field): void => {
    delete user[field]
  })
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


interface DebugModalProps extends Omit<ModalConfig, 'children'> {
  onClose: () => void
}

const DebugModalBase = (props: DebugModalProps): React.ReactElement => {
  const {isShown, onClose} = props
  const {email, keepProps, keepProps: {userId}, user} = useSelector(({user}: RootState) => {
    const {facebookId, googleId, linkedInId, peConnectId, userId, ...userProps} = user
    return {
      email: user.profile && user.profile.email,
      keepProps: {facebookId, googleId, linkedInId, peConnectId, userId},
      user: userProps,
    }
  })
  const dispatch = useDispatch()
  const [authTokens, setAuthTokens] = useState<bayes.bob.AuthTokens|undefined>()
  useEffect((): void => {
    if (userId) {
      dispatch(getAuthTokens()).then((authTokens): void => setAuthTokens(authTokens || undefined))
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

  const saveUpdatedUser = useCallback((updatedUser: bayes.bob.User): void => {
    dispatch(saveUser({
      ...updatedUser,
      profile: {...updatedUser.profile, email},
      revision: (updatedUser.revision || 0) + 1,
      ...keepProps,
    })).then(onClose)
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

  const {profile: {locale = 'fr'} = {}, projects} = user
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
  const score = Math.floor(Math.random() * 10)
  return <Modal {...props} style={style}>
    <Textarea
      style={{flex: 1, fontFamily: 'Monospace', fontSize: 12}}
      value={userJson} onChange={setUserJson} />
    <div style={buttonStyle}>
      {authTokens?.npsUrl ? <ExternalLink
        href={authTokens.npsUrl + `&score=${score}&hl=${locale}`} style={{marginRight: 20}}>
        <Button isRound={true}>
          Ouvrir le NPS ({score})
        </Button>
      </ExternalLink> : null}
      {authTokens?.employmentStatusUrl ? <ExternalLink
        href={authTokens.employmentStatusUrl + `&hl=${locale}`} style={{marginRight: 20}}>
        <Button isRound={true}>
          Ouvrir le RER
        </Button>
      </ExternalLink> : null}
      {hasAdvices ? <Button
        onClick={diagnoseAgain} isRound={true}
        style={{marginRight: 20}}>
        Conseiller à nouveau
      </Button> : null}
      <Button type="validation" onClick={handleSaveAndClose} isRound={true}>
        Enregistrer
      </Button>
    </div>
  </Modal>
}
DebugModalBase.propTypes = {
  isShown: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
}
export const DebugModal = React.memo(DebugModalBase)
