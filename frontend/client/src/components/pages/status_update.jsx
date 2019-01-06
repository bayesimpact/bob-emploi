import {parse} from 'query-string'
import React from 'react'
import ReactDOM from 'react-dom'

import logoProductImage from 'images/logo-bob-beta.svg'

import {isMobileVersion} from 'components/mobile'
import {ShareModal} from 'components/share'
import {Button, MIN_CONTENT_PADDING} from 'components/theme'
import {CheckboxList, FieldSet, RadioGroup} from 'components/pages/connected/form_utils'

require('styles/App.css')

// TODO(cyrille): Report events to Amplitude.


const FORM_OPTIONS = {
  'en-recherche': {
    'headerText': userYou => `Merci de nous avoir donné des nouvelles,
      ${userYou(' tu nous rends', ' vous nous rendez')} un fier service\u00A0! J'ai juste quelques
      questions de plus.`,
    'seeking': 'STILL_SEEKING',
    'situationOptions': [
      {name: "J'ai un travail mais je cherche encore", value: 'WORKING'},
      {name: 'Je suis en formation', value: 'FORMATION'},
      {name: 'Je cherche toujours un emploi', value: 'SEEKING'},
    ],
  },
  'mise-a-jour': {
    'headerText': userYou => `Merci de nous avoir donné des nouvelles,
      ${userYou(' tu nous rends', ' vous nous rendez')} un fier service\u00A0!`,
    'seekingOptions': [
      {name: "Je suis toujours à la recherche d'un emploi", value: 'STILL_SEEKING'},
      {name: 'Je ne cherche plus', value: 'STOP_SEEKING'},
    ],
    'situationOptions': [
      {name: "J'ai un travail", value: 'WORKING'},
      {name: 'Je suis en formation', value: 'FORMATION'},
      {name: "Je suis à la recherche d'un emploi", value: 'SEEKING'},
      {name: "C'est compliqué", value: 'COMPLICATED'},
    ],
  },
  'ne-recherche-plus': {
    'headerText': userYou => `Merci de nous avoir donné des nouvelles,
      ${userYou(' tu nous rends', ' vous nous rendez')} un fier service\u00A0! J'ai juste quelques
      questions de plus qui nous servent à collecter des statistiques pour améliorer notre
      impact\u00A0:`,
    'seeking': 'STOP_SEEKING',
    'situationOptions': [
      {name: "J'ai un travail", value: 'WORKING'},
      {name: 'Je suis en formation', value: 'FORMATION'},
      {name: "C'est compliqué", value: 'COMPLICATED'},
    ],
  },
}


const OTHER_COACHES_OPTIONS = [
  {
    name: 'Un rendez-vous avec un conseiller Pôle emploi, APEC ou Mission locale',
    value: 'PE_COUNSELOR_MEETING',
  },
  {
    name: 'Une séance de coaching avec un service privé',
    value: 'PRIVATE_COACH_MEETING',
  },
  {
    name: 'Un programme de coaching avec un service privé',
    value: 'PRIVATE_COACH_PROGRAM',
  },
  {
    name: "Soutien via une association d'entraide",
    value: 'MUTUAL_AID_ORGANIZATION',
  },
  // TODO(pascal): Disable other options when this one is selected.
  {
    name: 'Aucun de ces services',
    value: '',
  },
]


const RELATIVE_PERSONALIZATION_OPTIONS = [
  {
    name: 'bien plus personnalisé',
    value: 15,
  },
  {
    name: 'plus personnalisé',
    value: 12,
  },
  {
    name: 'équivalent',
    value: 10,
  },
  {
    name: 'moins personnalisé',
    value: 8,
  },
  {
    name: 'bien moins personnalisé',
    value: 5,
  },
].map(({name, ...others}) => ({name: `${config.productName} est ${name}`, ...others}))


class StatusUpdatePage extends React.Component {
  static getStateFromLocation({pathname, search}) {
    const page = pathname.replace('/statut/', '')
    const state = {
      page: FORM_OPTIONS[page] ? page : '',
      params: parse(search),
    }
    const {seeking} = FORM_OPTIONS[page] || {}
    if (seeking) {
      state.seeking = seeking
    }
    return state
  }

