import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import {YouChooser, genderize, getDateString, inCityPrefix} from 'store/french'

import {ExternalLink, GrowingNumber, StringJoiner} from 'components/theme'
import NewPicto from 'images/advices/picto-online-salons.svg'
import poleEmploiLogo from 'images/ple-emploi-ico.png'

import {CardProps, CardWithContentProps, ExpandableAction, MethodSuggestionList,
  connectExpandedCardWithContent, makeTakeAwayFromAdviceData} from './base'


const daysBetween = (date1: Date, date2: Date): number =>
  (date2.getTime() - date1.getTime()) / 86400000


interface LocationProps {
  departementId?: string
  name: string
  prefix: string
}


class Location extends React.PureComponent<LocationProps> {
  public static propTypes = {
    departementId: PropTypes.string,
    name: PropTypes.string.isRequired,
    prefix: PropTypes.string.isRequired,
  }

  public render(): React.ReactNode {
    const {departementId, name, prefix} = this.props
    return <React.Fragment key="location">
      {prefix}<strong>{name}</strong>{departementId ? ` (${departementId})` : ''}
    </React.Fragment>
  }
}


type HTMLAnchorElementProps = React.HTMLProps<HTMLAnchorElement>


interface NewWindowLinkProps
  extends Pick<HTMLAnchorElementProps, Exclude<keyof HTMLAnchorElementProps, 'ref'>> {
  isStandardStyle?: boolean
}


// TODO(cyrille): See if it's relevant to keep this one now we use ExternalLink.
class NewWindowLinkBase extends React.PureComponent<NewWindowLinkProps> {
  public static propTypes = {
    isStandardStyle: PropTypes.bool,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {isStandardStyle, style, ...otherProps} = this.props
    const linkStyle = {
      color: 'inherit',
      textDecoration: 'initial',
      ...style,
    }
    return <ExternalLink style={isStandardStyle ? style : linkStyle} {...otherProps} />
  }
}
const NewWindowLink = Radium(NewWindowLinkBase)


