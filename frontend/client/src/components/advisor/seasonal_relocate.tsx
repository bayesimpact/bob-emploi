import React from 'react'
import PropTypes from 'prop-types'

import {getJobPlacesFromDepartementStats} from 'store/job'

import Picto from 'images/advices/picto-seasonal-relocate.svg'
import {GrowingNumber} from 'components/theme'

import {CardProps, CardWithContentProps, MethodSuggestionList,
  connectExpandedCardWithContent} from './base'


class SeasonalRelocate
  extends React.PureComponent<CardWithContentProps<bayes.bob.MonthlySeasonalJobbingStats>> {
  public static propTypes = {
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

  public render(): React.ReactNode {
    const {
      adviceData: {
        departementStats = [{
          departementInName: 'dans le Var',
          jobGroups: [
            {
              name: 'Hôtellerie',
              romeId: '10293',
            },
          ],
        }],
      } = {},
    } = this.props

    const jobPlaces = getJobPlacesFromDepartementStats(departementStats)
    const title = <React.Fragment>
      <GrowingNumber isSteady={true} number={jobPlaces.length} /> exemple
      {jobPlaces.length > 1 ? 's' : ''} de secteur saisonnier qui recrute en ce moment
      pour la prochaine saison touristique.
    </React.Fragment>
    return <MethodSuggestionList title={title} isNotClickable={true}>
      {jobPlaces.map(({inDepartement, jobGroup}, index): ReactStylableElement => <div key={index}>
        <span style={{fontWeight: 'normal'}}>{jobGroup}</span>&nbsp;<strong>{inDepartement}</strong>
      </div>)}
    </MethodSuggestionList>
  }
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<bayes.bob.MonthlySeasonalJobbingStats, CardProps>(SeasonalRelocate)


export default {ExpandedAdviceCardContent, Picto}