  state = {
    errorMessage: null,
    isFormSent: false,
    isSendingUpdate: false,
    isValidated: false,
    page: '',
    params: {},
    ...StatusUpdatePage.getStateFromLocation(window.location),
  }

  handleCancel() {
    window.location.href = '/'
  }

  handleUpdate = () => {
    const {bobRelativePersonalization, newJobContractType,
      otherCoachesUsed = [], params, seeking, situation} = this.state
    if (!otherCoachesUsed.length || !situation ||
      otherCoachesUsed.filter(c => c).length && !bobRelativePersonalization) {
      this.setState({isValidated: true})
      return
    }
    const {token, user} = params || {}
    this.setState({errorMessage: null, isSendingUpdate: true})
    const realOtherCoachesUsed = otherCoachesUsed.filter(value => value)
    const newStatus = {
      bobRelativePersonalization: realOtherCoachesUsed.length ? bobRelativePersonalization : 0,
      newJobContractType,
      otherCoachesUsed: realOtherCoachesUsed,
      seeking,
      situation,
    }
    fetch(`/api/employment-status/${user}`, {
      body: JSON.stringify(newStatus),

      headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
      method: 'post',
    }).then(this.handleUpdateResponse)
  }

  handleUpdateResponse = response => {
    if (response.status >= 400 || response.status < 200) {
      response.text().then(errorMessage => {
        const page = document.createElement('html')
        page.innerHTML = errorMessage
        const content = page.getElementsByTagName('P')
        this.setState({
          errorMessage: content.length && content[0].innerText || page.innerText,
          isSendingUpdate: false,
        })
      })
      return
    }
    this.setState({isFormSent: true, isSendingUpdate: false})
  }

  renderHeader() {
    const style = {
      alignItems: 'center',
      backgroundColor: colors.BOB_BLUE,
      display: 'flex',
      height: 56,
      justifyContent: 'center',
      width: '100%',
    }
    return <header style={style}>
      <img
        style={{cursor: 'pointer', height: 40}} onClick={this.handleCancel}
        src={logoProductImage} alt={config.productName} />
    </header>
  }

