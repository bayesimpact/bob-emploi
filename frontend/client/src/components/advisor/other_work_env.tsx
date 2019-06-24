import Radium from 'radium'
import React from 'react'
import PropTypes from 'prop-types'

import {YouChooser} from 'store/french'

import {GrowingNumber} from 'components/theme'
import NewPicto from 'images/advices/picto-other-work-env.svg'

import {CardWithContentProps, CardProps, MethodSuggestionList, WithAdvice, WithAdviceData,
  connectExpandedCardWithContent} from './base'


class ExpandedAdviceCardContentBase
  extends React.PureComponent<CardWithContentProps<bayes.bob.OtherWorkEnvAdviceData>> {
  public static propTypes = {
    adviceData: PropTypes.shape({
      workEnvironmentKeywords: PropTypes.shape({
        domains: PropTypes.arrayOf(PropTypes.shape({
          name: PropTypes.string,
        }).isRequired),
        sectors: PropTypes.arrayOf(PropTypes.string.isRequired),
        structures: PropTypes.arrayOf(PropTypes.string.isRequired),
      }),
    }).isRequired,
    handleExplore: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {
      adviceData: {workEnvironmentKeywords: {domains = [], sectors = [], structures = []} = {}},
      handleExplore,
      project,
      userYou,
    } = this.props
    const areSectorsShown = sectors.length > 1
    const areStructuresShown = structures.length > 1
    const style: React.CSSProperties = {
      position: 'relative',
    }
    return <div>
      <div style={style}>
        {(domains.length > 1) ?
          <Section kind="secteurs" items={domains.map(({name}): string => name)}
            {...{project, userYou}} onExplore={handleExplore('domain')} /> :
          <Section
            kind="secteurs" items={sectors} {...{project, userYou}}
            onExplore={handleExplore('sector')} />}
        {(areSectorsShown && areStructuresShown) ? <div style={{height: 20, width: 35}} /> : null}
        <Section
          kind="types de structure" items={structures} {...{project, userYou}}
          onExplore={handleExplore('structure')} />
      </div>
    </div>
  }
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<{}, bayes.bob.OtherWorkEnvAdviceData, CardProps>()(
    ExpandedAdviceCardContentBase)


interface SearchableElementProps {
  onClick?: () => void
  project: bayes.bob.Project
  style?: React.CSSProperties
  title: string
}


class SearchableElementBase extends React.PureComponent<SearchableElementProps> {
  public static propTypes = {
    onClick: PropTypes.func,
    project: PropTypes.object.isRequired,
    style: PropTypes.object,
    title: PropTypes.string.isRequired,
  }

  private handleClick = (): void => {
    const {onClick, project, title} = this.props
    const url = `https://www.google.fr/search?q=${encodeURIComponent(title + ' ' + project.title)}`
    window.open(url, '_blank')
    onClick && onClick()
  }

  public render(): React.ReactNode {
    const {title, style} = this.props
    return <div style={style} onClick={this.handleClick}>
      {title}
    </div>
  }
}
const SearchableElement = Radium(SearchableElementBase)


interface SectionProps {
  items: string[]
  kind: 'secteurs' | 'types de structure'
  onExplore: () => void
  project: bayes.bob.Project
  userYou: YouChooser
}


class Section extends React.PureComponent<SectionProps> {
  public static propTypes = {
    items: PropTypes.arrayOf(PropTypes.node.isRequired),
    kind: PropTypes.oneOf(['secteurs', 'types de structure']).isRequired,
    onExplore: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {items, kind, onExplore, project, userYou, ...extraProps} = this.props
    if (!items || items.length < 2) {
      return null
    }
    const title = <React.Fragment>
      <GrowingNumber number={items.length} /> {kind} qui recrutent
      dans {userYou('ton', 'votre')} métier
    </React.Fragment>
    return <MethodSuggestionList {...extraProps} title={title}>
      {items.map((title, index): ReactStylableElement => <SearchableElement
        title={title} project={project} key={`job-board-${index}`}
        onClick={onExplore} />)}
    </MethodSuggestionList>
  }
}


type TakeAwayProps = WithAdviceData<bayes.bob.OtherWorkEnvAdviceData> & WithAdvice


class TakeAwayBase extends React.PureComponent<TakeAwayProps> {
  public static propTypes = {
    adviceData: PropTypes.shape({
      workEnvironmentKeywords: PropTypes.shape({
        domains: PropTypes.array,
        sectors: PropTypes.array,
        structures: PropTypes.array,
      }),
    }).isRequired,
  }

  public render(): React.ReactNode {
    const {
      adviceData: {workEnvironmentKeywords: {domains = [], sectors = [], structures = []} = {}},
    } = this.props
    if (domains.length > 1) {
      return `${domains.length} domaines trouvés`
    }
    if (sectors.length) {
      const maybeS = sectors.length > 1 ? 's' : ''
      return `${sectors.length} secteur${maybeS} trouvé${maybeS}`
    }
    if (structures.length) {
      const maybeS = structures.length > 1 ? 's' : ''
      return `${structures.length} structure${maybeS} trouvée${maybeS}`
    }
    return ''
  }
}
const TakeAway = connectExpandedCardWithContent()(TakeAwayBase)


export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
