import React from 'react'
import PropTypes from 'prop-types'


class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
  }

  render() {
    const {advice} = this.props
    // TODO(guillaume): Put departements in the proto.
    const seasonalDepartements = advice.seasonalDepartements ||  ['en Savoie', 'en Haute Savoie']
    // TODO(guillaume): Find the jobs depending on departements.
    return <div>
      <div style={{fontSize: 30}}>
        Et si vous travailliez 4 mois {seasonalDepartements ? seasonalDepartements[0] : ''} comme
        <strong>barman</strong>&nbsp;!
        On cherche du monde pour la prochaine saison touristique et vous pourrez gagner en
        expérience.
      </div>
    </div>
  }
}


export default {AdviceCard}
