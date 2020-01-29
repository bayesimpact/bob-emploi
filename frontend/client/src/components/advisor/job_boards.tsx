import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import React, {useMemo} from 'react'

import {Trans} from 'components/i18n'
import {RadiumExternalLink} from 'components/radium'
import {ExternalLink, GrowingNumber, Tag} from 'components/theme'
import Picto from 'images/advices/picto-find-a-jobboard.svg'

import {CardProps, CardWithContentProps, MethodSuggestionList,
  connectExpandedCardWithContent} from './base'


const JobBoardsMethod: React.FC<CardWithContentProps<bayes.bob.JobBoards>> =
(props: CardWithContentProps<bayes.bob.JobBoards>): React.ReactElement => {
  const {targetJob: {name: jobName} = {name: ''}} = props.project
  const {jobBoards = []} = props.adviceData
  const {handleExplore, t} = props

  const googleJobSearchUrl = useMemo((): string => {
    const queryTerms = ["offres d'emploi"]
    if (jobName) {
      queryTerms.push(jobName)
    }
    const query = queryTerms.join(' ')
    return `https://www.google.fr/search?q=${encodeURIComponent(query)}&ibp=htl;jobs&sa=X`
  }, [jobName])

  const numSpecializedJobBoards =
    jobBoards.filter(({filters}): boolean => !!(filters && filters.length)).length
  const hasOnlySpecialized = numSpecializedJobBoards === jobBoards.length
  // i18next-extract-mark-plural-next-line disable
  const specialized = t(' spécialisé', {count: numSpecializedJobBoards})
  const forYou = t('pour vous')
  const title = (numSpecializedJobBoards > 0 && !hasOnlySpecialized) ?
    <Trans parent={null} t={t} count={jobBoards.length}>
      <GrowingNumber number={jobBoards.length} isSteady={true} /> site {{forYou}} dont{' '}
      <GrowingNumber
        style={{fontWeight: 'bold'}} number={numSpecializedJobBoards} isSteady={true} />
      {{specialized}}
    </Trans> :
    <Trans parent={null} t={t}>
      <GrowingNumber number={jobBoards.length} isSteady={true} /> site
      {{specialized: hasOnlySpecialized ? specialized : null}} {{forYou}}
    </Trans>
  const footer = <Trans parent={null} t={t}>
    Trouvez d'autres offres directement
    sur <ExternalLink
      style={{color: colors.BOB_BLUE, textDecoration: 'none'}}
      onClick={handleExplore('google job search')}
      href={googleJobSearchUrl}>
      Google
    </ExternalLink>
  </Trans>
  return <MethodSuggestionList title={title} footer={footer}>
    {jobBoards.map(({filters, link: href, title}, index): ReactStylableElement|null =>
      href ? <JobBoardLink
        key={`job-board-${index}`} {...{filters, href, t}}
        onClick={handleExplore('jobboard')}>
        {title}
      </JobBoardLink> : null)}
  </MethodSuggestionList>
}
JobBoardsMethod.propTypes = {
  adviceData: PropTypes.shape({
    jobBoards: PropTypes.arrayOf(PropTypes.object.isRequired),
  }).isRequired,
  handleExplore: PropTypes.func.isRequired,
  project: PropTypes.shape({
    targetJob: PropTypes.shape({
      name: PropTypes.string.isRequired,
    }),
  }).isRequired,
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<bayes.bob.JobBoards, CardProps>(React.memo(JobBoardsMethod))


interface LinkProps {
  children: React.ReactNode
  filters?: readonly string[]
  href: string
  onClick: () => void
  style?: React.CSSProperties
  t: CardProps['t']
}


const JobBoardLinkBase: React.FC<LinkProps> = (props: LinkProps): React.ReactElement => {
  const {children, filters, href, onClick, style, t} = props
  const tags = useMemo((): {color: string; value: string}[] => {
    const tags: {color: string; value: string}[] = []
    if (/\.pole-emploi\.fr/.test(href)) {
      tags.push({
        color: colors.SQUASH,
        value: t('officiel'),
      })
    }
    if ((filters || []).some((f): boolean => f.startsWith('for-job-group'))) {
      tags.push({
        color: colors.GREENISH_TEAL,
        value: t('spécialisé pour votre métier'),
      })
    }
    if ((filters || []).some((f): boolean => f.startsWith('for-departement'))) {
      tags.push({
        color: colors.BOB_BLUE,
        value: t('spécialisé pour votre région'),
      })
    }
    return tags
  }, [filters, href, t])

  const containerStyle = useMemo((): React.CSSProperties => ({
    color: 'inherit',
    display: 'block',
    textDecoration: 'none',
    ...style,
  }), [style])
  return <RadiumExternalLink href={href} style={containerStyle} onClick={onClick}>
    {children}
    {tags.map(({color, value}): React.ReactNode => <Tag
      key={`tag-${value}`} style={{backgroundColor: color, marginLeft: 15}}>
      {value}
    </Tag>)}
    <div style={{flex: 1}} />
    <ChevronRightIcon style={{fill: colors.CHARCOAL_GREY, height: 20, width: 20}} />
  </RadiumExternalLink>
}
JobBoardLinkBase.propTypes = {
  children: PropTypes.node,
  filters: PropTypes.array,
  href: PropTypes.string.isRequired,
  onClick: PropTypes.func,
  style: PropTypes.object,
}
const JobBoardLink = React.memo(JobBoardLinkBase)



export default {ExpandedAdviceCardContent, Picto}
