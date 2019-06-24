import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import {YouChooser} from 'store/french'

import {CircularProgress, ExternalLink, GrowingNumber, Tag} from 'components/theme'
import NewPicto from 'images/advices/picto-association-help.svg'

import {MethodSuggestionList, CardWithContentProps, CardProps, connectExpandedCardWithContent,
  makeTakeAwayFromAdviceData} from './base'


class ExpandedAdviceCardContentBase extends
  React.Component<CardWithContentProps<bayes.bob.Associations>> {
  public static propTypes = {
    adviceData: PropTypes.shape({
      associations: PropTypes.arrayOf(PropTypes.object.isRequired),
    }).isRequired,
    handleExplore: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {associations = []} = this.props.adviceData
    const {userYou} = this.props
    if (!associations.length) {
      return <CircularProgress style={{margin: 'auto'}} />
    }
    const numSpecializedAssociations =
      associations.filter(({filters}): boolean => filters && filters.length > 1).length
    const maybeS = (count: number): string => count > 1 ? 's' : ''
    const hasOnlySpecialized = numSpecializedAssociations === associations.length
    const specialized = ` spécialisée${maybeS(numSpecializedAssociations)}`
    const title = <React.Fragment>
      <GrowingNumber
        style={{fontWeight: 'bold'}} number={associations.length} isSteady={true} />
      {' '}association{maybeS(associations.length)}
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
      {associations.map(({filters, link, name}, index): React.ReactElement<AssociationProps> =>
        <AssociationLink
          key={`association-${index}`} href={link} onClick={this.props.handleExplore('association')}
          {...{filters, userYou}}>
          {name}
        </AssociationLink>)}
    </MethodSuggestionList>
  }
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<{}, bayes.bob.Associations, CardProps>()(
    ExpandedAdviceCardContentBase)


interface AssociationProps {
  children: React.ReactNode
  filters?: string[]
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

  private getTags(): {color: string; value: string}[] {
    const {filters, href, userYou} = this.props
    const tags = []
    if (/\.pole-emploi\.fr/.test(href)) {
      tags.push({
        color: colors.SQUASH,
        value: (): string => 'officielle',
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


const TakeAway = makeTakeAwayFromAdviceData(
  ({associations}: bayes.bob.Associations): bayes.bob.Association[] => associations,
  'association', true)


export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
