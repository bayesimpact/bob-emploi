import PropTypes from 'prop-types'
import React from 'react'

import {AppearingList} from 'components/theme'
import Picto from 'images/advices/picto-specific-to-job.png'


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    profile: PropTypes.shape({
      gender: PropTypes.string,
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {profile: {gender}, userYou} = this.props
    const maybeE = gender === 'FEMININE' ? 'e' : ''
    const itemStyle = isFirst => ({
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      display: 'flex',
      marginTop: isFirst ? 0 : -1,
      minHeight: 50,
      padding: 20,
    })
    return <AppearingList>
      <div style={itemStyle(true)}>
        {userYou('Postule', 'Postulez')} toujours en personne.
      </div>
      <div style={itemStyle()}>
        Les responsables de salon sont souvent très occupés,
        pour être sûr{maybeE} de les trouver
        {userYou(' va', ' allez')} les voir en heures creuses.
      </div>
      <div style={itemStyle()}>
        La coiffure est un métier d'esthétique, {userYou('sois', 'soyez')} toujours très
        soigné{maybeE} pour {userYou('te', 'vous')} présenter au responsable.
      </div>
      <div style={itemStyle()}>
        Si le responsable n'est pas là, {userYou('garde', 'gardez')} le nom de la personne
        que {userYou('tu as rencontrée et reviens ', 'vous avez rencontrée et revenez ')}
        quand le responsable sera là.
      </div>
    </AppearingList>
  }
}


export default {ExpandedAdviceCardContent, Picto}