class ExpandedAdviceCardContentBase
  extends React.PureComponent<CardWithContentProps<bayes.bob.OnlineSalons>> {
  public static propTypes = {
    adviceData: PropTypes.shape({
      salons: PropTypes.arrayOf(PropTypes.object.isRequired),
    }).isRequired,
    handleExplore: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      gender: PropTypes.oneOf(['FEMININE', 'MASCULINE']),
    }).isRequired,
    project: PropTypes.shape({
      city: PropTypes.shape({
        cityId: PropTypes.string,
        regionId: PropTypes.string,
      }),
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  // TODO(cyrille): Remove reference to Pôle emploi if we ever find other salons.
  public render(): React.ReactNode {
    const {
      adviceData: {salons = []},
      handleExplore,
      profile: {gender},
      project: {city: {cityId: userCityId = '', regionId: userRegionId = ''} = {}},
      userYou,
    } = this.props

    if (!salons.length) {
      return null
    }
    const genderE = genderize('·e', 'e', '', gender)
    const maybeS = salons.length > 1 ? 's' : ''
    const title = <React.Fragment>
      <GrowingNumber number={salons.length} /> salon{maybeS} en ligne où candidater
    </React.Fragment>
    const subtitle = `
      ${userYou('Tu peux', 'Vous pouvez')} être mis${genderE} directement en relation avec des
      entreprises qui recrutent et passer des entretiens sans avoir à sortir de
      chez ${userYou('toi', 'vous')}.
    `
    const footer = <React.Fragment>
      <img src={poleEmploiLogo} style={{height: 40, marginLeft: 20}} alt="" />
      Voir tous les salons sur <ExternalLink
        href="https://salonenligne.pole-emploi.fr/candidat/voirtouslessalons"
        style={{color: colors.BOB_BLUE, textDecoration: 'none'}}>
        le site de pôle emploi
      </ExternalLink>
    </React.Fragment>

    return <MethodSuggestionList title={title} subtitle={subtitle} footer={footer}>
      {salons.map((salon, index): React.ReactElement<SalonProps> => <Salon
        {...salon} key={`salon-${index}`}
        {...{handleExplore, userCityId, userRegionId, userYou}} />)}
    </MethodSuggestionList>
  }

}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<{}, bayes.bob.OnlineSalons, CardProps>()(
    ExpandedAdviceCardContentBase)


interface SalonProps extends bayes.bob.OnlineSalon {
  handleExplore: (visualElement: string) => (() => void)
  style?: React.CSSProperties
  userCityId: string
  userRegionId: string
  userYou: YouChooser
}


interface Interest {
  color?: string
  personal?: true
  value: string
}


type GetTagProps<T> = T extends React.ComponentType<{tag?: infer TP}> ? TP : never

class SalonBase extends React.PureComponent<SalonProps> {
  public static propTypes = {
    applicationEndDate: PropTypes.string,
    applicationStartDate: PropTypes.string,
    domain: PropTypes.string,
    handleExplore: PropTypes.func,
    jobGroupIds: PropTypes.arrayOf(PropTypes.string.isRequired),
    locations: PropTypes.arrayOf(PropTypes.shape({
      areaType: PropTypes.string,
      city: PropTypes.shape({
        cityId: PropTypes.string.isRequired,
        departementId: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
      }),
    }).isRequired),
    offerCount: PropTypes.number,
    startDate: PropTypes.string,
    style: PropTypes.object,
    title: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
    userCityId: PropTypes.string,
    userRegionId: PropTypes.string,
    userYou: PropTypes.func.isRequired,
  }

  // TODO(cyrille): Choose which location to show if several.
  private renderLocation(): React.ReactNode {
    const {locations: [{areaType = undefined, city = {}}] = [{}]} = this.props
    if (areaType === 'REGION') {
      const {regionName: name = '', regionPrefix: prefix = ''} = city
      return <Location key="location" {...{name, prefix}} />
    }
    if (areaType === 'DEPARTEMENT') {
      const {departementId = '', departementName: name = '', departementPrefix: prefix = ''} = city
      return <Location key="location" {...{departementId, name, prefix}} />
    }
    if (areaType === 'CITY') {
      const {departementId = '', name: cityName = ''} = city
      const {cityName: name, prefix} = inCityPrefix(cityName)
      return <Location key="location" {...{departementId, name, prefix}} />
    }
    return null
  }

  private getInterests(): Interest[] {
    const interests: Interest[] = []
    const {
      jobGroupIds = [],
      locations = [],
      offerCount = 0,
      userRegionId,
      userYou,
    } = this.props
    if (offerCount > 20) {
      interests.push({
        color: colors.BOB_BLUE,
        value: "il y a beaucoup d'offres",
      })
    }
    if (locations.some(({city: {regionId = ''} = {}}): boolean => regionId === userRegionId)) {
      interests.push({
        personal: true,
        value: `il propose des postes dans ${userYou('ta', 'votre')} région`,
      })
    }
    // If job groups are given, it means the user's is one of them.
    if (jobGroupIds.length) {
      interests.push({
        personal: true,
        value: `il propose des postes dans ${userYou('ton', 'votre')} domaine`,
      })
    }
    return interests
  }

  private makeTimeTagProps(): GetTagProps<typeof ExpandableAction> {
    const {applicationEndDate, startDate} = this.props
    const now = new Date()
    if (daysBetween(now, new Date(applicationEndDate)) < 15) {
      return {color: colors.SQUASH, value: 'Ferme bientôt'}
    }
    if (now > new Date(startDate)) {
      return {color: colors.GREENISH_TEAL, value: 'En ce moment'}
    }
    return null
  }

  private renderInterests(): React.ReactNode {
    const interests = this.getInterests()
    if (!interests.length) {
      return null
    }
    const {userYou} = this.props
    return <div>
      Ce salon pourrait {userYou("t'", 'vous ')}intéresser parce que&nbsp;:
      <ul>{interests.map(({value}): React.ReactNode => <li key={value}>{value}</li>)}
      </ul>
    </div>
  }

  public render(): React.ReactNode {
    const {
      applicationEndDate,
      applicationStartDate,
      domain,
      handleExplore,
      locations: [{areaType = undefined, city: {cityId = '', name: cityName = ''} = {}}] = [{}],
      style,
      title,
      url,
      userCityId,
      userYou,
    } = this.props
    const startDate = new Date(applicationStartDate)
    const endDate = new Date(applicationEndDate)
    endDate.setDate(endDate.getDate() - 1)
    const moreInfos = []
    if (domain) {
      moreInfos.push(<React.Fragment key="domain">{domain}</React.Fragment>)
    }
    if (cityId) {
      const location = this.renderLocation()
      if (location) {
        moreInfos.push(location)
      }
    }
    const interests = this.getInterests()
    return <ExpandableAction
      whyForYou={interests.some(({personal}): boolean => personal) ? 'personnel' : ''}
      tag={this.makeTimeTagProps()} isMethodSuggestion={true} {...{style, title, userYou}}
      onContentShown={handleExplore('salon info')}>
      <div>
        {this.renderInterests()}
        <div>
          Candidatures du {getDateString(startDate)} au {getDateString(endDate)}
          {moreInfos.length ? <React.Fragment><br />
            <StringJoiner separator=" - " lastSeparator=" - ">{moreInfos}</StringJoiner>
          </React.Fragment> : null}
        </div>
        <div style={{display: 'flex', fontWeight: 'bold', margin: '12px 0'}}>
          <NewWindowLink href={url} isStandardStyle={true} onClick={handleExplore('salon')}>
            En savoir plus sur le salon
          </NewWindowLink>
          {(cityId && cityId !== userCityId && areaType === 'CITY') ?
            <NewWindowLink
              href={`/api/redirect/eterritoire/${cityId}`} isStandardStyle={true}
              onClick={handleExplore('city')}
              style={{marginLeft: 10}}>
              Découvrir {cityName}
            </NewWindowLink> : null}
        </div>
      </div>
    </ExpandableAction>
  }
}
const Salon = Radium(SalonBase)


const TakeAway = makeTakeAwayFromAdviceData(
  ({salons}: bayes.bob.OnlineSalons): readonly bayes.bob.OnlineSalon[] => salons, 'salon')


export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
