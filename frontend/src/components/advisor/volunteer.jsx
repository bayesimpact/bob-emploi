import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import {connect} from 'react-redux'

import {getVolunteeringMissions} from 'store/actions'
import {ofCityPrefix} from 'store/french'

import logoTousBenevoles from 'images/logo-tous-benevoles.png'
import {AppearingList, Colors, Icon, Markdown, PaddedOnMobile, SmoothTransitions,
  StringJoiner, Styles, Tag} from 'components/theme'


class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
  }

  render() {
    const {advice, project} = this.props
    const {volunteerData} = advice
    const associationNames = volunteerData.associationNames || ['SNC', 'Missions Locales']
    const {cityName, prefix} = ofCityPrefix(project.mobility.city.name)
    return <div style={{fontSize: 30}}>
      Des associations près {prefix}<strong>{cityName}</strong> comme <StringJoiner>
        {associationNames.map((name, index) => <strong key={`association-${index}`}>
          {name}
        </strong>)}
      </StringJoiner> pourraient avoir besoin de vos compétences.
    </div>
  }
}


class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    missions: PropTypes.array.isRequired,
    project: PropTypes.object.isRequired,
  }

  componentWillMount() {
    const {dispatch, missions, project} = this.props
    if (!missions.length) {
      dispatch(getVolunteeringMissions(project))
    }
  }

  render() {
    const {project} = this.props
    const associationMap = {}
    const missions = this.props.missions.filter(({associationName}) => {
      if (associationMap[associationName]) {
        return false
      }
      associationMap[associationName] = true
      return true
    })
    const {cityName, prefix} = ofCityPrefix(project.mobility.city.name)
    return <div>
      {missions.length ? <PaddedOnMobile style={{marginBottom: 15}}>
        Nous avons trouvé <strong>
          {missions.length} association{missions.length > 1 ? 's' : ''}
        </strong> proposant du bénévolat près {prefix}<strong>{cityName}</strong>.
      </PaddedOnMobile> : null}

      <AppearingList>
        {[
          ...missions.map((mission, index) => <Mission
            {...mission} style={{marginTop: index ? -1 : 0}} key={`mission-${index}`} />),
          <MoreMissionsLink
            style={{marginTop: -1}} key="more" onClick={() => {
              window.open('http://www.tousbenevoles.org/', '_blank')
            }}>
            Trouver d'autres missions de bénévolat sur Tous Bénévoles
          </MoreMissionsLink>,
        ]}
      </AppearingList>
    </div>
  }
}
const ExpandedAdviceCardContent = connect(({app}, {project}) => ({
  missions: app.volunteeringMissions[project.projectId] || [],
}))(ExpandedAdviceCardContentBase)


class MissionBase extends React.Component {
  static propTypes = {
    associationName: PropTypes.node,
    description: PropTypes.node,
    isAvailableEverywhere: PropTypes.bool,
    link: PropTypes.string,
    style: PropTypes.object,
    title: PropTypes.string,
  }

  state = {
    isContentShown: false,
  }

  render() {
    const {associationName, description, isAvailableEverywhere, link, style, title} = this.props
    const {isContentShown} = this.state
    const containerStyle = {
      ':hover': {
        backgroundColor: isContentShown ? '#fff' : Colors.LIGHT_GREY,
      },
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      padding: '0 25px',
      ...style,
    }
    const headerStyle = {
      alignItems: 'center',
      color: Colors.CHARCOAL_GREY,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      height: 50,
    }
    const contentStyle = {
      borderLeft: `solid 4px ${Colors.MODAL_PROJECT_GREY}`,
      color: Colors.CHARCOAL_GREY,
      fontSize: 13,
      lineHeight: 1.6,
      margin: isContentShown ? '25px 0' : 0,
      maxHeight: isContentShown ? 600 : 0,
      opacity: isContentShown ? 1 : 0,
      overflow: 'hidden',
      paddingLeft: 15,
      ...SmoothTransitions,
    }
    const tagStyle = {
      backgroundColor: Colors.GREENISH_TEAL,
      marginLeft: 15,
    }
    return <div style={containerStyle}>
      <header style={headerStyle} onClick={() => this.setState({isContentShown: !isContentShown})}>
        <strong style={Styles.CENTER_FONT_VERTICALLY}>
          {associationName}
        </strong>
        {isAvailableEverywhere ? <Tag style={tagStyle}>
          depuis chez vous
        </Tag> : null}
        <span style={{flex: 1}} />
        <span style={Styles.CENTER_FONT_VERTICALLY}>
          Voir {isContentShown ? 'moins ' : 'la mission '}
        </span>
        <Icon
          name={isContentShown ? 'chevron-up' : 'chevron-down'}
          style={{fontSize: 20, lineHeight: '13px', marginLeft: 5}} />
      </header>

      <div style={contentStyle}>
        <div style={{marginBottom: 20}}>
          <strong>Intitulé de la mission&nbsp;:</strong><br />
          {title}
        </div>

        <div>
          <strong>Description&nbsp;:</strong><br />
          <Markdown content={description} />
        </div>

        {link ? <div style={{marginTop: 20}}>
          Lire la suite sur <a href={link} target="_blank" rel="noopener noreferrer">
            Tous Bénévoles
          </a>
        </div> : null}
      </div>
    </div>
  }
}
const Mission = Radium(MissionBase)


class MoreMissionsLinkBase extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    style: PropTypes.object,
  }

  render() {
    const {children, style, ...extraProps} = this.props
    const containerStyle = {
      ':hover': {
        backgroundColor: Colors.LIGHT_GREY,
      },
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      color: Colors.CHARCOAL_GREY,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      height: 50,
      padding: '0 25px',
      ...style,
    }
    return <div style={containerStyle} {...extraProps}>
      <strong style={Styles.CENTER_FONT_VERTICALLY}>
        {children}
      </strong>
      <span style={{flex: 1}} />
      <img src={logoTousBenevoles} style={{height: 25}} alt="Tous bénévoles" />
      <Icon
        name="chevron-right"
        style={{fontSize: 20, lineHeight: '13px', marginLeft: 5}} />
    </div>
  }
}
const MoreMissionsLink = Radium(MoreMissionsLinkBase)


export default {AdviceCard, ExpandedAdviceCardContent}