  render() {
    const {bobRelativePersonalization, seeking, errorMessage, isFormSent,
      isSendingUpdate, isValidated, newJobContractType, otherCoachesUsed = [],
      page, params, situation} = this.state
    const {can_tutoie: canTutoie} = params
    const containerStyle = {
      padding: isMobileVersion ? `0 ${MIN_CONTENT_PADDING}px` : 'initial',
    }
    const pageStyle = {
      alignItems: 'center',
      color: colors.DARK_TWO,
      display: 'flex',
      flexDirection: 'column',
      fontSize: 15,
      fontWeight: 500,
      justifyContent: 'center',
      lineHeight: 1.5,
      minHeight: '100vh',
      paddingBottom: 40,
    }
    const userYou = canTutoie === 'true' ? tu => tu : (tu, vous) => vous
    if (!page) {
      return <div style={pageStyle}>Page introuvable</div>
    }
    const {headerText, seekingOptions, situationOptions} = FORM_OPTIONS[page]
    const isEmploymentDurationQuestionShown = seeking === 'STOP_SEEKING' && situation === 'WORKING'
    const isPersonalizationQuestionShown = otherCoachesUsed.filter(v => v).length
    if (isFormSent) {
      return <div style={{...containerStyle, ...pageStyle}}>
        Merci pour ces informations&nbsp;!
        <ShareModal isShown={bobRelativePersonalization > 10}
          campaign="rer" visualElement="status-update"
          title="Merci beaucoup !" intro={<React.Fragment>
            {newJobContractType || situation === 'FORMATION' ? <span>
              <div style={{marginBottom: 20}}>
                Et félicitations pour {userYou('ton ', 'votre ')}
                nouvel{newJobContractType ? ' emploi' : 'le formation'}&nbsp;!<br />
                Nous sommes ravis d'avoir pu {userYou("t'", 'vous ')}aider.
              </div>
            </span> : null}
            Si {userYou('tu penses', 'vous pensez')} que {config.productName} peut aider une
            personne que {userYou("tu connais, n'hésite", "vous connaissez, n'hésitez")} pas à
            lui <strong>partager ce lien&nbsp;:</strong>
          </React.Fragment>} />
      </div>
    }
    return <div style={pageStyle}>
      {this.renderHeader()}
      <div style={containerStyle}>
        <div
          style={{fontSize: 16, margin: '40px 0 20px', maxWidth: 500}}>{headerText(userYou)}</div>
        <div style={{maxWidth: 500}}>
          {seekingOptions ?
            <FieldSet
              label={`${userYou('Es-tu', 'Êtes-vous')} toujours à la recherche d'un emploi ?`}
              isValidated={isValidated} isValid={!!seeking}>
              <RadioGroup
                onChange={seeking => this.setState({seeking})}
                style={{flexDirection: 'column'}}
                options={seekingOptions}
                value={seeking} />
            </FieldSet> : null}
          <FieldSet
            label={`Quelle est ${userYou('ta', 'votre')} situation aujourd'hui ?`}
            isValidated={isValidated} isValid={!!situation}>
            <RadioGroup
              onChange={situation => this.setState({situation})}
              style={{flexDirection: 'column'}}
              options={situationOptions}
              value={situation} />
          </FieldSet>
          {isEmploymentDurationQuestionShown ? <FieldSet
            label={`Quel type de contrat a${userYou('s-tu', 'vez-vous')} décroché ?`}
            isValidated={isValidated} isValid={!!newJobContractType}>
            <RadioGroup
              onChange={newJobContractType => this.setState({newJobContractType})}
              style={{flexDirection: 'column'}}
              options={[
                {name: 'Un contrat de moins de 30 jours', value: 'ANY_CONTRACT_LESS_THAN_A_MONTH'},
                {name: 'Un CDD de 1 à 3 mois', value: 'CDD_LESS_EQUAL_3_MONTHS'},
                {name: 'Un CDD de plus de 3 mois', value: 'CDD_OVER_3_MONTHS'},
                {name: 'Un CDI', value: 'CDI'},
              ]}
              value={newJobContractType} />
          </FieldSet> : null}
          <FieldSet
            label={`À quels services de coaching ou d'orientation dans la recherche d'emploi
              ${userYou(' as-tu', ' avez-vous')} eu accès au cours de ${userYou('ta ', 'votre ')}
              recherche\u00A0?`}
            isValidated={isValidated} isValid={!!otherCoachesUsed.length}>
            <CheckboxList
              onChange={otherCoachesUsed => this.setState({otherCoachesUsed})}
              values={otherCoachesUsed}
              options={OTHER_COACHES_OPTIONS} />
          </FieldSet>
          {isPersonalizationQuestionShown ? <FieldSet
            label={`Dans l'ensemble comment évalue${userYou('s-tu', 'z-vous')} le degré de
              personnalisation des conseils donnés par ${config.productName} par rapport à ces
              autres services\u00A0?`}
            isValidated={isValidated} isValid={!!bobRelativePersonalization}>
            <RadioGroup
              options={RELATIVE_PERSONALIZATION_OPTIONS}
              value={bobRelativePersonalization}
              onChange={bobRelativePersonalization => this.setState({bobRelativePersonalization})}
              style={{flexDirection: 'column'}}
            />
          </FieldSet> : null}
        </div>
        <div style={{textAlign: 'center'}}>
          <Button
            onClick={this.handleUpdate}
            isProgressShown={isSendingUpdate}>
            Envoyer
          </Button>
          {errorMessage ? <div style={{marginTop: 20}}>
            {errorMessage}
          </div> : null}
        </div>
        <div style={{flex: 1}} />
      </div>
    </div>
  }
}


ReactDOM.render(<StatusUpdatePage />, document.getElementById('app'))
