import {TFunction} from 'i18next'
import React, {useCallback} from 'react'
import PropTypes from 'prop-types'

import {LocalizableString, prepareT} from 'store/i18n'

import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import {RadiumDiv} from 'components/radium'
import Picto from 'images/advices/picto-other-work-env.svg'

import {CardProps, MethodSuggestionList, useAdviceData} from './base'


const emptyArray = [] as const


const isNonEmptyString = (a: string|undefined): a is string => !!a


const OtherWorkEnvMethod = (props: CardProps): React.ReactElement => {
  const {data: {workEnvironmentKeywords: {
    domains = emptyArray, sectors = emptyArray, structures = emptyArray} = {},
  }, loading} = useAdviceData<bayes.bob.OtherWorkEnvAdviceData>(props)
  const {
    handleExplore,
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
    </div>
  </div>
}
OtherWorkEnvMethod.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  project: PropTypes.object.isRequired,
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(OtherWorkEnvMethod)


interface SearchableElementProps {
  onClick?: () => void
  project: bayes.bob.Project
  style?: React.CSSProperties
  title: string
}


const SearchableElementBase = (props: SearchableElementProps): React.ReactElement => {
  const {onClick, project, title, style} = props

  const handleClick = useCallback((): void => {
    const url = `https://${config.googleTopLevelDomain}/search?q=${encodeURIComponent(title + ' ' + project.title)}`
    window.open(url, '_blank')
    onClick && onClick()
  }, [onClick, project, title])

  return <RadiumDiv style={style} onClick={handleClick}>
    {title}
  </RadiumDiv>
}
SearchableElementBase.propTypes = {
  onClick: PropTypes.func,
  project: PropTypes.object.isRequired,
  style: PropTypes.object,
  title: PropTypes.string.isRequired,
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
SectionBase.propTypes = {
  items: PropTypes.arrayOf(PropTypes.node.isRequired),
  kind: PropTypes.oneOf(['secteurs', 'types de structure']).isRequired,
  onExplore: PropTypes.func.isRequired,
  project: PropTypes.object.isRequired,
  t: PropTypes.func.isRequired,
}
const Section = React.memo(SectionBase)


export default {ExpandedAdviceCardContent, Picto}
