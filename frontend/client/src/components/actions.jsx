import CheckCircleIcon from 'mdi-react/CheckCircleIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import {connect} from 'react-redux'

import {readTip, openTipExternalLink} from 'store/actions'

import {isMobileVersion} from 'components/mobile'

import {Modal, ModalHeader} from './modal'
import {ExternalLink, Markdown} from './theme'


const ACTION_SHAPE = PropTypes.shape({
  actionId: PropTypes.string.isRequired,
  doneCaption: PropTypes.string,
  durationSeconds: PropTypes.number,
  extraContent: PropTypes.string,
  howTo: PropTypes.string,
  justification: PropTypes.string,
  shortDescription: PropTypes.string,
  // TODO(pascal): Enforce one of ActionStatus from proto without bloating the client size.
  status: PropTypes.string.isRequired,
  title: PropTypes.string,
})


class ActionDescriptionModalBase extends React.Component {
  static propTypes = {
    action: ACTION_SHAPE,
    dispatch: PropTypes.func.isRequired,
    isShown: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  componentDidMount() {
    const {action, isShown} = this.props
    if (isShown && action && action.status === 'ACTION_UNREAD') {
      this.props.dispatch(readTip(action))
    }
  }

  componentDidUpdate(prevProps) {
    const {action, dispatch, isShown} = this.props
    if (isShown && !prevProps.isShown && action && action.status === 'ACTION_UNREAD') {
      dispatch(readTip(action))
    }
  }

  handleLinkClick = () => {
    const {action, dispatch} = this.props
    dispatch(openTipExternalLink(action))
  }

  renderAsTip(action) {
    if (!action) {
      return null
    }
    const {userYou} = this.props
    const {link, shortDescription} = action
    const titleStyle = {
      fontSize: 14,
      fontWeight: 'bold',
      marginTop: 30,
    }
    const contentStyle = {
      padding: isMobileVersion ? 15 : 35,
    }
    const linkStyle = {
      color: colors.BOB_BLUE,
      fontWeight: 'bold',
    }
    return <div>
      <ActionModalHeader action={action} />
      <div style={contentStyle}>
        <Markdown content={shortDescription} />
        <div style={titleStyle}>
          {userYou('Tu ne sais ', 'Vous ne savez ')}pas par où commencer&nbsp;?
        </div>
        <div style={{marginBottom: 15, marginTop: 5}}>
          <ExternalLink
            style={linkStyle} href={link} onClick={this.handleLinkClick}>
            Clique{userYou('', 'z')} ici</ExternalLink> pour avoir un coup de pouce.
        </div>
      </div>
    </div>
  }

  render() {
    const {action, isShown, onClose} = this.props
    const style = {
      fontSize: 14,
      maxWidth: 700,
    }
    return <Modal isShown={isShown} onClose={onClose} style={style}>
      {this.renderAsTip(action)}
    </Modal>
  }
}
const ActionDescriptionModal = connect()(ActionDescriptionModalBase)


class ActionModalHeader extends React.Component {
  static propTypes = {
    action: ACTION_SHAPE,
  }

  render() {
    const {action: {title}} = this.props
    const headerStyle = {
      fontSize: 17,
      minHeight: isMobileVersion ? 50 : 90,
      padding: isMobileVersion ? 15 : 35,
    }
    return <ModalHeader style={headerStyle}>
      {title}
    </ModalHeader>
  }
}


class ActionBase extends React.Component {
  static propTypes = {
    action: ACTION_SHAPE,
    context: PropTypes.oneOf(['', 'project']),
    onOpen: PropTypes.func.isRequired,
    project: PropTypes.object,
    style: PropTypes.object,
  }

  renderRightButton() {
    const {action} = this.props
    const isDone = action.status === 'ACTION_DONE'
    const doneMarkerStyle = {
      fill: colors.GREENISH_TEAL,
      height: 38,
      verticalAlign: 'textBottom',
      width: 27,
    }
    if (isDone) {
      return <div>
        <CheckCircleIcon style={doneMarkerStyle} />
      </div>
    }
    const chevronStyle = {
      fill: colors.CHARCOAL_GREY,
      height: 20,
      // To align with chevron in advice content, because they have an
      // additional border.
      marginRight: 1,
      width: 20,
    }
    return <ChevronRightIcon style={chevronStyle} />
  }

  getBulletColor(actionStatus) {
    if (actionStatus === 'ACTION_SAVED') {
      return colors.GREENISH_TEAL
    }
    if (actionStatus === 'ACTION_UNREAD') {
      return colors.BOB_BLUE
    }
    return colors.SILVER
  }

  renderBullet() {
    const bulletStyle = {
      backgroundColor: this.getBulletColor(this.props.action.status),
      borderRadius: '50%',
      height: 10,
      margin: '0 20px 0 5px',
      width: 10,
    }
    return <div style={bulletStyle} />
  }

  render() {
    const {action: {status, title}, context, onOpen, project} = this.props
    const isRead = status === 'ACTION_UNREAD'
    const style = {
      ':focus': {backgroundColor: colors.LIGHT_GREY},
      ':hover': {backgroundColor: colors.LIGHT_GREY},
      backgroundColor: '#fff',
      marginBottom: 1,
      position: 'relative',
      ...this.props.style,
    }
    const contentStyle = {
      alignItems: 'center',
      color: colors.DARK,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 14,
      height: 55,
      padding: '0 20px',
    }
    const titleStyle = {
      flex: 1,
      fontWeight: isRead ?
        'bold' :
        (status === 'ACTION_DONE' ? 500 : 'inherit'),
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }
    const contextStyle = {
      color: colors.COOL_GREY,
      fontSize: 13,
      fontStyle: 'italic',
      fontWeight: 'normal',
    }
    const contextText = context === 'project' ? project.title : ''
    return <div style={style}>
      <div style={contentStyle} onClick={onOpen}>
        {this.renderBullet()}
        <div style={titleStyle}>
          {title} {contextText ? <span style={contextStyle}>
            - {contextText}
          </span> : null}
        </div>

        {this.renderRightButton()}
      </div>
    </div>
  }
}
const Action = Radium(ActionBase)


export {Action, ActionDescriptionModal}
