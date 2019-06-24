import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import {YouChooser} from 'store/french'

import {CircularProgress, ExternalLink, GrowingNumber, Tag} from 'components/theme'
import NewPicto from 'images/advices/picto-find-a-jobboard.svg'

import {CardProps, CardWithContentProps, makeTakeAwayFromAdviceData, MethodSuggestionList,
  connectExpandedCardWithContent} from './base'


class ExpandedAdviceCardContentBase
  extends React.PureComponent<CardWithContentProps<bayes.bob.JobBoards>> {
  public static propTypes = {
    adviceData: PropTypes.shape({
      jobBoards: PropTypes.arrayOf(PropTypes.object.isRequired),
    }).isRequired,
    handleExplore: PropTypes.func.isRequired,
    project: PropTypes.shape({
      targetJob: PropTypes.shape({
        name: PropTypes.string.isRequired,
      }),
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  private getGoogleJobSearchUrl(): string {
    const {targetJob: {name: jobName} = {name: ''}} = this.props.project
    const queryTerms = ["offres d'emploi"]
    if (jobName) {
      queryTerms.push(jobName)
    }
    const query = queryTerms.join(' ')
    return `https://www.google.fr/search?q=${encodeURIComponent(query)}&ibp=htl;jobs&sa=X`
  }

  public render(): React.ReactNode {
    const {jobBoards = []} = this.props.adviceData
    const {handleExplore, userYou} = this.props
    if (!jobBoards.length) {
      return <CircularProgress style={{margin: 'auto'}} />
    }
    const numSpecializedJobBoards =
      jobBoards.filter(({filters}): boolean => filters && !!filters.length).length
    const hasOnlySpecialized = numSpecializedJobBoards === jobBoards.length
    const maybeS = (count): string => count > 1 ? 's' : ''
    const specialized = ` spécialisé${maybeS(numSpecializedJobBoards)}`
    const title = <React.Fragment>
      <GrowingNumber number={jobBoards.length} isSteady={true} />
      {' '}site{maybeS(jobBoards.length)}
      {hasOnlySpecialized ? specialized : null}{userYou(' pour toi', ' pour vous')}
      {(numSpecializedJobBoards > 0 && !hasOnlySpecialized) ? <span>
        {' '}dont <GrowingNumber
          style={{fontWeight: 'bold'}} number={numSpecializedJobBoards} isSteady={true} />
        {specialized}</span> : null}
    </React.Fragment>
    const footer = <React.Fragment>
      Trouve{userYou('', 'z')} d'autres offres directement
      sur <ExternalLink
        style={{color: colors.BOB_BLUE, textDecoration: 'none'}}
        onClick={handleExplore('google job search')}
        href={this.getGoogleJobSearchUrl()}>
        Google
      </ExternalLink>
    </React.Fragment>
    return <MethodSuggestionList title={title} footer={footer}>
      {jobBoards.map(({filters, link: href, title}, index): ReactStylableElement =>
        <JobBoardLink
          key={`job-board-${index}`} {...{filters, href, userYou}}
          onClick={handleExplore('jobboard')}>
          {title}
        </JobBoardLink>)}
    </MethodSuggestionList>
  }
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<{}, bayes.bob.JobBoards, CardProps>()(
    ExpandedAdviceCardContentBase)


interface LinkProps {
  children: React.ReactNode
  filters?: string[]
  href: string
  onClick: () => void
  style?: React.CSSProperties
  userYou: YouChooser
}


const RadiumExternalLink = Radium(ExternalLink)


class JobBoardLink extends React.PureComponent<LinkProps> {
  public static propTypes = {
    children: PropTypes.node,
    filters: PropTypes.array,
    href: PropTypes.string.isRequired,
    onClick: PropTypes.func,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  private getTags(): {color: string; value: string}[] {
    const {filters, href, userYou} = this.props
    const tags: {color: string; value: string}[] = []
    if (/\.pole-emploi\.fr/.test(href)) {
      tags.push({
        color: colors.SQUASH,
        value: 'officiel',
      })
    }
    if ((filters || []).some((f): boolean => f.startsWith('for-job-group'))) {
      tags.push({
        color: colors.GREENISH_TEAL,
        value: userYou('spécialisé pour ton métier', 'spécialisé pour votre métier'),
      })
    }
    if ((filters || []).some((f): boolean => f.startsWith('for-departement'))) {
      tags.push({
        color: colors.BOB_BLUE,
        value: userYou('spécialisé pour ta région', 'spécialisé pour votre région'),
      })
    }
    return tags
  }

  public render(): React.ReactNode {
    const {children, href, onClick, style} = this.props
    const containerStyle = {
      color: 'inherit',
      display: 'block',
      textDecoration: 'none',
      ...style,
    }
    return <RadiumExternalLink href={href} style={containerStyle} onClick={onClick}>
      {children}
      {this.getTags().map(({color, value}): React.ReactNode => <Tag
        key={`tag-${value}`} style={{backgroundColor: color, marginLeft: 15}}>
        {value}
      </Tag>)}
      <div style={{flex: 1}} />
      <ChevronRightIcon style={{fill: colors.CHARCOAL_GREY, height: 20, width: 20}} />
    </RadiumExternalLink>
  }
}


const TakeAway = makeTakeAwayFromAdviceData(
  ({jobBoards}: bayes.bob.JobBoards): bayes.bob.JobBoard[] => jobBoards, 'site')


export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
