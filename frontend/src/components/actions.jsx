import React from 'react'
import {connect} from 'react-redux'
import {browserHistory} from 'react-router'
import Radium from 'radium'

import {ActionStatus} from 'api/project'
import {Modal, ModalHeader} from './modal'
import {Routes} from 'components/url'
import {Colors, Icon, Markdown, Button, Styles} from './theme'
import {isActionStuck, stickyProgress} from 'store/action'
import {readTip, openTipExternalLink} from 'store/actions'


const ACTION_SHAPE = React.PropTypes.shape({
  actionId: React.PropTypes.string.isRequired,
  doneCaption: React.PropTypes.string,
  durationSeconds: React.PropTypes.number,
  extraContent: React.PropTypes.string,
  goal: React.PropTypes.string,
  howTo: React.PropTypes.string,
  justification: React.PropTypes.string,
  shortDescription: React.PropTypes.string,
  shortDescriptionFeminine: React.PropTypes.string,
  status: React.PropTypes.oneOf(Object.keys(ActionStatus)).isRequired,
  title: React.PropTypes.string,
  titleFeminine: React.PropTypes.string,
})


class ActionDescriptionModalBase extends React.Component {
  static propTypes = {
    action: ACTION_SHAPE,
    dispatch: React.PropTypes.func.isRequired,
    gender: React.PropTypes.string,
    isShown: React.PropTypes.bool,
    onClose: React.PropTypes.func.isRequired,
  }

  componentDidMount() {
    const {action, isShown} = this.props
    if (isShown && action && action.status === 'ACTION_UNREAD') {
      this.props.dispatch(readTip(action))
    }
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.isShown && !this.props.isShown &&
        nextProps.action && nextProps.action.status === 'ACTION_UNREAD') {
      this.props.dispatch(readTip(nextProps.action))
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
    const {gender} = this.props
    const shortDescription =
        gender === 'FEMININE' && action.shortDescriptionFeminine || action.shortDescription
    const titleStyle = {
      fontSize: 14,
      fontWeight: 'bold',
      marginTop: 30,
    }
    const contentStyle = {
      maxHeight: '80vh',
      overflow: 'auto',
      padding: 35,
    }
    const linkStyle = {
      color: Colors.SKY_BLUE,
      fontWeight: 'bold',
    }
    return <div>
      <ActionModalHeader action={action} gender={gender} />
      <div style={contentStyle}>
        <Markdown content={shortDescription} />
        <div style={titleStyle}>
          Vous ne savez pas par où commencer ?
        </div>
        <div style={{marginBottom: 15, marginTop: 5}}>
          <a style={linkStyle} target="_blank" href={action.link} onClick={this.handleLinkClick}>
          Cliquez ici</a> pour avoir un coup de pouce.
        </div>
      </div>
    </div>
  }

  render() {
    const {action, isShown, onClose} = this.props
    const style = {
      fontSize: 14,
      width: 700,
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
    gender: React.PropTypes.string,
  }


  render() {
    const {action, gender} = this.props
    const title = gender === 'FEMININE' && action.titleFeminine || action.title
    const headerStyle = {
      display: 'block',
      fontSize: 17,
      padding: 35,
    }
    return <ModalHeader style={headerStyle}>
      {title}
    </ModalHeader>
  }
}


class ActionBase extends React.Component {
  static propTypes = {
    action: ACTION_SHAPE,
    context: React.PropTypes.oneOf(['', 'project']),
    gender: React.PropTypes.string,
    onOpen: React.PropTypes.func.isRequired,
    project: React.PropTypes.object,
    style: React.PropTypes.object,
  }


  renderRightButton() {
    const {action} = this.props
    const isDone = action.status === 'ACTION_DONE'
    const doneMarkerStyle = {
      color: Colors.GREENISH_TEAL,
      fontSize: 27,
    }
    if (isDone) {
      return <Icon name="check-circle" style={doneMarkerStyle} />
    }
    const buttonStyle = {
      ':hover': {
        backgroundColor: Colors.COOL_GREY,
        color: '#fff',
      },
      alignItems: 'center',
      backgroundColor: Colors.MODAL_PROJECT_GREY,
      color: Colors.COOL_GREY,
      display: 'flex',
      padding: 2,
      transition: 'background-color 450ms, color 450ms',
    }
    const chevronStyle = {
      fontSize: 20,
      verticalAlign: 'middle',
    }
    return <Button isNarrow={true} type="discreet" style={buttonStyle}>
      <Icon name="chevron-right" style={chevronStyle} />
    </Button>
  }

  handleProjectClick = event => {
    event.stopPropagation()
    browserHistory.push(Routes.PROJECT_PAGE + '/' + this.props.project.projectId)
  }

  getBulletColor(actionStatus) {
    if (actionStatus === 'ACTION_SAVED') {
      return Colors.GREENISH_TEAL
    }
    if (actionStatus === 'ACTION_UNREAD') {
      return Colors.SKY_BLUE
    }
    return Colors.SILVER
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

  renderProgress() {
    const {action} = this.props
    if (!isActionStuck(action)) {
      return null
    }
    const style = {
      backgroundColor: Colors.MODAL_PROJECT_GREY,
      borderRadius: 100,
      height: 10,
      margin: 15,
      overflow: 'hidden',
      position: 'relative',
      // This is a CSS stunt to make the hidden overflow + border-radius
      // effective on Mac + Chrome.
      transform: 'scale(1)',
      width: 100,
    }
    const progressStyle = {
      ...Styles.PROGRESS_GRADIENT,
      bottom: 0,
      left: 0,
      position: 'absolute',
      top: 0,
      width: 100 * stickyProgress(action),
    }
    return <div style={style}>
      <div style={progressStyle} />
    </div>
  }

  renderStarOrBullet() {
    const {action} = this.props
    if (!action.goal) {
      return this.renderBullet()
    }
    const isStuck = isActionStuck(action)
    const style = {
      color: isStuck ? Colors.SUN_YELLOW : Colors.PINKISH_GREY,
      fontSize: 20,
      paddingRight: 12,
    }
    return <Icon name={isStuck ? 'star' : 'star-outline'} style={style} />
  }

  render() {
    const {action, context, gender, onOpen, project} = this.props
    const isRead = action.status === 'ACTION_UNREAD'
    const style = {
      ':focus': {backgroundColor: Colors.LIGHT_GREY},
      ':hover': {backgroundColor: Colors.LIGHT_GREY},
      backgroundColor: '#fff',
      marginBottom: 1,
      position: 'relative',
      ...this.props.style,
    }
    const contentStyle = {
      alignItems: 'center',
      color: Colors.DARK,
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
        (action.status === 'ACTION_DONE' ? 500 : 'inherit'),
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    const contextStyle = {
      color: Colors.COOL_GREY,
      fontSize: 13,
      fontStyle: 'italic',
      fontWeight: 'normal',
    }
    const title = gender === 'FEMININE' && action.titleFeminine || action.title
    const contextText = context === 'project' ? project.title : ''
    return <div style={style}>
      <div style={contentStyle} onClick={onOpen}>
        {this.renderStarOrBullet()}
        <div style={titleStyle}>
          {title} {contextText ? <span style={contextStyle}>
            - {contextText}
          </span> : null}
        </div>

        {this.renderProgress()}
        {this.renderRightButton()}
      </div>
    </div>
  }
}
const Action = connect(({user}) => ({
  gender: user.profile.gender,
}))(Radium(ActionBase))


export {Action, ActionDescriptionModal, ACTION_SHAPE}
