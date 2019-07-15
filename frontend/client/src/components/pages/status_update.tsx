import _memoize from 'lodash/memoize'
import {parse} from 'query-string'
import React from 'react'
import ReactDOM from 'react-dom'

import {YouChooser, tutoyer, vouvoyer} from 'store/french'

import logoProductImage from 'images/logo-bob-beta.svg'

import {isMobileVersion} from 'components/mobile'
import {ShareModal} from 'components/share'
import {Button, MIN_CONTENT_PADDING, RadioGroup} from 'components/theme'
import {CheckboxList, FieldSet} from 'components/pages/connected/form_utils'

require('styles/App.css')

// TODO(cyrille): Report events to Amplitude.


const FORM_OPTIONS = {
  'en-recherche': {
    'headerText': (userYou: YouChooser): string => `Merci de nous avoir donné des nouvelles,
      ${userYou(' tu nous rends', ' vous nous rendez')} un fier service\u00A0! J'ai juste quelques
      questions de plus.`,
    'seeking': 'STILL_SEEKING',
    'seekingOptions': [],
    'situationOptions': [
      {name: "J'ai un travail mais je cherche encore", value: 'WORKING'},
      {name: 'Je suis en formation', value: 'FORMATION'},
      {name: 'Je cherche toujours un emploi', value: 'SEEKING'},
    ],
  },
  'mise-a-jour': {
    'headerText': (userYou: YouChooser): string => `Merci de nous avoir donné des nouvelles,
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
    'headerText': (userYou: YouChooser): string => `Merci de nous avoir donné des nouvelles,
      ${userYou(' tu nous rends', ' vous nous rendez')} un fier service\u00A0! J'ai juste quelques
      questions de plus qui nous servent à collecter des statistiques pour améliorer notre
      impact\u00A0:`,
    'seeking': 'STOP_SEEKING',
    'seekingOptions': [],
    'situationOptions': [
      {name: "J'ai un travail", value: 'WORKING'},
      {name: 'Je suis en formation', value: 'FORMATION'},
      {name: "C'est compliqué", value: 'COMPLICATED'},
    ],
  },
} as const


interface PageState extends bayes.bob.EmploymentStatus {
  errorMessage?: string
  isFormSent?: boolean
  isSendingUpdate?: boolean
  isValidated?: boolean
  page?: keyof (typeof FORM_OPTIONS)
  params?: {
    // eslint-disable-next-line camelcase
    can_tutoie?: string
    gender?: string
    token?: string
    user?: string
  }
}


type StringStateField = 'seeking' | 'situation' | 'newJobContractType' | 'bobHasHelped'


type Location = typeof window.location


class StatusUpdatePage extends React.PureComponent<{}, PageState> {
  private static getStateFromLocation({pathname, search}: Location): PageState {
    const page = pathname.replace('/statut/', '')
    const {seeking = undefined} = FORM_OPTIONS[page] || {}
    return {
      page: FORM_OPTIONS[page] ? (page as keyof (typeof FORM_OPTIONS)) : undefined,
      params: parse(search),
      ...seeking && {seeking},
    }
  }

  public state: PageState = {
    errorMessage: null,
    isFormSent: false,
    isSendingUpdate: false,
    isValidated: false,
    params: {},
    ...StatusUpdatePage.getStateFromLocation(window.location),
  }

  private handleCancel(): void {
    window.location.href = '/'
  }

  private handleUpdate = (): void => {
    const {bobFeaturesThatHelped, bobHasHelped, newJobContractType,
      params, seeking, situation} = this.state
    if (!bobHasHelped || !situation) {
      this.setState({isValidated: true})
      return
    }
    const {token = '', user = ''} = params || {}
    this.setState({errorMessage: null, isSendingUpdate: true})
    const newStatus: bayes.bob.EmploymentStatus = {
      bobFeaturesThatHelped,
      bobHasHelped,
      newJobContractType,
      seeking,
      situation,
    }
    fetch(`/api/employment-status/${user}`, {
      body: JSON.stringify(newStatus),

      headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
      method: 'post',
    }).then(this.handleUpdateResponse)
  }

  private handleUpdateResponse = (response): void => {
    if (response.status >= 400 || response.status < 200) {
      response.text().then((errorMessage: string): void => {
        const page = document.createElement('html')
        page.innerHTML = errorMessage
        const content = page.getElementsByTagName('P') as HTMLCollectionOf<HTMLElement>
        this.setState({
          errorMessage: content.length && content[0].textContent || page.textContent,
          isSendingUpdate: false,
        })
      })
      return
    }
    this.setState({isFormSent: true, isSendingUpdate: false})
  }

  private handleUpdateField = _memoize((fieldName: StringStateField): ((v: string) => void) =>
    (value: string): void => this.setState({[fieldName]: value}))

  private handleUpdateFeatures = (bobFeaturesThatHelped: bayes.bob.UsefulFeature[]): void =>
    this.setState({bobFeaturesThatHelped})

  private renderHeader(): React.ReactNode {
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

  public render(): React.ReactNode {
    const {bobFeaturesThatHelped, bobHasHelped, seeking, errorMessage, isFormSent,
      isSendingUpdate, isValidated, newJobContractType, page, params, situation} = this.state
    const {can_tutoie: canTutoie, gender} = params
    const containerStyle: React.CSSProperties = {
      padding: isMobileVersion ? `0 ${MIN_CONTENT_PADDING}px` : 'initial',
    }
    const pageStyle: React.CSSProperties = {
      alignItems: 'center',
      color: colors.DARK_TWO,
      display: 'flex',
      flexDirection: 'column',
      fontSize: 15,
      fontWeight: 500,
      lineHeight: 1.5,
      minHeight: '100vh',
      paddingBottom: 40,
    }
    if (!page) {
      return <div style={pageStyle}>Page introuvable</div>
    }
    const userYou = canTutoie === 'true' ? tutoyer : vouvoyer
    const {headerText, seekingOptions, situationOptions} = FORM_OPTIONS[page]
    const isEmploymentDurationQuestionShown = seeking === 'STOP_SEEKING' && situation === 'WORKING'
    const isHowProductHelpedQuestionShown = bobHasHelped && /YES/.test(bobHasHelped)
    const feminineE = gender === 'FEMININE' ? 'e' : ''
    if (isFormSent) {
      return <div style={{...containerStyle, ...pageStyle}}>
        Merci pour ces informations&nbsp;!
        <ShareModal isShown={!!(bobHasHelped && /YES/.test(bobHasHelped))}
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
                onChange={this.handleUpdateField('seeking')}
                style={{flexDirection: 'column'}}
                options={seekingOptions}
                value={seeking} />
            </FieldSet> : null}
          <FieldSet
            label={`Quelle est ${userYou('ta', 'votre')} situation aujourd'hui ?`}
            isValidated={isValidated} isValid={!!situation}>
            <RadioGroup
              onChange={this.handleUpdateField('situation')}
              style={{flexDirection: 'column'}}
              options={situationOptions}
              value={situation} />
          </FieldSet>
          {isEmploymentDurationQuestionShown ? <FieldSet
            label={`Quel type de contrat a${userYou('s-tu', 'vez-vous')} décroché ?`}
            isValidated={isValidated} isValid={!!newJobContractType}>
            <RadioGroup
              onChange={this.handleUpdateField('newJobContractType')}
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
            label={`${config.productName} ${userYou("t'", 'vous ')}a t-il apporté un plus
              dans ${userYou('ta', 'votre')} recherche ?`}
            isValidated={isValidated} isValid={!!bobHasHelped}>
            <RadioGroup
              onChange={this.handleUpdateField('bobHasHelped')}
              style={{flexDirection: 'column'}}
              options={[
                {name: 'Oui, vraiment décisif', value: 'YES_A_LOT'},
                {name: `Oui, ça m'a aidé${feminineE}`, value: 'YES'},
                {name: 'Non, pas du tout', value: 'NOT_AT_ALL'},
              ]}
              value={bobHasHelped} />
          </FieldSet>
          {isHowProductHelpedQuestionShown ? <FieldSet
            label={`Comment ${config.productName} ${userYou("t'", 'vous ')}a-t-il
              aidé${feminineE} ?`}>
            <CheckboxList
              options={[
                {name: "Le diagnostic m'a été utile", value: 'DIAGNOSTIC'},
                {name: 'Utiliser plus le bouche à oreille', value: 'NETWORK'},
                {name: 'Utiliser plus les candidatures spontanées', value: 'SPONTANEOUS'},
                {name: 'Des astuces pour mon CV et lettre de motivation', value: 'RESUME_TIPS'},
                {name: 'Des astuces pour les entretiens', value: 'INTERVIEW_TIPS'},
                {
                  name: `${config.productName} m'a poussé${feminineE} à changer de stratégie`,
                  value: 'STRATEGY_CHANGE',
                },
              ]}
              values={bobFeaturesThatHelped}
              onChange={this.handleUpdateFeatures}
            />
            {/* TODO(pascal): Add a freeform text for "other feature that helped." */}
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
