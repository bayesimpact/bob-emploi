import React from 'react'
import PropTypes from 'prop-types'

import {getJobPlacesFromDepartementStats} from 'store/job'

import {Colors, PaddedOnMobile} from 'components/theme'

import {AdviceSuggestionList} from './base'

class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
  }

  render() {
    const {advice} = this.props
    const {departementStats} = advice.seasonalData || {
      'departementStats': [{'departementInName': 'dans le Var'}],
    }
    // TODO(guillaume): Add job titles that feel interesting for our users.
    return <div>
      <div style={{fontSize: 30}}>
        Et si vous travailliez <strong>4 mois comme
        barman {departementStats[0].departementInName}</strong>&nbsp;?
        On cherche du monde pour la prochaine saison touristique et vous pourriez gagner en
        expérience.
      </div>
    </div>
  }
}


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
  }

  render() {
    const {advice} = this.props
    const {departementStats} = advice.seasonalData || {
      'departementStats': [
        {
          'departementInName': 'dans le Var',
          'jobGroups': [
            {
              'name': 'Hôtellerie',
              'romeId': '10293',
            },
          ],
        },
      ],
    }

    const jobPlaces = getJobPlacesFromDepartementStats(departementStats)

    return <div style={{position: 'relative'}}>
      <PaddedOnMobile style={{color: Colors.DARK_TWO, fontSize: 20, marginBottom: 20}}>
          Il y a beaucoup d'offres d'emplois saisonniers en ce moment pour la prochaine saison
          touristique.
      </PaddedOnMobile>
      <AdviceSuggestionList isNotClickable={true}>
        {jobPlaces.map((jobPlace, index) => <SeasonalJobSuggestion
          inDepartement={jobPlace.inDepartement}
          jobGroup={jobPlace.jobGroup}
          key={`suggestion-${index}`} />)}
      </AdviceSuggestionList>
    </div>
  }
}


class SeasonalJobSuggestion extends React.Component {
  static propTypes = {
    inDepartement: PropTypes.string.isRequired,
    jobGroup: PropTypes.string.isRequired,
    style: PropTypes.object,
  }

  render() {
    const {jobGroup, inDepartement, style} = this.props
    const fullStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      height: 50,
      padding: '0 20px',
      ...style,
    }

    return <div style={fullStyle}>
      <span style={{fontWeight: 'normal'}}>{jobGroup}</span>&nbsp;<strong>{inDepartement}</strong>
    </div>
  }
}


export default {AdviceCard, ExpandedAdviceCardContent}
