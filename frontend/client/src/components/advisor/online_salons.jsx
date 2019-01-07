import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import {genderize, getDateString, inCityPrefix} from 'store/french'

import {ExternalLink, StringJoiner, Tag, UpDownIcon} from 'components/theme'
import Picto from 'images/advices/picto-online-salons.svg'
import poleEmploiLogo from 'images/ple-emploi-ico.png'

import {AdviceSuggestionList, connectExpandedCardWithContent} from './base'


const daysBetween = (date1, date2) => (date2.getTime() - date1.getTime()) / 86400000


class ColorTag extends React.Component {
  static propTypes = {
    color: PropTypes.string.isRequired,
    style: PropTypes.object,
  }

  render() {
    const {color, style, ...otherProps} = this.props
    return <Tag style={{backgroundColor: color, ...style}} {...otherProps} />
  }
}


class Location extends React.Component {
  static propTypes = {
    departementId: PropTypes.string,
    name: PropTypes.string.isRequired,
    prefix: PropTypes.string.isRequired,
  }

  render() {
    const {departementId, name, prefix} = this.props
    return <React.Fragment key="location">
      {prefix}<strong>{name}</strong>{departementId ? ` (${departementId})` : ''}
    </React.Fragment>
  }
}


// TODO(cyrille): See if it's relevant to keep this one now we use ExternalLink.
class NewWindowLinkBase extends React.Component {
  static propTypes = {
    isStandardStyle: PropTypes.bool,
    style: PropTypes.object,
  }

