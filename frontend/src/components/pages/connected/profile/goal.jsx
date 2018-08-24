import _omit from 'lodash/omit'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {diagnoseOnboarding} from 'store/actions'
import {lowerFirstLetter, maybeContractPrefix} from 'store/french'
import {genderizeJob} from 'store/job'
import {PROJECT_LOCATION_AREA_TYPE_OPTIONS, PROJECT_PASSIONATE_OPTIONS} from 'store/project'

import adieLogo from 'images/adie-logo.png'
import afeLogo from 'images/afe-ico.png'
import afpaLogo from 'images/afpa-ico.png'
import impalaLogo from 'images/impala-ico.png'
import poleEmploiLogo from 'images/ple-emploi-ico.png'

import {CitySuggest, JobSuggest} from 'components/suggestions'
import {ExternalLink, WithNote, Styles} from 'components/theme'
import {FieldSet, Select} from 'components/pages/connected/form_utils'

import {OnboardingComment, Step} from './step'


const MOBILITY_FIELDS = new Set(['areaType', 'city'])


const projectKindOptions = [
  {name: 'Retrouver un emploi', value: 'FIND_A_NEW_JOB'},
  {name: 'Me reconvertir', value: 'REORIENTATION'},
  {name: 'Trouver mon premier emploi', value: 'FIND_A_FIRST_JOB'},
  {name: 'Trouver un autre emploi (je suis en poste)', value: 'FIND_ANOTHER_JOB'},
  {
    name: 'Développer ou reprendre une activité',
    value: 'CREATE_OR_TAKE_OVER_COMPANY',
  },
]


const sampleJobs = [
  {
    codeOgr: '12688',
    feminineName: 'Coiffeuse',
    jobGroup: {
      name: 'Coiffure',
      romeId: 'D1202',
    },
    masculineName: 'Coiffeur',
    name: 'Coiffeur / Coiffeuse',
  },
  {
    codeOgr: '11573',
    feminineName: 'Boulangère',
    jobGroup: {
      name: 'Boulangerie - viennoiserie',
      romeId: 'D1102',
    },
    masculineName: 'Boulanger',
    name: 'Boulanger / Boulangère',
  },
]


const _CREATION_TOOLS = [
  {
    description: 'pour réféchir, définir et affiner une idée.',
    from: 'Pôle emploi',
    logo: poleEmploiLogo,
    name: "Activ'crea",
    url: 'http://www.pole-emploi.fr/candidat/activ-crea-@/article.jspz?id=325937',
  },
  {
    description: 'pour calculer vos charges en micro-entreprise.',
    from: 'Agence France Entrepreneur',
    logo: afeLogo,
    name: 'Afecreation',
    url: 'https://www.afecreation.fr/pid11436/calculatrice-de-charges-micro-entrepreneur.html?espace=1',
  },
  {
    description: 'pour financer sa micro-entreprise',
    from: "Association pour le droit à l'initiative économique",
    logo: adieLogo,
    name: 'Adie',
    url: 'https://www.adie.org?utm_source=bob-emploi',
  },
]


const _CREATION_ARGS = {
  fieldShown: 'isCompanyCreationShown',
  title: "Nous ne traitons pas encore bien la création d'entreprise",
  tools: _CREATION_TOOLS,
}


const _REORIENTATION_TOOLS = [
  {
    description: 'pour trouver des idées à partir de ses compétences.',
    from: 'Entreprise sociale Impala SAS',
    logo: impalaLogo,
    name: 'Impala',
    url: 'http://impala.in',
  },
  {
    description: "un questionnaire complet pour s'orienter.",
    from: 'Association pour la Formation Professionnelle des Adultes',
    logo: afpaLogo,
    name: 'Afpa',
    url: 'https://www.afpa.fr/id-metiers',
  },
]


const _REORIENTATION_ARGS = {
  fieldShown: 'isReorientationShown',
  title: 'Nous ne traitons pas encore bien la reconversion professionnelle',
  tools: _REORIENTATION_TOOLS,
}


