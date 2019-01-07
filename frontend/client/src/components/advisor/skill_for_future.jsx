import PropTypes from 'prop-types'
import React from 'react'

import {AppearingList} from 'components/theme'
import Picto from 'images/advices/picto-skill-for-future.png'

import {DataSource, Skill, connectExpandedCardWithContent} from './base'


class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    adviceData: PropTypes.shape({
      skills: PropTypes.arrayOf(PropTypes.shape({
        assets: PropTypes.arrayOf(PropTypes.string.isRequired),
        description: PropTypes.string.isRequired,
        discoverUrl: PropTypes.string,
        name: PropTypes.string.isRequired,
      })),
    }).isRequired,
    onExplore: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      gender: PropTypes.string,
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {adviceData: {skills = []}, onExplore, profile: {gender}, userYou} = this.props
    const isPlural = skills.length > 1
    const maybeE = gender === 'FEMININE' ? 'e' : ''
    return <React.Fragment>
      <div style={{marginBottom: 15}}>
        Voici <strong>{skills.length} compétence{isPlural ? 's' : null}</strong> qui
        peu{isPlural ? 'ven' : null}t {userYou("t'", 'vous ')}aider à préparer l'avenir*.
        {isPlural ? " Certaines ont l'air d'être évidentes mais en y regardant de " +
          `plus près ${userYou('tu seras', 'vous serez')} surpris${maybeE}.` : null}
      </div>
      <AppearingList>
        {skills.map((skill, index) => <Skill
          key={skill.name} style={{marginTop: -1}} isRecommended={!index}
          {...{onExplore, userYou, ...skill}} />)}
      </AppearingList>
      <DataSource>
        Rapport OCDE : Future of Work and Skills / 80.000 hours
      </DataSource>
    </React.Fragment>
  }
}
const ExpandedAdviceCardContent = connectExpandedCardWithContent()(ExpandedAdviceCardContentBase)

export default {ExpandedAdviceCardContent, Picto}
