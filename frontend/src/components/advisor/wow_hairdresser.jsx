import React from 'react'

import {USER_PROFILE_SHAPE} from 'store/user'

import {AppearingList, Colors} from 'components/theme'


class FullAdviceCard extends React.Component {
  render() {
    return <div style={{fontSize: 30}}>
      Ne déposez pas juste votre CV : essayez de vous présenter
      en quelques mots au <strong>responsable du salon de coiffure</strong>.
    </div>
  }
}


class AdvicePageContent extends React.Component {
  static propTypes = {
    profile: USER_PROFILE_SHAPE.isRequired,
  }

  render() {
    const {profile} = this.props
    const maybeE = profile.gender === 'FEMININE' ? 'e' : ''
    const itemStyle = isFirst => ({
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      display: 'flex',
      marginTop: isFirst ? 0 : -1,
      minHeight: 50,
      padding: 20,
    })
    return <AppearingList>
      <div style={itemStyle(true)}>
        Postulez toujours en personne
      </div>
      <div style={itemStyle()}>
        Les responsables de salon sont souvent très occupés, pour être
        sûr{maybeE} de les trouver allez les voir en heures creuses.
      </div>
      <div style={itemStyle()}>
        La coiffure est un métier d'esthétique, soyez toujours très
        soigné{maybeE} pour vous présenter au responssable
      </div>
      <div style={itemStyle()}>
        Si le responsable n'est pas là, gardez le nom de la personne que vous
        avez rencontrée et revenez quand le responsable sera là.
      </div>
    </AppearingList>
  }
}


export default {AdvicePageContent, FullAdviceCard}
