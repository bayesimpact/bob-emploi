import _uniqueId from 'lodash/uniqueId'
import CalendarClock from 'mdi-react/CalendarClockIcon'
import React, {useCallback, useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import {SECTIONS, decideSection} from 'store/action_plan'
import type {ActionWithId} from 'store/actions'
import {useDispatch, openActionDate, saveActionDate} from 'store/actions'
import {combineTOptions} from 'store/i18n'
import {useProject} from 'store/project'

import {useIsTabNavigationUsed} from 'hooks/tab_navigation'

import Button from 'components/button'
import {colorToAlpha} from 'components/colors'
import {Modal, useModal} from 'components/modal'
import {useRadium} from 'components/radium'

interface Props {
  'aria-describedby': string
  action: ActionWithId
  style?: React.CSSProperties
  visualElement: 'page'|'plan'
}

const modalStyle = {
  borderRadius: 4,
  margin: 20,
  minWidth: 225,
} as const
const buttonIconStyle: React.CSSProperties = {
  height: '1.5em',
  marginRight: 10,
}

const possibleSections = SECTIONS.filter(
  ({daysToCompletion}) => typeof daysToCompletion === 'number')
type DateSection = (typeof possibleSections)[number]

interface DateProps {
  onChange?: (section: DateSection) => void
  section: DateSection
}

const deadlineStyle: RadiumCSSProperties = {
  ':focus': {backgroundColor: colors.MODAL_PROJECT_GREY},
  ':hover': {backgroundColor: colors.MODAL_PROJECT_GREY},
  'display': 'block',
  'padding': '10px 15px',
  'textAlign': 'center',
  'width': '100%',
}
const DeadlineBase = ({onChange, section, section: {name}}: DateProps) => {
  const [translate] = useTranslation('translation')
  const onClick = useCallback(() => onChange?.(section), [onChange, section])
  const [handlers] = useRadium({style: deadlineStyle})
  return <button {...handlers} onClick={onClick} type="button">
    {translate(...combineTOptions(name, {count: 1}))}
  </button>
}
const Deadline = React.memo(DeadlineBase)

const stopPropagation = (event: React.MouseEvent) => event.stopPropagation()

const DeadlineButton = ({action, style, visualElement, ...otherProps}: Props) => {
  const {t} = useTranslation('components')
  const [isShown, open, close] = useModal()
  const project = useProject()
  const {daysToCompletion} = decideSection(action)
  const isTabNavigationUsed = useIsTabNavigationUsed()
  const hasSetDate = typeof daysToCompletion === 'number'
  const dispatch = useDispatch()
  const onChange = useCallback(({daysToCompletion}: DateSection) => {
    if (!project) {
      return
    }
    dispatch(
      saveActionDate(project, action, visualElement, daysToCompletion),
    )
    close()
  }, [action, close, dispatch, project, visualElement])
  const onOpen = useCallback((event: React.MouseEvent) => {
    if (!project) {
      return
    }
    event.stopPropagation()
    dispatch(openActionDate(project, action, visualElement))
    open()
  }, [action, dispatch, visualElement, open, project])
  const buttonStyle = useMemo((): RadiumCSSProperties => ({
    ':hover': {
      boxShadow: isTabNavigationUsed ? `0px 0px 0px 2px ${colorToAlpha(colors.DARK_TWO, .4)}` : '',
    },
    'alignItems': 'center',
    'border': `1px solid ${hasSetDate ? 'transparent' : colorToAlpha(colors.DARK_TWO, .4)}`,
    'borderRadius': 8,
    'color': colorToAlpha(colors.DARK_TWO, .8),
    'display': 'inline-flex',
    'justifyContent': 'center',
    'padding': '4px 6px 4px 6px',
    ...style,
  }), [hasSetDate, isTabNavigationUsed, style])
  const buttonId = useMemo(_uniqueId, [])

  return <React.Fragment>
    <Modal
      isShown={isShown} aria-labelledby={buttonId} onClose={close} style={modalStyle}
      onClick={stopPropagation} {...otherProps}>
      <div style={{borderRadius: modalStyle.borderRadius, overflow: 'hidden'}}>
        {possibleSections.map((section) =>
          <Deadline key={section.sectionId} section={section} onChange={onChange} />)}
      </div>
    </Modal>
    <Button id={buttonId} onClick={onOpen} type="discreet" style={buttonStyle} {...otherProps}>
      <CalendarClock style={buttonIconStyle} focusable={false} aria-hidden={true} />
      {hasSetDate ? t("Changer l'échéance") : t('Définir une date')}
    </Button>
  </React.Fragment>
}
export default React.memo(DeadlineButton)
