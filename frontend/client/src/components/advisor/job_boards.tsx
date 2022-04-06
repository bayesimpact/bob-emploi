import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import React, {useMemo} from 'react'

import {getGoogleJobSearchUrl} from 'store/job'

import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import {RadiumExternalLink} from 'components/radium'
import Tag from 'components/tag'
import Picto from 'images/advices/picto-find-a-jobboard.svg'

import type {CardProps} from './base'
import {MethodSuggestionList, useAdviceData} from './base'

const noMarginStyle: React.CSSProperties = {
  margin: 0,
}
const linkStyle: RadiumCSSProperties = {
  ':focus': {
    textDecoration: 'underline',
  },
  ':hover': {
    textDecoration: 'underline',
  },
  'color': colors.BOB_BLUE,
  'fontWeight': 'bold',
  'textDecoration': 'none',
}

const JobBoardsMethod: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {targetJob: {name: jobName} = {name: ''}} = props.project
  const {data: {jobBoards = []}, loading} = useAdviceData<bayes.bob.JobBoards>(props)
  const {handleExplore, t} = props

  const googleJobSearchUrl = useMemo(
    (): string => getGoogleJobSearchUrl(t, jobName), [jobName, t])

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
    <Trans parent={null} t={t} count={jobBoards.length}>
      <GrowingNumber number={jobBoards.length} isSteady={true} /> site
      {{specialized: hasOnlySpecialized ? specialized : null}} {{forYou}}
    </Trans>
  const footer = <Trans parent="p" style={noMarginStyle} t={t}>
    Trouvez d'autres offres directement
    sur <RadiumExternalLink
      style={linkStyle}
      onClick={handleExplore('google job search')}
      href={googleJobSearchUrl}>
      Google
    </RadiumExternalLink>
  </Trans>
  if (loading) {
    return loading
  }
  return <MethodSuggestionList title={title} footer={footer}>
    {jobBoards.map(({filters, link: href, title}, index): ReactStylableElement|null =>
      href ? <JobBoardLink
        key={`job-board-${index}`} {...{filters, href, t}}
        jobName={jobName}
        onClick={handleExplore('jobboard')}>
        {title}
      </JobBoardLink> : null)}
  </MethodSuggestionList>
}
const ExpandedAdviceCardContent = React.memo(JobBoardsMethod)


interface LinkProps {
  children: React.ReactNode
  filters?: readonly string[]
  href: string
  jobName?: string
  onClick: () => void
  style?: React.CSSProperties
  t: CardProps['t']
}


const JobBoardLinkBase: React.FC<LinkProps> = (props: LinkProps): React.ReactElement => {
  const {children, filters, href, jobName, onClick, style, t} = props
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
        value: jobName ? t('spécialisé pour votre métier') : t('spécialisé pour votre situation'),
      })
    }
    if ((filters || []).some((f): boolean => f.startsWith('for-departement'))) {
      tags.push({
        color: colors.BOB_BLUE,
        value: t('spécialisé pour votre région'),
      })
    }
    return tags
  }, [filters, href, jobName, t])

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
const JobBoardLink = React.memo(JobBoardLinkBase)



export default {ExpandedAdviceCardContent, Picto}
