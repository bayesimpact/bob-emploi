import _memoize from 'lodash/memoize'
import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'

import {DispatchAllActions, RootState, displayToasterMessage, saveUser} from 'store/actions'

import {Modal} from './modal'
import {Button, Textarea} from './theme'


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
  projects: user.projects.map(dropComputedFields),
})


interface DebugModalConnectedProps {
  email?: string
  keepProps?: {
    facebookId?: string
    googleId?: string
    peConnectId?: string
    userId?: string
  }
  user: bayes.bob.User
}


// TODO(pascal): Use Modal's props once modal module is typed.
interface ModalOwnProps {
  isShown?: boolean
  onClose: () => void
}


interface DebugModalProps extends DebugModalConnectedProps, ModalOwnProps {
  dispatch: DispatchAllActions
}


interface DebugModalState {
  initialUserJson: string
  userJson: string
}


class DebugModalBase extends React.PureComponent<DebugModalProps, DebugModalState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    email: PropTypes.string,
    keepProps: PropTypes.shape({
      facebookId: PropTypes.string,
      googleId: PropTypes.string,
      peConnectId: PropTypes.string,
      userId: PropTypes.string,
    }),
    onClose: PropTypes.func.isRequired,
    user: PropTypes.object.isRequired,
  }

  public state = {
    initialUserJson: '',
    userJson: '',
  }

  public static getDerivedStateFromProps({user}, {initialUserJson}): Partial<DebugModalState> {
    // TODO(cyrille): Avoid doing this if the modal is not shown.
    // TODO(cyrille): Reset userJson when user prop changes.
    const userJson = JSON.stringify(user, undefined, 2)
    if (initialUserJson === userJson) {
      return null
    }
    return {initialUserJson: userJson}
  }

  public componentDidMount(): void {
    this.setState({userJson: this.state.initialUserJson})
  }

  private handleUserUpdate = (userJson: string): void => this.setState({userJson})

  private handleSaveAndClose = _memoize((filterUserFunc?): (() => void) => (): void => {
    const {dispatch, email, keepProps, onClose} = this.props
    const {initialUserJson, userJson} = this.state
    if (userJson === initialUserJson) {
      onClose()
    }
    let user
    try {
      user = JSON.parse(userJson.replace(/ObjectId\(("[a-f0-9]+")\)/, '$1'))
    } catch (error) {
      dispatch(displayToasterMessage(error.toString()))
      return
    }

    // Delete fields starting with "_".
    const fieldsToDelete = []
    for (const key in user) {
      if (key && key[0] === '_') {
        fieldsToDelete.push(key)
      }
    }
    fieldsToDelete.forEach((field): void => {
      delete user[field]
    })

    if (filterUserFunc) {
      user = filterUserFunc(user)
    }

    dispatch(saveUser({
      ...user,
      profile: {...user.profile, email},
      revision: (this.props.user.revision || 0) + 1,
      ...keepProps,
    })).then(onClose)
  })

  public render(): React.ReactNode {
    const {projects} = this.props.user
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
    return <Modal {...this.props} style={style}>
      <Textarea
        style={{flex: 1, fontFamily: 'Monospace', fontSize: 12}}
        value={this.state.userJson} onChange={this.handleUserUpdate} />
      <div style={buttonStyle}>
        {hasAdvices ? <Button
          onClick={this.handleSaveAndClose(dropUserProjectsComputedFields)} isRound={true}>
          Conseiller à nouveau
        </Button> : null}
        <Button
          type="validation" onClick={this.handleSaveAndClose()} style={{marginLeft: 20}}
          isRound={true}>
          Enregistrer
        </Button>
      </div>
    </Modal>
  }
}
export const DebugModal = connect(({user}: RootState): DebugModalConnectedProps => {
  const {facebookId, googleId, peConnectId, userId, ...userProps} = user
  return {
    email: user.profile.email,
    keepProps: {facebookId, googleId, peConnectId, userId},
    user: userProps,
  }
})(DebugModalBase)