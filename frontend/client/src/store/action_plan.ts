import {differenceInCalendarDays as diffDays} from 'date-fns'
import type {TFunction} from 'i18next'
import i18next from 'i18next'
import _keyBy from 'lodash/keyBy'
import _mapValues from 'lodash/mapValues'
import _memoize from 'lodash/memoize'
import BookClock from 'mdi-react/BookClockOutlineIcon'
import CalendarClock from 'mdi-react/CalendarClockIcon'
import ClockCheck from 'mdi-react/ClockCheckOutlineIcon'
import type {MdiReactIconComponentType} from 'mdi-react/dist/typings'
import {useParams} from 'react-router-dom'

import type {ActionWithId} from 'store/actions'
import actionContents from 'store/data/actionTemplates.json'
import {useProject} from 'store/project'
import type {LocalizableString} from 'store/i18n'
import {prepareNamespace, prepareT, prepareT as prepareTNoExtract} from 'store/i18n'

const DURATION_TEXT: {[duration in bayes.bob.ActionDuration]: LocalizableString} = {
  BETWEEN_1_AND_3_HOURS: prepareT('Entre 1-3 heures'),
  FIFTEEN_TO_30_MIN: prepareT('15-30 minutes'),
  ONE_HOUR: prepareT('1 heure'),
  UNKNOWN_ACTION_DURATION: prepareTNoExtract('-'),
} as const

export type Section =
  | 'done'
  | 'never'
  | 'toSchedule'
  | 'today'
  | 'tomorrow'
  | 'week'

interface SectionProps {
  daysToCompletion?: number
  icon: MdiReactIconComponentType
  name: LocalizableString
  sectionId: Section
}

const SECTIONS: readonly SectionProps[] = [
  {
    icon: BookClock,
    name: prepareT('À planifier'),
    sectionId: 'toSchedule',
  },
  {
    daysToCompletion: 0,
    icon: ClockCheck,
    name: prepareT("À faire aujourd'hui"),
    sectionId: 'today',
  },
  {
    daysToCompletion: 1,
    icon: CalendarClock,
    name: prepareT('À faire demain'),
    sectionId: 'tomorrow',
  },
  {
    daysToCompletion: 6,
    icon: CalendarClock,
    name: prepareT('À faire cette semaine'),
    sectionId: 'week',
  },
  {
    icon: CalendarClock,
    name: prepareT('Terminée', {count: 1}),
    sectionId: 'done',
  },
  {
    icon: ClockCheck,
    name: prepareT('Refusée', {count: 1}),
    sectionId: 'never',
  },
] as const

const SECTIONS_BY_ID = _keyBy(SECTIONS, 'sectionId')

// Keep it sync with frontend/server/mail/all_campaigns.py
const decideSection = ({expectedCompletionAt, status}: bayes.bob.Action): SectionProps => {
  if (status === 'ACTION_DONE') {
    return SECTIONS_BY_ID['done']
  }
  if (status !== 'ACTION_CURRENT') {
    return SECTIONS_BY_ID['never']
  }
  if (!expectedCompletionAt) {
    return SECTIONS_BY_ID['toSchedule']
  }
  const remainingDays = diffDays(new Date(expectedCompletionAt), Date.now())
  // More than two days.
  if (remainingDays >= 2) {
    return SECTIONS_BY_ID['week']
  }
  // More than one day.
  if (remainingDays >= 1) {
    return SECTIONS_BY_ID['tomorrow']
  }
  return SECTIONS_BY_ID['today']
}

const useAction = (): undefined|ActionWithId => {
  const project = useProject()
  const {actionId} = useParams<{actionId?: string}>()
  if (!project || !project.actionPlanStartedAt) {
    return
  }
  if (!actionId) {
    return
  }
  return project.actions?.find((a): a is ActionWithId => a.actionId === actionId)
}

const translatedActions = _memoize(
  (translate: TFunction): Record<string, string> => {
    prepareNamespace('actionTemplates')
    return _mapValues(
      actionContents,
      (text: string): string => translate(text, {ns: 'actionTemplates'}))
  },
  (): string => i18next.language,
)

const getActionResourceContent = (actionId: string, translate: TFunction): string|undefined => {
  const translatedActionContents = translatedActions(translate)
  return translatedActionContents[actionId]
}
getActionResourceContent.cache = translatedActions.cache

export {DURATION_TEXT, SECTIONS, decideSection, getActionResourceContent, useAction}
