import PropTypes from 'prop-types'
import React from 'react'
import {parse} from 'query-string'
import {connect} from 'react-redux'

import {saveMaydayHelperInfo} from 'store/actions'

import {isMobileVersion} from 'components/mobile'
import {Select} from 'components/pages/connected/form_utils'
import {CitySuggest} from 'components/suggestions'
import {Button, Checkbox, LabeledToggle, SmoothTransitions} from 'components/theme'
import helpCoffeeImageSet from 'images/mayday/help-coffee.png?multi&sizes[]=400&sizes[]=275'
import backgroundImage from 'images/mayday/background_coffee_page.jpg'
import partyIcon from 'images/party.png'


const domainOptions = [
  {name: 'Agriculture', value: 'A'},
  {name: 'Artisanat', value: 'B'},
  {name: 'Banque, Assurance, Immobilier', value: 'C'},
  {name: 'Commerce et grande distribution', value: 'D'},
  {name: 'Communication et média', value: 'E'},
  {name: 'Construction et BTP', value: 'F'},
  {name: 'Tourisme et loisirs', value: 'G11,G12,G13'},
  {name: 'Hôtellerie et restauration', value: 'G14,G15,G16,G17,G18'},
  {name: 'Industrie', value: 'H'},
  {name: 'Installation et maintenance', value: 'I'},
  {name: 'Santé', value: 'J'},
  {name: 'Social', value: 'K11,K12,K13,K14,K15,K18,K26'},
  {name: 'Arts et culture', value: 'K16,L11,L12,L13,L15'},
  {name: 'Défense et sécurité', value: 'K17,K25'},
  {name: 'Droit', value: 'K19'},
  {name: 'Formation', value: 'K21'},
  {name: 'Nettoyage et propreté', value: 'K22,K23'},
  {name: 'Recherche', value: 'K24'},
  {name: 'Sport', value: 'L14'},
  {name: "Support à l'entreprise", value: 'M11,M13,M14,M16'},
  {name: 'Comptabilité', value: 'M12'},
  {name: 'Ressources humaines', value: 'M15'},
  {name: 'Marketing', value: 'M17'},
  {name: 'Informatique', value: 'M18'},
  {name: 'Logistique', value: 'N1'},
  {name: 'Transport aérien et activités aéroportuaires', value: 'N2'},
  {name: 'Transport maritime et fluvial et activités portuaires', value: 'N3'},
  {name: 'Transport routier', value: 'N4'},
]


class CoffeePageBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    location: PropTypes.shape({
      search: PropTypes.string.isRequired,
    }).isRequired,
  }

  state = {
    cities: [],
    domains: [],
    isAvailableRemotely: false,
    isFormValid: true,
    isInfoSent: false,
    isSendingInfo: false,
  }

  addDomain = (value, index) => {
    const {domains} = this.state
    if (index >= (domains || []).length) {
      this.setState({
        domains: (domains || []).concat(value),
      })
      return
    }
    this.setState({
      domains: domains.map(
        (oldValue, i) => (i === index) ? value : oldValue),
    })
  }

  removeDomain = index => {
    const {domains = []} = this.state
    if (index >= domains.length) {
      return
    }
    this.setState({
      domains: domains.slice(0, index).
        concat(domains.slice(index + 1)),
    })
  }

  // TODO(marielaure): Generalize these with removeDomain and addDomain.
  removeCity = index => {
    const {cities = []} = this.state
    if (index >= cities.length) {
      return
    }
    this.setState({
      cities: cities.slice(0, index).
        concat(cities.slice(index + 1)),
    })
  }

  addCity = (value, index) => {
    const {cities} = this.state
    if (index >= (cities || []).length) {
      this.setState({
        cities: (cities || []).concat(value),
      })
      return
    }
    this.setState({
      cities: cities.map(
        (oldValue, i) => (i === index) ? value : oldValue),
    })
  }

  handleSubmit = () => {
    const {dispatch, location} = this.props
    const {helperId} = parse(location.search)
    const {cities, domains, isAvailableRemotely} = this.state
    const isFormValid = domains.length && (cities.length || isAvailableRemotely)
    this.setState({isFormValid: isFormValid})
    if (isFormValid) {
      this.setState({isSendingInfo: true})
      dispatch(saveMaydayHelperInfo(
        {cities, domains, isAvailableRemotely, userId: helperId})).
        then(updatedUser => {
          if (!this.hasUnmounted) {
            this.setState({isInfoSent: !!updatedUser, isSendingInfo: false})
          }
        })
    }
  }

  handleCheckboxClick = () => {
    const {isAvailableRemotely} = this.state
    this.setState({isAvailableRemotely: !isAvailableRemotely})
  }

  renderThankYou() {
    const containerStyle = {
      alignItems: 'center',
      backgroundColor: colors.BOB_BLUE,
      color: '#fff',
      display: 'flex',
      justifyContent: 'flex',
      minHeight: '100vh',
    }
    return <div style={containerStyle}>
      <div style={{textAlign: 'center'}}>
        <div style={{fontSize: 35, lineHeight: 1}}>
          Un immense merci pour votre engagement&nbsp;!
        </div>
        <img src={partyIcon} alt="" style={{margin: '25px auto', maxWidth: 95}} />
        <p style={{fontSize: 20}}>Nous vous recontactons par email pour vous
         mettre en contact avec une personne que vous pourrez aider.</p>
      </div>
    </div>
  }

  render() {
    const {cities, domains, isAvailableRemotely, isFormValid,
      isInfoSent, isSendingInfo} = this.state
    const background = isMobileVersion ? null :
      {backgroundImage: `url(${backgroundImage})`, backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover'}
    const containerStyle = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Lato, Helvetica',
      justifyContent: 'center',
      lineHeight: 1.29,
      minHeight: '100vh',
      ...background,
    }
    const cardStyle = {
      backgroundColor: '#fff',
      borderRadius: isMobileVersion ? 0 : 10,
      fontSize: 14,
      padding: '40px 20px',
      textAlign: 'center',
    }
    const selectStyle = {
      flex: 1,
      height: 35,
      marginLeft: 10,
      maxWidth: 490,
    }
    const domainStyle = {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'space-evenly',
      marginBottom: 10,
      width: '100%',
    }
    const legendStyle = {
      marginBottom: 15,
      marginTop: 35,
    }
    const invalidFormStyle = {
      color: '#f00',
      margin: '5px 0',
      opacity: isFormValid ? 0 : 1,
      ...SmoothTransitions,
    }
    const domainsPlusOne = (domains || []).some(f => !f) ?
      domains : (domains || []).concat([''])

    const citiesPlusOne = (cities || []).some(f => !f) ?
      cities : (cities || []).concat([undefined])

    const checkboxText = "Je suis aussi d'accord pour échanger avec une personne par " +
      'téléphone ou Skype'

    if (isInfoSent) {
      return this.renderThankYou()
    }
    // TODO(marielaure): Add a checkbox to ask if user is ok to do the interview remotely.
    return <div style={containerStyle}>
      <div style={cardStyle}>
        <p style={{fontSize: 24}}>Parler d'un projet pro autour d'un café</p>
        <img
          alt="" src={helpCoffeeImageSet.images[0].path}
          style={{height: 141, margin: '35px auto', width: 200}} />

        <div style={{margin: '15px auto', maxWidth: 520, textAlign: 'left'}}>
          <div style={legendStyle}>
            <strong>Dans quels domaines avez-vous le plus d'expérience&nbsp;?</strong><br />
            <span style={{fontStyle: 'italic'}}>Cela nous permettra de vous mettre en relation avec
            une personne qui cherche un emploi dans un secteur que vous connaissez.</span>
          </div>

          {domainsPlusOne.map((domain, index) => <div
            key={`domain-${index}`} style={domainStyle}>
            <Checkbox
              isSelected={!!domain}
              onClick={() => domain && this.removeDomain(index)} />
            {/* TODO(marielaure): Find a better way to do that!*/}
            <div style={{width: 10}} />
            <div style={{flex: 1}}>
              <Select
                options={domainOptions} value={domain}
                placeholder="Sélectionner un domaine"
                onChange={value => this.addDomain(value, index)}
                style={selectStyle} />
            </div>
          </div>)}

          <div style={legendStyle}>
            <strong>Dans quelle(s) ville(s) seriez-vous disponible&nbsp;?</strong><br />
            <span style={{fontStyle: 'italic'}}>Pas besoin d'être trop précis, notre
            recherche s'étendra à quelques kilomètres autour des villes que vous avez
            sélectionnées.</span>
          </div>

          {citiesPlusOne.map((city, index) => <div key={`city-${index}`}>
            <CitySuggest
              onChange={value => value ? this.addCity(value, index) : this.removeCity(index)}
              value={city}
              style={{marginBottom: 15}}
              placeholder="Saisir le nom d'une ville (exemple : Lyon, Paris…)" />
          </div>)}

          <LabeledToggle
            label={checkboxText} type="checkbox"
            isSelected={isAvailableRemotely}
            onClick={() => this.handleCheckboxClick()} />

        </div>
        <Button type="validation"
          isProgressShown={isSendingInfo}
          onClick={() => this.handleSubmit()}>
          Valider
        </Button>
        <div style={invalidFormStyle}>
          il est obligatoire de choisir un domaine ET un mode de rencontre
          (une ville ou par Skype...)
        </div>
      </div>
    </div>
  }
}
const CoffeePage = connect()(CoffeePageBase)

export {CoffeePage}
