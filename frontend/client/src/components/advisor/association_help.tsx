import {TFunction} from 'i18next'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import React, {useCallback, useMemo} from 'react'

import ExternalLink from 'components/external_link'
import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import {RadiumDiv} from 'components/radium'
import Tag from 'components/tag'
import useMedia from 'hooks/media'
import Picto from 'images/advices/picto-association-help.svg'

import {MethodSuggestionList, CardProps, useAdviceData} from './base'

function isValidAssociation(a: bayes.bob.Association): a is bayes.bob.Association & {link: string} {
  return !!(a.link)
}

const emptyArray = [] as const


const AssociationHelp: React.FC<CardProps> = (props: CardProps) => {
  const {handleExplore, t} = props
  const {data: {associations = []}, loading} = useAdviceData<bayes.bob.Associations>(props)
  const validAssociations = associations.filter(isValidAssociation)
  // TODO(cyrille): Investigate why 1 filter is not considered specialized.
  const numSpecializedAssociations =
    validAssociations.filter(({filters}): boolean => !!filters && filters.length > 1).length
  const hasOnlySpecialized = numSpecializedAssociations === validAssociations.length
  // i18next-extract-mark-plural-next-line disable
  const specialized = t(' spécialisée', {count: numSpecializedAssociations})
  const forYou = t('pour vous')
  const title = numSpecializedAssociations > 0 && !hasOnlySpecialized ?
    <Trans parent={null} t={t} count={validAssociations.length}>
      <GrowingNumber
        style={{fontWeight: 'bold'}} number={validAssociations.length} isSteady={true} />
      {' '}association {{forYou}} dont <GrowingNumber
        style={{fontWeight: 'bold'}} number={numSpecializedAssociations} isSteady={true} />
      {{specialized}}
    </Trans> : <Trans parent={null} t={t} count={validAssociations.length}>
      <GrowingNumber
        style={{fontWeight: 'bold'}} number={validAssociations.length} isSteady={true} />
      {' '}association{{specialized: hasOnlySpecialized ? specialized : null}} {{forYou}}
    </Trans>
  const linkStyle = {
    color: colors.BOB_BLUE,
    textDecoration: 'none',
  }
  const footer = config.methodAssociationHelpFooterUrl ? <Trans parent={null} t={t}>
    Trouvez un accompagnement qui répond à vos attentes précises
    sur <ExternalLink href={config.methodAssociationHelpFooterUrl} style={linkStyle}>
      {{footerLink: config.methodAssociationHelpFooterLink || ''}}
    </ExternalLink>
  </Trans> : undefined
  if (loading) {
    return loading
  }
  return <MethodSuggestionList title={title} footer={footer}>
    {validAssociations.map(({filters, link, name}, index): React.ReactElement<AssociationProps> =>
      <AssociationLink
        key={`association-${index}`} href={link} onClick={handleExplore('association')}
        {...{filters, t}}>
        {name}
      </AssociationLink>)}
  </MethodSuggestionList>
}
AssociationHelp.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(AssociationHelp)


interface AssociationProps {
  children: React.ReactNode
  filters?: readonly string[]
  href: string
  onClick?: () => void
  style?: RadiumCSSProperties
  t: TFunction
}

const AssociationLinkBase = (props: AssociationProps): React.ReactElement => {
  const {children, filters = emptyArray, href, onClick, style, t} = props
  const isForPrint = useMedia() === 'print'
  const linkStyle = {
    ...style,
    minHeight: 'inherit',
    padding: '10px 0 0',
  }
  const handleClick = useCallback((): void => {
    window.open(href, '_blank')
    onClick?.()
  }, [href, onClick])

  // TODO(cyrille): DRY up with job_boards.
  const tags = useMemo((): readonly {color: string; value: string}[] => {
    // TODO(cyrille): Replace with flatMap or equivalent.
    const tags: {color: string; value: string}[] = []
    if (/\.pole-emploi\.fr/.test(href) || /\.gouv\.fr($|\/)/.test(href)) {
      tags.push({
        color: colors.SQUASH,
        value: t('officielle'),
      })
    }
    if (filters.some((f): boolean => f.startsWith('for-job-group'))) {
      tags.push({
        color: colors.RED_PINK,
        value: t('pour votre métier'),
      })
    }
    if (filters.some((f): boolean => f.startsWith('for-departement'))) {
      tags.push({
        color: colors.BOB_BLUE,
        value: t('pour votre région'),
      })
    }
    if (filters.includes('for-women')) {
      tags.push({
        color: colors.GREENISH_TEAL,
        value: t('pour les femmes'),
      })
    }
    const forOldFilter = filters.find((f): boolean => /^for-old\(\d+\)$/.test(f))
    if (forOldFilter) {
      const age = forOldFilter.replace(/^for-old\((\d+)\)$/, '$1')
      tags.push({
        color: colors.GREENISH_TEAL,
        value: t('pour les plus de {{age}} ans', {age}),
      })
    }
    if (filters.includes('for-handicaped')) {
      tags.push({
        color: colors.BOB_BLUE,
        value: t('recommandée par Hanploi'),
      })
    }
    return tags
  }, [filters, href, t])

  return <div>
    <RadiumDiv style={style} onClick={handleClick}>
      <div>
        {children}
        {isForPrint ? <div style={linkStyle}>{href}</div> : null}
      </div>
      {tags.map(({color, value}): React.ReactNode => <Tag
        key={`tag-${value}`} style={{backgroundColor: color, marginLeft: 15}}>
        {value}
      </Tag>)}
      <div style={{flex: 1}} />
      {isForPrint ? null :
        <ChevronRightIcon style={{fill: colors.CHARCOAL_GREY, height: 24, width: 20}} />}
    </RadiumDiv>
  </div>
}
AssociationLinkBase.propTypes = {
  children: PropTypes.node,
  filters: PropTypes.array,
  href: PropTypes.string.isRequired,
  onClick: PropTypes.func,
  style: PropTypes.object,
  t: PropTypes.func.isRequired,
}
const AssociationLink = React.memo(AssociationLinkBase)



export default {ExpandedAdviceCardContent, Picto}
