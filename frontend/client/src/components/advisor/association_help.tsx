import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import {YouChooser} from 'store/french'

import {CircularProgress, ExternalLink, GrowingNumber, Tag} from 'components/theme'
import Picto from 'images/advices/picto-association-help.svg'

import {MethodSuggestionList, CardProps, useAdviceData} from './base'


function isValidAssociation(a: bayes.bob.Association): a is bayes.bob.Association & {link: string} {
  return !!(a && a.link)
}


const ExpandedAdviceCardContentBase: React.FC<CardProps> = (props: CardProps) => {
  const {handleExplore, userYou} = props
  const {associations = []} = useAdviceData<bayes.bob.Associations>(props)
  const validAssociations = associations.filter(isValidAssociation)
  if (!validAssociations.length) {
    return <CircularProgress style={{margin: 'auto'}} />
  }
  const numSpecializedAssociations =
    validAssociations.filter(({filters}): boolean => !!filters && filters.length > 1).length
  const maybeS = (count: number): string => count > 1 ? 's' : ''
  const hasOnlySpecialized = numSpecializedAssociations === validAssociations.length
  const specialized = ` spécialisée${maybeS(numSpecializedAssociations)}`
  const title = <React.Fragment>
    <GrowingNumber
      style={{fontWeight: 'bold'}} number={validAssociations.length} isSteady={true} />
    {' '}association{maybeS(validAssociations.length)}
    {hasOnlySpecialized ? specialized : null} pour {userYou('toi', 'vous')}
    {(numSpecializedAssociations > 0 && !hasOnlySpecialized) ? <span>
      {' '}dont <GrowingNumber
        style={{fontWeight: 'bold'}} number={numSpecializedAssociations} isSteady={true} />
      {specialized}
    </span> : null}
  </React.Fragment>
  const linkStyle = {
    color: colors.BOB_BLUE,
    textDecoration: 'none',
  }
  const footer = <React.Fragment>
    Trouve{userYou('', 'z')} un accompagnement qui répond à {userYou('tes', 'vos')} attentes
    précises sur <ExternalLink href="http://www.aidesalemploi.fr" style={linkStyle}>
      aidesalemploi.fr
    </ExternalLink>
  </React.Fragment>
  return <MethodSuggestionList title={title} footer={footer}>
    {validAssociations.map(({filters, link, name}, index): React.ReactElement<AssociationProps> =>
      <AssociationLink
        key={`association-${index}`} href={link} onClick={handleExplore('association')}
        {...{filters, userYou}}>
        {name}
      </AssociationLink>)}
  </MethodSuggestionList>
}
ExpandedAdviceCardContentBase.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  userYou: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(ExpandedAdviceCardContentBase)


interface AssociationProps {
  children: React.ReactNode
  filters?: readonly string[]
  href: string
  onClick?: () => void
  style?: RadiumCSSProperties
  userYou: YouChooser
}

class AssociationLinkBase extends React.Component<AssociationProps> {
  public static propTypes = {
    children: PropTypes.node,
    filters: PropTypes.array,
    href: PropTypes.string.isRequired,
    onClick: PropTypes.func,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  private handleClick = (): void => {
    const {href, onClick} = this.props
    window.open(href, '_blank')
    onClick && onClick()
  }

  private getTags(): readonly {color: string; value: string}[] {
    const {filters, href, userYou} = this.props
    const tags: {color: string; value: string}[] = []
    if (/\.pole-emploi\.fr/.test(href)) {
      tags.push({
        color: colors.SQUASH,
        value: 'officielle',
      })
    }
    if ((filters || []).some((f): boolean => f.startsWith('for-job-group'))) {
      tags.push({
        color: colors.RED_PINK,
        value: userYou('pour ton métier', 'pour votre métier'),
      })
    }
    if ((filters || []).some((f): boolean => f.startsWith('for-departement'))) {
      tags.push({
        color: colors.BOB_BLUE,
        value: userYou('pour ta région', 'pour votre région'),
      })
    }
    if ((filters || []).some((f): boolean => f === 'for-women')) {
      tags.push({
        color: colors.GREENISH_TEAL,
        value: 'pour les femmes',
      })
    }
    const forOldFilter = (filters || []).find((f): boolean => /^for-old\(\d+\)$/.test(f))
    if (forOldFilter) {
      const age = forOldFilter.replace(/^for-old\((\d+)\)$/, '$1')
      tags.push({
        color: colors.GREENISH_TEAL,
        value: `pour les plus de ${age} ans`,
      })
    }
    return tags
  }

  public render(): React.ReactNode {
    const {children, style} = this.props
    return <div style={style} onClick={this.handleClick}>
      {children}
      {this.getTags().map(({color, value}): React.ReactNode => <Tag
        key={`tag-${value}`} style={{backgroundColor: color, marginLeft: 15}}>
        {value}
      </Tag>)}
      <div style={{flex: 1}} />
      <ChevronRightIcon style={{fill: colors.CHARCOAL_GREY, height: 24, width: 20}} />
    </div>
  }
}
const AssociationLink: React.ComponentClass<AssociationProps> = Radium(AssociationLinkBase)


export default {ExpandedAdviceCardContent, Picto}
