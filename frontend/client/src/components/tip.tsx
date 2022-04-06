import _uniqueId from 'lodash/uniqueId'
import CheckCircleIcon from 'mdi-react/CheckCircleIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import React, {useCallback, useEffect, useMemo} from 'react'
import {useDispatch} from 'react-redux'

import type {DispatchAllActions} from 'store/actions'
import {readTip, openTipExternalLink} from 'store/actions'

import Trans from 'components/i18n_trans'
import isMobileVersion from 'store/mobile'
import {SmartLink} from 'components/radium'

import ExternalLink from 'components/external_link'
import Markdown from 'components/markdown'
import {Modal, ModalHeader} from './modal'


export type TipPropWithId = bayes.bob.Action & {actionId: string}


interface ModalProps {
  isShown?: boolean
  onClose: () => void
  tip?: TipPropWithId
}


const TipDescriptionModalBase: React.FC<ModalProps> =
({isShown, onClose, tip}: ModalProps): React.ReactElement|null => {
  const dispatch = useDispatch<DispatchAllActions>()
  useEffect(() => {
    if (isShown && tip?.status === 'ACTION_UNREAD') {
      dispatch(readTip(tip))
    }
  }, [tip, dispatch, isShown])
  const handleLinkClick = useCallback((): void => {
    if (tip) {
      dispatch(openTipExternalLink(tip))
    }
  }, [tip, dispatch])
  const titleId = useMemo(_uniqueId, [])
  if (!tip) {
    return null
  }
  const style = {
    fontSize: 14,
    maxWidth: 700,
  }
  const {link, shortDescription} = tip
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
  return <Modal isShown={isShown} onClose={onClose} style={style} aria-labelledby={titleId}>
    <div>
      <TipModalHeader {...tip} id={titleId} />
      <div style={contentStyle}>
        <Markdown content={shortDescription} />
        <Trans style={titleStyle} ns="components">
          Vous ne savez pas par où commencer&nbsp;?
        </Trans>
        <Trans style={{marginBottom: 15, marginTop: 5}} ns="components">
          <ExternalLink
            style={linkStyle} href={link} onClick={handleLinkClick}>
            Cliquez ici</ExternalLink> pour avoir un coup de pouce.
        </Trans>
      </div>
    </div>
  </Modal>
}
const TipDescriptionModal = React.memo(TipDescriptionModalBase)


const TipModalHeaderBase =
({id, title}: bayes.bob.Action & {id: string}): React.ReactElement => {
  const headerStyle = {
    fontSize: 17,
    minHeight: isMobileVersion ? 50 : 90,
    padding: isMobileVersion ? 15 : 35,
  }
  return <ModalHeader style={headerStyle} id={id}>
    {title}
  </ModalHeader>
}
const TipModalHeader = React.memo(TipModalHeaderBase)


interface InlineTipProps {
  onOpen: (tip?: bayes.bob.Action) => void
  style?: React.CSSProperties
  tip?: bayes.bob.Action
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
    return <span>
      <CheckCircleIcon style={doneMarkerStyle} aria-hidden={true} focusable={false} />
    </span>
  }
  const chevronStyle = {
    fill: colors.CHARCOAL_GREY,
    height: 20,
    // To align with chevron in advice content, because they have an
    // additional border.
    marginRight: 1,
    width: 20,
  }
  return <ChevronRightIcon style={chevronStyle} aria-hidden={true} focusable={false} />
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


const InlineTipBase: React.FC<InlineTipProps> = (props: InlineTipProps): React.ReactElement => {
  const {
    tip, tip: {status = undefined, title = undefined} = {},
    onOpen, style: propsStyle,
  } = props
  const onClick = useCallback((): void => onOpen(tip), [tip, onOpen])
  const isRead = status === 'ACTION_UNREAD'
  const style: RadiumCSSProperties = {
    ':focus': {backgroundColor: colors.LIGHT_GREY},
    ':hover': {backgroundColor: colors.LIGHT_GREY},
    'alignItems': 'center',
    'backgroundColor': '#fff',
    'color': colors.DARK,
    'display': 'flex',
    'fontSize': 14,
    'height': 55,
    'marginBottom': 1,
    'padding': '0 20px',
    'position': 'relative',
    'width': '100%',
    ...propsStyle,
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
  return <SmartLink style={style} onClick={onClick}>
    <span style={getBulletStyle(status)} />
    <span style={titleStyle}>{title}</span>
    <RightButton isDone={status === 'ACTION_DONE'} />
  </SmartLink>
}
const InlineTip = React.memo(InlineTipBase)


export {InlineTip, TipDescriptionModal}
