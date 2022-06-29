import type {TFunction} from 'i18next'
import React, {useMemo} from 'react'

import type {LocalizableString} from 'store/i18n'
import {prepareT} from 'store/i18n'

import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import {RadiumExternalLink} from 'components/radium'

import type {CardProps} from './base'
import {HandicapSuggestionWarning, MethodSuggestionList, useAdviceData} from './base'


const emptyArray = [] as const


const isNonEmptyString = (a: string|undefined): a is string => !!a


const OtherWorkEnvMethod = (props: CardProps): React.ReactElement => {
  const {data: {workEnvironmentKeywords: {
    domains = emptyArray, sectors = emptyArray, structures = emptyArray} = {},
  }, loading} = useAdviceData<bayes.bob.OtherWorkEnvAdviceData>(props)
  const {
    handleExplore,
    profile: {hasHandicap},
    project,
    t,
  } = props
  const areSectorsShown = sectors.length > 1
  const areStructuresShown = structures.length > 1
  const style: React.CSSProperties = {
    position: 'relative',
  }
  if (loading) {
    return loading
  }
  return <div>
    <div style={style}>
      {(domains.length > 1) ?
        <Section
          kind={prepareT('secteurs')}
          items={domains.map(({name}): string|undefined => name).filter(isNonEmptyString)}
          {...{project, t}} onExplore={handleExplore('domain')} /> :
        <Section
          kind={prepareT('secteurs')} items={sectors} {...{project, t}}
          onExplore={handleExplore('sector')} />}
      {(areSectorsShown && areStructuresShown) ? <div style={{height: 20, width: 35}} /> : null}
      <Section
        kind={prepareT('types de structure')} items={structures} {...{project, t}}
        onExplore={handleExplore('structure')} />
      <HandicapSuggestionWarning
        hasHandicap={!!hasHandicap} types={t('environnements de travail')} />
    </div>
  </div>
}
const ExpandedAdviceCardContent = React.memo(OtherWorkEnvMethod)


interface SearchableElementProps {
  onClick?: () => void
  project: bayes.bob.Project
  style?: RadiumCSSProperties
  title: string
}


const SearchableElementBase = (props: SearchableElementProps): React.ReactElement => {
  const {onClick, project, title, style} = props

  const url = useMemo(
    () => `https://${config.googleTopLevelDomain}/search?q=${encodeURIComponent(title + ' ' + project.title)}`,
    [project.title, title])
  const linkStyle = useMemo((): RadiumCSSProperties => ({
    color: 'inherit',
    textDecoration: 'none',
    ...style,
  }), [style])

  return <RadiumExternalLink style={linkStyle} onClick={onClick} href={url}>
    {title}
  </RadiumExternalLink>
}
const SearchableElement = React.memo(SearchableElementBase)


interface SectionProps {
  items: readonly string[]
  kind: LocalizableString<'secteurs' | 'types de structure'>
  onExplore: () => void
  project: bayes.bob.Project
  t: TFunction
}


const SectionBase = (props: SectionProps): React.ReactElement|null => {
  const {items, kind, onExplore, project, t, t: translate, ...extraProps} = props
  if (!items || items.length < 2) {
    return null
  }
  const title = <Trans parent={null} t={t}>
    <GrowingNumber number={items.length} /> {{kind: translate(...kind)}} qui recrutent
    dans votre métier
  </Trans>
  return <MethodSuggestionList {...extraProps} title={title}>
    {items.map((title, index): ReactStylableElement => <SearchableElement
      title={title} project={project} key={`job-board-${index}`}
      onClick={onExplore} />)}
  </MethodSuggestionList>
}
const Section = React.memo(SectionBase)


export default {ExpandedAdviceCardContent, pictoName: 'signPost' as const}
