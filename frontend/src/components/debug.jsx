import React from 'react'
import {connect} from 'react-redux'

import {displayToasterMessage, saveUser} from 'store/actions'

import {Modal} from './modal'
import {Button} from './theme'


class DebugModalBase extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    email: React.PropTypes.string,
    onClose: React.PropTypes.func.isRequired,
    user: React.PropTypes.object.isRequired,
    userId: React.PropTypes.string,
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

  saveAndClose = () => {
    const {dispatch, email, onClose, userId} = this.props
    const {initialUserJson} = this.state
    const userJson = this.refs.userJson.value
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

    dispatch(saveUser({...user, profile: {...user.profile, email}, userId})).then(onClose)
  }

  render() {
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
          defaultValue={this.state.initialUserJson} ref="userJson" />
      <Button type="validation" onClick={this.saveAndClose} style={buttonStyle}>
        Enregistrer
      </Button>
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
