import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'

import {displayToasterMessage, saveUser} from 'store/actions'

import {Modal} from './modal'
import {Button} from './theme'


class DebugModalBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    email: PropTypes.string,
    onClose: PropTypes.func.isRequired,
    user: PropTypes.object.isRequired,
    userId: PropTypes.string,
  }

  componentWillMount() {
    this.updateUser(this.props.user)
  }

  componentWillReceiveProps(nextProps) {
    this.updateUser(nextProps.user)
  }

  updateUser(user) {
    this.setState({
      initialUserJson: JSON.stringify(user, undefined, 2),
    })
  }

  saveAndClose(filterUserFunc) {
    const {dispatch, email, onClose, userId} = this.props
    const {initialUserJson} = this.state
    const userJson = this.userJsonDom && this.userJsonDom.value || ''
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
    fieldsToDelete.forEach(field => delete user[field])

    if (filterUserFunc) {
      filterUserFunc(user)
    }

    dispatch(saveUser({
      ...user,
      profile: {...user.profile, email},
      revision: (this.props.user.revision || 0) + 1,
      userId,
    })).then(onClose)
  }

  resetAdvices = () => {
    this.saveAndClose(user => {
      if (user.projects && user.projects.length && user.projects[0].advices) {
        delete user.projects[0].advices
      }
    })
  }

  render() {
    const {projects} = this.props.user
    const hasAdvices = projects && projects[0] && projects[0].advices
    const buttonStyle = {
      alignSelf: 'flex-end',
      margin: 20,
    }
    const style = {
      display: 'flex',
      flexDirection: 'column',
      height: '80%',
      width: '80%',
    }
    return <Modal {...this.props} style={style}>
      <textarea
        style={{flex: 1, fontFamily: 'Monospace', fontSize: 12}}
        defaultValue={this.state.initialUserJson} ref={dom => {
          this.userJsonDom = dom
        }} />
      <div style={buttonStyle}>
        {hasAdvices ? <Button onClick={this.resetAdvices}>
          Conseiller à nouveau
        </Button> : null}
        <Button type="validation" onClick={() => this.saveAndClose()} style={{marginLeft: 20}}>
          Enregistrer
        </Button>
      </div>
    </Modal>
  }
}
export const DebugModal = connect(({user}) => {
  const {userId, ...userProps} = user
  return {
    email: user.profile.email,
    user: userProps,
    userId,
  }
})(DebugModalBase)
