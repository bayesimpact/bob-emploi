import PropTypes from 'prop-types'
import {stringify} from 'query-string'
import React from 'react'

import {genderize, getEmailTemplates} from 'store/french'

import vroomVroomImage from 'images/vroom-vroom-picto.jpg'

import {GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-driving-license.svg'

import {CardProps, CardWithContentProps, connectExpandedCardWithContent, EmailTemplate,
  ExpandableAction, ToolCard} from './base'


class ExpandedAdviceCardContentBase extends React.PureComponent<
CardWithContentProps<bayes.bob.FrenchCity>> {
  public static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
      numStars: PropTypes.number,
    }).isRequired,
    adviceData: PropTypes.shape({
      latitude: PropTypes.number,
      longitude: PropTypes.number,
    }).isRequired,
    handleExplore: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      gender: PropTypes.oneOf(['FEMININE', 'MASCULINE']),
    }).isRequired,
    project: PropTypes.shape({
      city: PropTypes.shape({
        name: PropTypes.string,
        regionName: PropTypes.string,
      }),
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  private getVroomVroomUrl = (): string => {
    const {adviceData: {latitude, longitude}, project: {city}} = this.props
    if (!city || !latitude || !longitude) {
      return 'https://www.vroomvroom.fr/'
    }
    const {name, regionName} = city
    const location = `${name}, ${regionName}, France`
    const params = stringify({latitude, location, longitude})
    return `https://www.vroomvroom.fr/auto-ecoles?${params}`
  }

  private renderRequirements(style: React.CSSProperties): React.ReactNode {
    const {advice: {numStars}, profile: {gender}, userYou} = this.props
    const eFeminine = genderize('·e', 'e', '', gender)
    const asker = genderize('demandeur·se', 'demandeuse', 'demandeur', gender)
    const aLot = numStars && numStars >= 3 ? 'beaucoup ' : ''

    return <div style={style}>
      Nous {userYou('te', 'vous')} proposons ce conseil parce
      que {userYou('tu as', 'vous avez')} plus de 18 ans et il semblerait que&nbsp;:<br />
      <ul>
        <li>{userYou('tu es', 'vous êtes')} inscrit{eFeminine} comme {asker} d'emploi à
          Pôle emploi depuis plus de 6 mois
        </li>
        <li>{userYou('tu aurais', 'vous auriez')} {aLot}plus de chances de trouver un
          emploi en ayant le permis
        </li>
      </ul>

      Pour pouvoir bénéficier de cette aide il faut aussi que :
      <ul>
        <li>{userYou('tu ne reçoives', 'vous ne receviez')} pas d'allocations de
          chômage <strong>ou</strong>
        </li>
        <li>{userYou('tes', 'vos')} allocations chômage soient inférieures à
          28,84&nbsp;€&nbsp;/&nbsp;jour</li>
      </ul>

      Si {userYou('tu remplis', 'vous remplissez')} ces conditions de
      base, {userYou('tu devrais contacter ton ', 'vous devriez contacter votre ')}
      conseiller Pôle emploi pour avancer avec lui.
    </div>
  }

  private renderSchools(): React.ReactNode {
    const {handleExplore, userYou} = this.props
    const comparatorStyle: React.CSSProperties = {
      color: colors.COOL_GREY,
      fontSize: 13,
      fontStyle: 'italic',
      fontWeight: 'normal',
    }
    const schoolComparators = [
      <ToolCard
        imageSrc={vroomVroomImage} href={this.getVroomVroomUrl()} key="comparator-vroom-vroom"
        hasBorder={true} onClick={handleExplore('tool')}>
        VroomVroom.fr
        <div style={{fontSize: 13, fontWeight: 'normal'}}>
          pour comparer les auto-écoles près de chez vous
        </div>
        <div style={comparatorStyle}>Comparateur en ligne d'auto-écoles</div>
      </ToolCard>,
    ]
    const maybeS = schoolComparators.length > 1 ? 's' : ''
    const schoolsStyle = {
      paddingBottom: 35,
    }
    return <ExpandableAction
      key="schools" userYou={userYou} onContentShown={handleExplore('schools list')}
      title="Trouver une auto-école" contentName="les sites">
      <div style={schoolsStyle}>
        <div style={{marginBottom: 35}}>
          {userYou('Tu peux', 'Vous pouvez')} utiliser un comparateur d'auto-école, pour
          comparer les prix, le taux de réussite et la qualité des auto-écoles près de
          chez {userYou('toi', 'vous')}. Nous avons sélectionné
          pour {userYou('toi', 'vous')} <GrowingNumber
            style={{fontWeight: 'bold'}}
            number={schoolComparators.length} isSteady={true} /> comparateur{maybeS} en ligne :
        </div>
        {schoolComparators}
      </div>
    </ExpandableAction>
  }

  public render(): React.ReactNode {
    const {advice: {adviceId}, handleExplore, userYou} = this.props

    const templates = getEmailTemplates(userYou)[adviceId]
    const actions = templates.map((template, index): React.ReactNode =>
      <EmailTemplate
        {...template} key={`email-${index}`} userYou={userYou}
        onContentShown={handleExplore('email')} />
    )
    actions.splice(1, 0, this.renderSchools())

    return <div>
      {this.renderRequirements({marginBottom: 35})}
      {actions}
    </div>
  }
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<bayes.bob.FrenchCity, CardProps>(
    ExpandedAdviceCardContentBase)


export default {ExpandedAdviceCardContent, Picto}