  render() {
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


class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    adviceData: PropTypes.shape({
      salons: PropTypes.arrayOf(PropTypes.object.isRequired),
    }).isRequired,
    gender: PropTypes.string,
    onExplore: PropTypes.func.isRequired,
    project: PropTypes.shape({
      city: PropTypes.shape({
        cityId: PropTypes.string,
        regionId: PropTypes.string,
      }),
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  // TODO(cyrille): Remove reference to Pôle emploi if we ever find other salons.
  render() {
    const {
      adviceData: {salons = []},
      gender,
      onExplore,
      project: {city: {cityId: userCityId, regionId: userRegionId} = {}},
      userYou,
    } = this.props

    if (!salons.length) {
      return null
    }
    const genderE = genderize('·e', 'e', '', gender)

    return <div>
      <div style={{fontSize: 14}}>
        Pôle emploi organise des salons en ligne, où {userYou('tu peux', 'vous pouvez')} être
        mis{genderE} directement en contact avec des entreprises qui recrutent et passer des
        entretiens sans avoir à sortir de chez {userYou('toi', 'vous')}. Pour chaque salon,
        {userYou(' tu peux', ' vous pouvez')} candidater sur les offres
        qui {userYou('te', 'vous')} correspondent, et {userYou('tu seras ', 'vous serez ')}
        contacté{genderE} pour un entretien avant la date de fin du salon.<br />
        Certains de ces salons en ligne pourraient {userYou("t'", 'vous ')}intéresser&nbsp;:
      </div>
      <AdviceSuggestionList style={{marginTop: 15}}>
        {salons.map((salon, index) => <Salon
          {...salon} key={`salon-${index}`} {...{onExplore, userCityId, userRegionId, userYou}} />).
          // TODO(pascal): Factorize with spontaneous.
          concat([<NewWindowLink
            key="see-more" href="https://salonenligne.pole-emploi.fr/candidat/voirtouslessalons">
            Voir tous les salons sur le site de pôle emploi
            <span style={{flex: 1}} onClick={() => onExplore('salons list')} />
            <img src={poleEmploiLogo} style={{height: 40, marginRight: 20}} alt="" />
            <ChevronRightIcon style={{fill: colors.CHARCOAL_GREY, flexShrink: 0}} />
          </NewWindowLink>])}
      </AdviceSuggestionList>
    </div>
  }

}
const ExpandedAdviceCardContent = connectExpandedCardWithContent(({user}) => ({
  featuresEnabled: user.featuresEnabled || {},
  gender: user.profile && user.profile.gender,
}))(ExpandedAdviceCardContentBase)


class SalonBase extends React.Component {
  static propTypes = {
    applicationEndDate: PropTypes.string,
    applicationStartDate: PropTypes.string,
    domain: PropTypes.string,
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
    onExplore: PropTypes.func,
    startDate: PropTypes.string,
    style: PropTypes.object,
    title: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
    userCityId: PropTypes.string,
    userRegionId: PropTypes.string,
    userYou: PropTypes.func.isRequired,
  }

  state = {
    isExpanded: false,
  }

  // TODO(cyrille): Choose which location to show if several.
  renderLocation() {
    const {locations: [{areaType, city}] = [{}]} = this.props
    if (areaType === 'REGION') {
      const {regionName: name, regionPrefix: prefix} = city
      return <Location key="location" {...{name, prefix}} />
    }
    if (areaType === 'DEPARTEMENT') {
      const {departementId, departementName: name, departementPrefix: prefix} = city
      return <Location key="location" {...{departementId, name, prefix}} />
    }
    if (areaType === 'CITY') {
      const {departementId, name: cityName} = city
      const {cityName: name, prefix} = inCityPrefix(cityName)
      return <Location key="location" {...{departementId, name, prefix}} />
    }
    return null
  }

  handleClick = () => {
    const {isExpanded} = this.state
    const {onExplore} = this.props
    this.setState({isExpanded: !isExpanded})
    if (!isExpanded) {
      onExplore('salon info')
    }
  }

  getInterests() {
    const interests = []
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
    if (locations.some(({city: {regionId} = {}}) => regionId === userRegionId)) {
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

  renderTimeTag() {
    const {applicationEndDate, startDate} = this.props
    const now = new Date()
    if (daysBetween(now, new Date(applicationEndDate)) < 15) {
      return <ColorTag style={{marginBottom: 10}} color={colors.SQUASH}>Ferme bientôt</ColorTag>
    }
    if (now > new Date(startDate)) {
      return <ColorTag
        style={{marginBottom: 10}} color={colors.GREENISH_TEAL}>En ce moment</ColorTag>
    }
    return null
  }

  renderInterests() {
    const interests = this.getInterests()
    if (!interests.length) {
      return null
    }
    const {userYou} = this.props
    return <div>
      Ce salon pourrait {userYou("t'", 'vous ')}intéresser parce que&nbsp;:
      <ul>{interests.map(({value}) => <li key={value}>{value}</li>)}
      </ul>
    </div>
  }

  render() {
    const {
      applicationEndDate,
      applicationStartDate,
      domain,
      locations: [{areaType, city: {cityId, name: cityName} = {}}] = [{}],
      onExplore,
      style,
      title,
      url,
      userCityId,
    } = this.props
    const startDate = new Date(applicationStartDate)
    const endDate = new Date(applicationEndDate)
    endDate.setDate(endDate.getDate() - 1)
    const {isExpanded} = this.state
    const containerStyle = {
      ...style,
      alignItems: 'stretch',
      flexDirection: 'column',
    }
    const titleStyle = {
      alignItems: 'center',
      display: 'flex',
      minHeight: 48,
    }
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
    const tag = interests.some(({personal}) => personal) ? <ColorTag
      color={colors.RED_PINK} style={{marginRight: 15}}>Recommandé</ColorTag> : null
    return <div style={containerStyle} onClick={this.handleClick}>
      <div style={titleStyle}>
        {title}
        <span style={{flex: 1}} />
        {tag}
        <UpDownIcon
          icon="chevron"
          isUp={isExpanded}
          style={{flexShrink: 0}}
        />
      </div>
      {isExpanded ? <div style={{fontWeight: 'normal'}}>
        {this.renderTimeTag()}
        {this.renderInterests()}
        <div>
          Candidatures du {getDateString(startDate)} au {getDateString(endDate)}
          {moreInfos.length ? <React.Fragment><br />
            <StringJoiner separator=" - " lastSeparator=" - ">{moreInfos}</StringJoiner>
          </React.Fragment> : null}
        </div>
        <div style={{display: 'flex', fontWeight: 'bold', margin: '12px 0'}}>
          <NewWindowLink href={url} isStandardStyle={true} onClick={() => onExplore('salon')}>
            En savoir plus sur le salon
          </NewWindowLink>
          {(cityId && cityId !== userCityId && areaType === 'CITY') ?
            <NewWindowLink
              href={`/api/redirect/eterritoire/${cityId}`} isStandardStyle={true}
              onClick={() => onExplore('city')}
              style={{marginLeft: 10}}>
              Découvrir {cityName}
            </NewWindowLink> : null}
        </div>
      </div> : null}
    </div>
  }
}
const Salon = Radium(SalonBase)


export default {ExpandedAdviceCardContent, Picto}
