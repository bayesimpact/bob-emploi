import React from 'react'
import PropTypes from 'prop-types'

import {getJobPlacesFromDepartementStats} from 'store/job'

import Picto from 'images/advices/picto-seasonal-relocate.png'

import {AdviceSuggestionList, connectExpandedCardWithContent} from './base'

class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    adviceData: PropTypes.shape({
      departementStats: PropTypes.arrayOf(PropTypes.shape({
        departementInName: PropTypes.string,
        jobGroups: PropTypes.arrayOf(PropTypes.shape({
          name: PropTypes.string,
          romeId: PropTypes.string,
        }).isRequired),
      })),
    }),
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
      <div style={{color: colors.DARK_TWO, marginBottom: 20}}>
          Il y a beaucoup d'offres d'emplois saisonniers en ce moment pour la prochaine saison
          touristique.
      </div>
      <AdviceSuggestionList isNotClickable={true}>
        {jobPlaces.map((jobPlace, index) => <SeasonalJobSuggestion
          {...jobPlace} key={`suggestion-${index}`} />)}
      </AdviceSuggestionList>
    </div>
  }
}
const ExpandedAdviceCardContent = connectExpandedCardWithContent()(ExpandedAdviceCardContentBase)


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
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
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


export default {ExpandedAdviceCardContent, Picto}
