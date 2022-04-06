import _uniqueId from 'lodash/uniqueId'
import type {MdiReactIconComponentType} from 'mdi-react/dist/typings'
import MenuDownIcon from 'mdi-react/MenuDownIcon'
import MenuRightIcon from 'mdi-react/MenuRightIcon'
import React, {useCallback, useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import type {ActionWithId} from 'store/actions'
import {expandActionList, useDispatch} from 'store/actions'
import isMobileVersion from 'store/mobile'
import {useProject} from 'store/project'

import ActionListElement from './action_list_element'

interface Props {
  actions: readonly ActionWithId[]
  icon: MdiReactIconComponentType
  isExpanded: boolean
  onExpand: (sectionId: string) => void
  sectionId: string
  selectedAction?: ActionWithId
  style?: React.CSSProperties
  title: string
}

const headerContainerStyle: React.CSSProperties = {
  alignItems: 'center',
  ...!isMobileVersion && {
    backgroundColor: '#fff',
    boxShadow: 'rgb(0 0 0 / 6%) 0px 1px 2px, rgb(0 0 0 / 10%) 0px 1px 3px',
  },
  display: 'flex',
  marginTop: 1,
  padding: '11px 5px 11px 15px',
  width: '100%',
}
const titleContainerStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flex: 1,
  fontSize: 18,
  fontWeight: 'bold',
}
const countStyleBase: React.CSSProperties = {
  alignItems: 'center',
  borderRadius: 4,
  display: 'flex',
  fontSize: 14,
  fontWeight: 'normal',
  height: 27,
  justifyContent: 'center',
  width: 25,
}
const noListStyle: React.CSSProperties = {
  listStyleType: 'none',
  margin: 0,
  padding: 0,
}

const elementStyle: React.CSSProperties = {
  marginTop: isMobileVersion ? 10 : 1,
}

// TODO(sil): Make the expansion smoother.
const ActionList = (props: Props): React.ReactElement => {
  const {actions, icon: Icon, isExpanded, onExpand, sectionId, selectedAction, style, title} = props
  const hasActions = !!actions?.length
  const {t} = useTranslation()
  const dispatch = useDispatch()
  const project = useProject()
  const handleClick = useCallback((): void => {
    if (hasActions) {
      onExpand(isExpanded ? '' : sectionId)
      if (!project) {
        return
      }
      dispatch(expandActionList(project, isExpanded ? 'close' : 'open'))
    }
  }, [dispatch, hasActions, isExpanded, onExpand, project, sectionId])
  const sectionContainerStyle = useMemo((): React.CSSProperties => ({
    borderRadius: isMobileVersion ? 0 : isExpanded ? '10px 10px 0 0' : 10,
    ...style,
  }), [isExpanded, style])
  const isSelected = !!(selectedAction &&
    actions?.some(({actionId}) => selectedAction.actionId === actionId))
  const isExpandedInMobile = isMobileVersion && isExpanded
  const isEmphasized = isSelected || isExpandedInMobile
  const countStyle = useMemo((): React.CSSProperties => ({
    ...countStyleBase,
    backgroundColor: isEmphasized ? colors.BOB_BLUE_HOVER : colors.MODAL_PROJECT_GREY,
    color: isEmphasized ? colors.BOB_BLUE : 'inherit',
  }), [isEmphasized])
  const titleId = useMemo(_uniqueId, [])
  const MenuIcon = isExpanded ? MenuDownIcon : MenuRightIcon
  return <section style={sectionContainerStyle} aria-labelledby={titleId}>
    <button
      style={headerContainerStyle} onClick={handleClick}
      aria-label={isExpanded ? t('Fermer la liste') : t('Ouvrir la liste')} type="button"
      aria-expanded={isExpanded} aria-describedby={titleId}>
      <span style={titleContainerStyle} id={titleId}>
        <Icon
          aria-hidden={true} focusable={false}
          size={20} color={isEmphasized ? colors.BOB_BLUE : 'currentColor'} />
        <span style={{color: isExpandedInMobile ? colors.BOB_BLUE : 'inherit', padding: '0 11px'}}>
          {title}
        </span>
        <span style={countStyle}>{actions?.length || 0}</span>
      </span>
      <MenuIcon
        size={36} color={isEmphasized ? colors.BOB_BLUE : 'currentColor'} aria-hidden={true}
        focusable={false} />
    </button>
    {isExpanded && hasActions ? <ul style={noListStyle}>
      {actions.map(action =>
        <ActionListElement
          style={elementStyle} key={action.actionId} action={action}
          isSelected={selectedAction?.actionId === action.actionId} />)}
    </ul> : null}
  </section>
}
export default React.memo(ActionList)
