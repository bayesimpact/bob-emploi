import React from 'react'
import PropTypes from 'prop-types'

import {getJobPlacesFromDepartementStats} from 'store/job'

import {Colors, PaddedOnMobile} from 'components/theme'
import Picto from 'images/advices/picto-seasonal-relocate.png'

import {AdviceSuggestionList} from './base'

class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      seasonalData: PropTypes.shape({
        departementStats: PropTypes.arrayOf(PropTypes.shape({
          departementInName: PropTypes.string,
        })),
      }),
    }).isRequired,
    fontSize: PropTypes.number.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {
      advice: {
        seasonalData: {
          departementStats: {
            departementInName = 'dans le Var',
          } = {},
        } = {},
      } = {},
      fontSize,
      userYou,
    } = this.props
    // TODO(guillaume): Add job titles that feel interesting for our users.
    return <div>
      <div style={{fontSize: fontSize}}>
        Et si {userYou('tu travaillais', 'vous travailliez')} <strong>4 mois comme
        barman {departementInName}</strong>&nbsp;?
        On cherche du monde pour la prochaine saison touristique
        et {userYou('tu pourrais', 'vous pourriez')} gagner en expérience.
      </div>
    </div>
  }
}


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      seasonalData: PropTypes.shape({
        departementStats: PropTypes.arrayOf(PropTypes.shape({
          departementInName: PropTypes.string,
          jobGroups: PropTypes.arrayOf(PropTypes.shape({
            name: PropTypes.string,
            romeId: PropTypes.string,
          }).isRequired),
        })),
      }),
    }).isRequired,
  }

  render() {
    const {
      advice: {
        seasonalData: {
          departementStats = [{
            'departementInName': 'dans le Var',
            'jobGroups': [
              {
                'name': 'Hôtellerie',
                'romeId': '10293',
              },
            ],
          }],
        } = {},
      } = {},
    } = this.props

    const jobPlaces = getJobPlacesFromDepartementStats(departementStats)

    return <div style={{position: 'relative'}}>
      <PaddedOnMobile style={{color: Colors.DARK_TWO, fontSize: 20, marginBottom: 20}}>
          Il y a beaucoup d'offres d'emplois saisonniers en ce moment pour la prochaine saison
          touristique.
      </PaddedOnMobile>
      <AdviceSuggestionList isNotClickable={true}>
        {jobPlaces.map((jobPlace, index) => <SeasonalJobSuggestion
          {...jobPlace} key={`suggestion-${index}`} />)}
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


export default {AdviceCard, ExpandedAdviceCardContent, Picto}
