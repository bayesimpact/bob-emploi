import type {TFunction} from 'i18next'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import React, {useMemo} from 'react'

import type {LocalizableString} from 'store/i18n'
import {combineTOptions, prepareT} from 'store/i18n'

import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import {RadiumExternalLink} from 'components/radium'
import Tag from 'components/tag'
import {AssociationHelpContent, Footer} from 'deployment/association_help'
import useMedia from 'hooks/media'

import type {ConfigColor} from 'config'

import type {CardProps} from './base'
import {MethodSuggestionList, useAdviceData} from './base'

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
  if (loading) {
    return loading
  }
  if (!validAssociations.length) {
    <AssociationHelpContent handleExplore={handleExplore} t={t} />
  }
  return <MethodSuggestionList title={title} footer={<Footer t={t} />}>
    {validAssociations.map(({filters, link, name}, index): React.ReactElement<AssociationProps> =>
      <AssociationLink
        key={`association-${index}`} href={link} onClick={handleExplore('association')}
        {...{filters, t}}>
        {name}
      </AssociationLink>)}
  </MethodSuggestionList>
}
const ExpandedAdviceCardContent = React.memo(AssociationHelp)


interface TagDefinition {
  color: ConfigColor
  filters?: RegExp
  shouldReplace?: string
  href?: RegExp
  value: LocalizableString
}

const TAGS: readonly TagDefinition[] = [
  {
    color: colors.SQUASH,
    href: /(\.pole-emploi\.fr|\.gouv\.fr)($|\/)/,
    value: prepareT('officielle'),
  },
  {
    color: colors.RED_PINK,
    filters: /^for-job-group/,
    value: prepareT('pour votre métier'),
  },
  {
    color: colors.BOB_BLUE,
    filters: /^for-departement/,
    value: prepareT('pour votre région'),
  },
  {
    color: colors.GREENISH_TEAL,
    filters: /^for-women$/,
    value: prepareT('pour les femmes'),
  },
  {
    color: colors.GREENISH_TEAL,
    filters: /^for-old\((\d+)\)$/,
    shouldReplace: 'age',
    value: prepareT('pour les plus de {{age}} ans'),
  },
  {
    color: colors.BOB_BLUE,
    filters: /^for-handicaped$/,
    value: prepareT('recommandée par Hanploi'),
  },
] as const


interface AssociationProps {
  children: React.ReactNode
  filters?: readonly string[]
  href: string
  onClick?: () => void
  style?: RadiumCSSProperties
  t: TFunction
}

const linkStyle = {
  minHeight: 'inherit',
  padding: '10px 0 0',
}
const noLinkStyle = {
  color: 'inherit',
  textDecoration: 'none',
}

const AssociationLinkBase = (props: AssociationProps): React.ReactElement => {
  const {children, filters = emptyArray, href, onClick, style, t: translate} = props
  const isForPrint = useMedia() === 'print'

  const containerStyle = useMemo((): React.CSSProperties => ({
    ...noLinkStyle,
    ...style,
  }), [style])

  // TODO(cyrille): DRY up with job_boards.
  const tags = useMemo((): readonly {color: string; value: string}[] => {
    return TAGS.flatMap((tagDef): readonly {color: string; value: string}[] => {
      const {color, filters: filtersPattern, href: hrefPattern, shouldReplace, value} = tagDef
      if (hrefPattern?.test(href)) {
        return [{color, value: translate(...value)}]
      }
      if (filtersPattern) {
        const match = filters.find((f) => filtersPattern.test(f))
        if (match) {
          if (shouldReplace) {
            return [{
              color,
              value: translate(...combineTOptions(
                value, {[shouldReplace]: match.replace(filtersPattern, '$1')},
              )),
            }]
          }
          return [{color, value: translate(...value)}]
        }
      }
      return []
    })
  }, [filters, href, translate])

  return <RadiumExternalLink style={containerStyle} onClick={onClick} href={href}>
    <span>
      {children}
      {isForPrint ? <span style={linkStyle}>{href}</span> : null}
    </span>
    {tags.map(({color, value}): React.ReactNode => <Tag
      key={`tag-${value}`} style={{backgroundColor: color, marginLeft: 15}}>
      {value}
    </Tag>)}
    <span style={{flex: 1}} />
    {isForPrint ? null :
      <ChevronRightIcon style={{fill: colors.CHARCOAL_GREY, height: 24, width: 20}} />}
  </RadiumExternalLink>
}
const AssociationLink = React.memo(AssociationLinkBase)



export default {ExpandedAdviceCardContent, pictoName: 'handshake' as const}
