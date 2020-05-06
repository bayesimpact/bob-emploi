import CheckCircleIcon from 'mdi-react/CheckCircleIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import React, {useCallback, useEffect} from 'react'
import {useDispatch} from 'react-redux'

import {DispatchAllActions, readTip, openTipExternalLink} from 'store/actions'

import {Trans} from 'components/i18n'
import {isMobileVersion} from 'components/mobile'
import {RadiumDiv} from 'components/radium'

import {Modal, ModalHeader} from './modal'
import {ExternalLink, Markdown} from './theme'


export type ActionPropWithId = bayes.bob.Action & {actionId: string}


interface ModalProps {
  action?: ActionPropWithId
  isShown?: boolean
  onClose: () => void
}


// TODO(pascal): Add static propTypes back.
const ActionDescriptionModalBase: React.FC<ModalProps> =
({action, isShown, onClose}: ModalProps): React.ReactElement|null => {
  const dispatch = useDispatch<DispatchAllActions>()
  useEffect(() => {
    if (isShown && action?.status === 'ACTION_UNREAD') {
      dispatch(readTip(action))
    }
  }, [action, dispatch, isShown])
  const handleLinkClick = useCallback((): void => {
    if (action) {
      dispatch(openTipExternalLink(action))
    }
  }, [action, dispatch])
  if (!action) {
    return null
  }
  const style = {
    fontSize: 14,
    maxWidth: 700,
  }
  const {link, shortDescription} = action
  const titleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 30,
  }
  const contentStyle = {
    padding: isMobileVersion ? 15 : 35,
  }
  const linkStyle: React.CSSProperties = {
    color: colors.BOB_BLUE,
    fontWeight: 'bold',
  }
  return <Modal isShown={isShown} onClose={onClose} style={style}>
    <div>
      <ActionModalHeader {...action} />
      <div style={contentStyle}>
        <Markdown content={shortDescription} />
        <Trans style={titleStyle}>
          Vous ne savez pas par où commencer&nbsp;?
        </Trans>
        <Trans style={{marginBottom: 15, marginTop: 5}}>
          <ExternalLink
            style={linkStyle} href={link} onClick={handleLinkClick}>
            Cliquez ici</ExternalLink> pour avoir un coup de pouce.
        </Trans>
      </div>
    </div>
  </Modal>
}
const ActionDescriptionModal = React.memo(ActionDescriptionModalBase)


const ActionModalHeaderBase: React.FC<bayes.bob.Action> =
({title}: bayes.bob.Action): React.ReactElement => {
  const headerStyle = {
    fontSize: 17,
    minHeight: isMobileVersion ? 50 : 90,
    padding: isMobileVersion ? 15 : 35,
  }
  return <ModalHeader style={headerStyle}>
    {title}
  </ModalHeader>
}
ActionModalHeaderBase.propTypes = {
  title: PropTypes.string,
}
const ActionModalHeader = React.memo(ActionModalHeaderBase)


interface ActionProps {
  action?: bayes.bob.Action
  context?: '' | 'project'
  onOpen: (action?: bayes.bob.Action) => void
  project: bayes.bob.Project
  style?: React.CSSProperties
}


const RightButtonBase: React.FC<{isDone: boolean}> =
({isDone}: {isDone: boolean}): React.ReactElement => {
  const doneMarkerStyle: React.CSSProperties = {
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
const RightButton = React.memo(RightButtonBase)


const getBulletColor = (actionStatus?: bayes.bob.ActionStatus): string => {
  if (actionStatus === 'ACTION_SAVED') {
    return colors.GREENISH_TEAL
  }
  if (actionStatus === 'ACTION_UNREAD') {
    return colors.BOB_BLUE
  }
  return colors.SILVER
}

const getBulletStyle = (status?: bayes.bob.ActionStatus): React.CSSProperties => ({
  backgroundColor: getBulletColor(status),
  borderRadius: '50%',
  height: 10,
  margin: '0 20px 0 5px',
  width: 10,
})


const ActionBase: React.FC<ActionProps> = (props: ActionProps): React.ReactElement => {
  const {
    action, action: {status = undefined, title = undefined} = {},
    context, onOpen, project, style: propsStyle,
  } = props
  const onClick = useCallback((): void => onOpen(action), [action, onOpen])
  const isRead = status === 'ACTION_UNREAD'
  const style: RadiumCSSProperties = {
    ':focus': {backgroundColor: colors.LIGHT_GREY},
    ':hover': {backgroundColor: colors.LIGHT_GREY},
    'backgroundColor': '#fff',
    'marginBottom': 1,
    'position': 'relative',
    ...propsStyle,
  }
  const contentStyle: React.CSSProperties = {
    alignItems: 'center',
    color: colors.DARK,
    cursor: 'pointer',
    display: 'flex',
    fontSize: 14,
    height: 55,
    padding: '0 20px',
  }
  const titleStyle: React.CSSProperties = {
    flex: 1,
    fontWeight: isRead ?
      'bold' :
      (status === 'ACTION_DONE' ? 500 : 'inherit'),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
  const contextStyle: React.CSSProperties = {
    color: colors.COOL_GREY,
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: 'normal',
  }
  const contextText = context === 'project' ? project.title : ''
  return <RadiumDiv style={style}>
    <div style={contentStyle} onClick={onClick}>
      <div style={getBulletStyle(status)} />
      <div style={titleStyle}>
        {title} {contextText ? <span style={contextStyle}>
          - {contextText}
        </span> : null}
      </div>
      <RightButton isDone={status === 'ACTION_DONE'} />
    </div>
  </RadiumDiv>
}
ActionBase.propTypes = {
  action: PropTypes.shape({
    actionId: PropTypes.string.isRequired,
    status: PropTypes.string,
    title: PropTypes.string,
  }),
  context: PropTypes.oneOf(['', 'project']),
  onOpen: PropTypes.func.isRequired,
  project: PropTypes.object,
  style: PropTypes.object,
}
const Action = React.memo(ActionBase)


export {Action, ActionDescriptionModal}