class NewProjectGoalStepBase extends React.Component {
  static propTypes = {
    defaultProjectProps: PropTypes.object,
    dispatch: PropTypes.func,
    newProject: PropTypes.object,
    onSubmit: PropTypes.func.isRequired,
    profile: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  state = {
    commentsRead: {
      city: !!this.props.newProject.city,
      targetJob: !!this.props.newProject.targetJob,
    },
    isCompanyCreationShown: false,
    isReorientationShown: false,
    isValidated: false,
  }

  componentDidMount() {
    const {defaultProjectProps, newProject} = this.props
    if (!defaultProjectProps) {
      return
    }
    const fieldsToKeep = Object.keys(newProject).filter(k => newProject[k])
    this.props.dispatch(
      diagnoseOnboarding({projects: [_omit(defaultProjectProps, fieldsToKeep)]}))
  }

  handleSubmit = () => {
    const {areaType, city, passionateLevel, kind, targetJob} = this.props.newProject
    const {isCompanyCreationShown, isReorientationShown} = this.state
    this.setState({isValidated: true})
    if (this.isFormValid()) {
      if (kind === 'CREATE_OR_TAKE_OVER_COMPANY' && !isCompanyCreationShown) {
        this.setState({isCompanyCreationShown: true})
        return
      }
      if (kind === 'REORIENTATION' && !isReorientationShown) {
        this.setState({isReorientationShown: true})
        return
      }
      this.props.onSubmit({areaType, city, kind, passionateLevel, targetJob})
    }
  }

  handlePrevious = field => {
    this.setState({[field]: false})
  }

  handleSuggestChange = field => value => {
    if (value) {
      this.handleChange(field)(value)
    }
  }

  // TODO(cyrille): Factorize this with all project steps.
  handleChange = field => value => {
    const projectDiff = {[field]: value}
    if (field === 'kind' && value === 'CREATE_OR_TAKE_OVER_COMPANY' &&
      !this.props.newProject.areaType) {
      // Set the area type by default as we don't ask for it for this kind.
      projectDiff.areaType = 'CITY'
    }
    if (this.state.commentsRead[field]) {
      this.setState(({commentsRead}) => ({...commentsRead, [field]: false}))
    }
    const wrappedField = MOBILITY_FIELDS.has(field) ? {mobility: projectDiff} : projectDiff
    this.props.dispatch(diagnoseOnboarding({projects: [wrappedField]}))
  }

  // TODO(cyrille): Harmonize this amongst different steps.
  handleCommentRead = field => () => this.setState(({commentsRead}) => ({
    commentsRead: {...commentsRead, [field]: true},
  }))

  fastForward = () => {
    const {areaType, city, kind, passionateLevel, targetJob} = this.props.newProject
    if (this.isFormValid()) {
      this.handleSubmit()
      return
    }
    const projectDiff = {}
    if (!kind) {
      projectDiff.kind = 'FIND_A_NEW_JOB'
    }
    if (!passionateLevel) {
      projectDiff.passionateLevel =
        PROJECT_PASSIONATE_OPTIONS[
          Math.floor(Math.random() * PROJECT_PASSIONATE_OPTIONS.length)
        ].value
    }
    if (!city) {
      projectDiff.mobility = {city: {
        cityId: '32208',
        departementId: '32',
        departementName: 'Gers',
        departementPrefix: 'dans le ',
        name: 'Lectoure',
        postcodes: '32700',
        regionId: '76',
        regionName: 'Occitanie',
        urbanScore: 1,
      }}
    }
    if (!targetJob) {
      projectDiff.targetJob = sampleJobs[Math.floor(Math.random() * sampleJobs.length)]
    }
    if (!areaType) {
      projectDiff.mobility = projectDiff.mobility || {}
      projectDiff.mobility.areaType = 'CITY'
    }
    this.setState({commentsRead: {city: true, targetJob: true}})
    this.props.dispatch(diagnoseOnboarding({projects: [projectDiff]}))
  }

  isFormValid = () => {
    const {areaType, kind, city, passionateLevel, targetJob} = this.props.newProject
    return !!(kind && targetJob && city && areaType && passionateLevel)
  }

  renderTool({description, from, logo, name, url}) {
    const containerStyle = {
      border: `solid 1px ${colors.SILVER}`,
      borderRadius: 4,
      display: 'flex',
      marginBottom: 20,
    }
    const logoContainerStyle = {
      alignItems: 'center',
      borderRight: `solid 1px ${colors.SILVER}`,
      display: 'flex',
      padding: 15,
    }
    return <div style={containerStyle} key={name}>
      <div style={logoContainerStyle}>
        <img src={logo} alt="" style={{width: 50}} />
      </div>
      <div style={{flex: 1, padding: 20}}>
        <strong>{name}</strong>
        <div>{description}</div>
        <div style={{color: colors.WARM_GREY, fontStyle: 'italic'}}>
          {from}
        </div>
        <div style={{marginTop: 10}}>
          <ExternalLink href={url}>Accéder au site</ExternalLink>
        </div>
      </div>
    </div>
  }

  renderUnsupportedProjectKind({fieldShown, title, tools}) {
    const {profile: {gender} = {}, newProject: {targetJob = {}} = {}} = this.props
    return <Step
      title={title}
      fastForward={this.fastForward}
      onNextButtonClick={this.isFormValid() ? this.handleSubmit : null}
      onPreviousButtonClick={() => this.handlePrevious(fieldShown)}>

      <div style={{color: colors.DARK_TWO, fontSize: 14}}>
        <div>
          Bob se concentre aujourd'hui surtout sur la reprise d'un emploi
          spécifique. Nous travaillons dur pour améliorer nos fonctionnalités, mais
          en attendant voici quelques ressources gratuites qui pourraient vous
          être utiles !
        </div>

        <div style={{marginTop: 30}}>
          {tools.map(this.renderTool)}
        </div>

        <div style={{alignItems: 'center', display: 'flex'}}>
          <div style={{backgroundColor: colors.MODAL_PROJECT_GREY, flex: 1, height: 1}} />
          <div style={{fontWeight: 500, margin: 20, ...Styles.CENTER_FONT_VERTICALLY}}>
            ou
          </div>
          <div style={{backgroundColor: colors.MODAL_PROJECT_GREY, flex: 1, height: 1}} />
        </div>

        <div>
          Continuez pour voir nos autres conseils pour le métier
          {' '}{maybeContractPrefix('de ', "d'",
            lowerFirstLetter(genderizeJob(targetJob, gender)))}.
        </div>
      </div>
    </Step>
  }

  renderWhichJobQuestion() {
    const {newProject: {kind}, userYou} = this.props
    switch (kind) {
      case 'CREATE_OR_TAKE_OVER_COMPANY':
        return `Quel métier représente le plus ${userYou('ton', 'votre')} expertise\u00A0?`
      case 'REORIENTATION':
        return `Vers quel métier ${userYou('aimerais-tu te', 'aimeriez-vous vous')}
          reconvertir \u00A0?`
      default:
        return `Quel est le poste que ${userYou('tu recherches', 'vous recherchez')}\u00A0?`
    }
  }

  renderWhichCityQuestion() {
    const {newProject: {kind}, userYou} = this.props
    switch (kind) {
      case 'CREATE_OR_TAKE_OVER_COMPANY':
        return `Où ${userYou('veux-tu', 'voulez-vous')} créer ou reprendre une entreprise \u00A0?`
      default:
        return `Autour de quelle ville cherche${userYou('s-tu', 'z-vous')}\u00A0?`
    }
  }

  render() {
    const {newProject: {areaType, city, kind, targetJob, passionateLevel},
      profile: {gender}, userYou} = this.props
    const {commentsRead, isCompanyCreationShown, isReorientationShown, isValidated} = this.state
    const maybeE = gender === 'FEMININE' ? 'e' : ''
    if (isCompanyCreationShown) {
      return this.renderUnsupportedProjectKind(_CREATION_ARGS)
    }
    if (isReorientationShown) {
      return this.renderUnsupportedProjectKind(_REORIENTATION_ARGS)
    }
    // Keep in sync with 'isValid' from fieldsets below.
    const checks = [
      kind,
      targetJob && commentsRead.targetJob,
      passionateLevel,
      city && commentsRead.city,
      areaType,
    ]
    return <Step
      title={`${userYou('Ton', 'Votre')} projet`}
      {...this.props} fastForward={this.fastForward}
      progressInStep={checks.filter(c => c).length / (checks.length + 1)}
      onNextButtonClick={this.isFormValid() ? this.handleSubmit : null}>
      <FieldSet label={`Quel est ${userYou('ton', 'votre')} projet\u00A0:`}
        isValid={!!kind} isValidated={isValidated} hasCheck={true}>
        <Select value={kind} options={projectKindOptions} onChange={this.handleChange('kind')}
          placeholder={`choisis${userYou('', 'sez')} un type de projet`} />
      </FieldSet>
      {checks[0] ? <React.Fragment>
        {/* TODO(cyrille): Find a way to avoid note + comment. */}
        <WithNote
          hasComment={true}
          note={`${userYou('Tu ne trouves pas ton', 'Vous ne trouvez pas votre')} métier\u00A0?`}
          link="https://airtable.com/shreUw3GYqAwVAA27">
          <FieldSet
            label={this.renderWhichJobQuestion()}
            isValid={!!targetJob}
            isValidated={isValidated}
            hasCheck={true}
            hasNoteOrComment={true}>
            <JobSuggest
              placeholder={`${userYou('entre ton', 'entrez votre')} métier`}
              value={targetJob}
              onChange={this.handleSuggestChange('targetJob')}
              gender={gender}
              style={{padding: 1, ...Styles.INPUT}} />
          </FieldSet>
        </WithNote>
        <OnboardingComment key={targetJob && targetJob.codeOgr || ''}
          onDone={this.handleCommentRead('targetJob')}
          field="TARGET_JOB_FIELD" shouldShowAfter={!!targetJob} />
      </React.Fragment> : null}
      {checks.slice(0, 2).every(c => c) ?
        <FieldSet label={`Que représente ce travail pour ${userYou('toi', 'vous')}\u00A0?`}
          isValid={!!passionateLevel} isValidated={isValidated} hasCheck={true}>
          <Select value={passionateLevel} options={PROJECT_PASSIONATE_OPTIONS}
            onChange={this.handleChange('passionateLevel')}
            placeholder={`choisis${userYou('', 'sez')} une proposition`} />
        </FieldSet> : null}
      {checks.slice(0, 3).every(c => c) ? <React.Fragment>
        <FieldSet
          label={this.renderWhichCityQuestion()}
          isValid={!!city}
          isValidated={isValidated}
          hasNoteOrComment={true}
          hasCheck={true}>
          <CitySuggest
            onChange={this.handleSuggestChange('city')}
            style={{padding: 1, ...Styles.INPUT}}
            value={city}
            placeholder={`${userYou('entre ta', 'entrez votre')} ville ou ${userYou(
              'ton', 'votre')} code postal`} />
        </FieldSet>
        <OnboardingComment key={city && city.cityId}
          onDone={this.handleCommentRead('city')}
          field="CITY_FIELD" shouldShowAfter={!!city} />
      </React.Fragment> : null}
      {checks.slice(0, 4).every(c => c) && kind !== 'CREATE_OR_TAKE_OVER_COMPANY' ? <FieldSet
        label={`Jusqu'où ${userYou('es-tu', 'êtes-vous')} prêt${maybeE}
          à ${userYou('te', 'vous')} déplacer\u00A0?`}
        isValid={!!areaType}
        isValidated={isValidated} hasCheck={true}>
        <Select
          options={PROJECT_LOCATION_AREA_TYPE_OPTIONS} value={areaType}
          onChange={this.handleChange('areaType')}
          placeholder={`choisis${userYou('', 'sez')} une zone où ${userYou(
            'tu ', 'vous êt')}es
          prêt${maybeE} à ${userYou('te', 'vous')} déplacer`} />
      </FieldSet> : null}
    </Step>
  }
}
const NewProjectGoalStep = connect(({app: {defaultProjectProps} = {}}) =>
  ({defaultProjectProps}))(NewProjectGoalStepBase)


export {NewProjectGoalStep}
