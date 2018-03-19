import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'

import {getUserCount} from 'store/actions'
import {lowerFirstLetter, maybeContractPrefix} from 'store/french'
import {genderizeJob} from 'store/job'
import {PROJECT_LOCATION_AREA_TYPE_OPTIONS, PROJECT_PASSIONATE_OPTIONS} from 'store/project'
import {youForUser} from 'store/user'

import adieLogo from 'images/adie-logo.png'
import afeLogo from 'images/afe-ico.png'
import afpaLogo from 'images/afpa-ico.png'
import impalaLogo from 'images/impala-ico.png'
import poleEmploiLogo from 'images/ple-emploi-ico.png'

import {CitySuggest, JobSuggest} from 'components/suggestions'
import {Colors, FieldSet, WithNote, Select, Styles} from 'components/theme'
import {Step} from './step'


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
    userCounts: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  state = {
    areaType: null,
    city: null,
    isCompanyCreationShown: false,
    isReorientationShown: false,
    isUserCountShown: false,
    isValidated: false,
    kind: '',
    passionateLevel: null,
    targetJob: null,
  }

  componentWillMount() {
    const {defaultProjectProps, dispatch, newProject, userCounts} = this.props
    var newProjectWithDefaultProps = this.overrideNullProps(
      newProject || this.state, defaultProjectProps)
    this.setState(newProjectWithDefaultProps)
    if (!userCounts) {
      dispatch(getUserCount())
    }
  }

  // TODO(florian): Move to a helper file like store/dict_tools.js
  // Replace missing or null values in the props by default props.
  // This is different from just doing {...defaultProps, ...props} which does not replace
  // null values.
  overrideNullProps(props, defaultProps) {
    const propsWithDefaultProps = {...props}
    Object.keys(defaultProps || {}).forEach(key => {
      // Use the default prop if the prop is not already set.
      if (!(key in props) || props[key] === null) {
        propsWithDefaultProps[key] = defaultProps[key]
      }
    })
    return propsWithDefaultProps
  }

  handleSubmit = () => {
    const {areaType, city, isCompanyCreationShown,
      isReorientationShown, passionateLevel, kind, targetJob} = this.state
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

  handleChangeFieldWithCount = field => value => {
    if (value === this.state[field]) {
      return
    }
    const {isUserCountShown} = this.state
    this.setState({
      [field]: value,
      isUserCountShown: {
        ...isUserCountShown,
        [field]: !!value,
      },
    })
  }

  handleChange = field => value => {
    this.setState({[field]: value})
  }

  fastForward = () => {
    const {areaType, city, kind, passionateLevel, targetJob} = this.state
    if (this.isFormValid()) {
      this.handleSubmit()
      return
    }
    const newState = {}
    if (!kind) {
      newState.kind = 'FIND_A_NEW_JOB'
    }
    if (!passionateLevel) {
      newState.passionateLevel =
        PROJECT_PASSIONATE_OPTIONS[
          Math.floor(Math.random() * PROJECT_PASSIONATE_OPTIONS.length)
        ].value
    }
    if (!city) {
      newState.city = {
        cityId: '32208',
        departementId: '32',
        departementName: 'Gers',
        departementPrefix: 'dans le ',
        name: 'Lectoure',
        postcodes: '32700',
        regionId: '76',
        regionName: 'Occitanie',
        urbanScore: 1,
      }
      newState.isCityUserCountShown = true
    }
    if (!targetJob) {
      newState.targetJob = sampleJobs[Math.floor(Math.random() * sampleJobs.length)]
      newState.isJobUserCountShown = true
    }
    if (!areaType) {
      newState.areaType = 'CITY'
    }
    this.setState(newState)
  }

  isFormValid = () => {
    const {areaType, kind, city, passionateLevel, targetJob} = this.state
    return !!(kind && targetJob && city && areaType && passionateLevel)
  }

  renderTool({description, from, logo, name, url}) {
    const containerStyle = {
      border: `solid 1px ${Colors.SILVER}`,
      borderRadius: 4,
      display: 'flex',
      marginBottom: 20,
    }
    const logoContainerStyle = {
      alignItems: 'center',
      borderRight: `solid 1px ${Colors.SILVER}`,
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
        <div style={{color: Colors.WARM_GREY, fontStyle: 'italic'}}>
          {from}
        </div>
        <div style={{marginTop: 10}}>
          <a href={url} target="_blank" rel="noopener noreferer">
            Accéder au site
          </a>
        </div>
      </div>
    </div>
  }

  renderUnsupportedProjectKind({fieldShown, title, tools}) {
    const {gender} = this.props.profile || {}
    const {targetJob} = this.state
    return <Step
      title={title}
      fastForward={this.fastForward}
      onNextButtonClick={this.handleSubmit}
      onPreviousButtonClick={() => this.handlePrevious(fieldShown)}>

      <div style={{color: Colors.DARK_TWO, fontSize: 14}}>
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
          <div style={{backgroundColor: Colors.MODAL_PROJECT_GREY, flex: 1, height: 1}} />
          <div style={{fontWeight: 500, margin: 20, ...Styles.CENTER_FONT_VERTICALLY}}>
            ou
          </div>
          <div style={{backgroundColor: Colors.MODAL_PROJECT_GREY, flex: 1, height: 1}} />
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
    const {userYou} = this.props
    const {kind} = this.state
    switch (kind) {
      case 'CREATE_OR_TAKE_OVER_COMPANY':
        return `${userYou('Tu décrirais ton', 'Vous décririez votre')} expertise en tant que :`
      case 'REORIENTATION':
        return `${userYou('Tu aimerais te', 'Vous aimeriez vous')} reconvertir vers le métier de :`
      default:
        return `${userYou('Tu cherches', 'Vous cherchez')} un emploi de :`
    }
  }

  renderWhichCityQuestion() {
    const {userYou} = this.props
    const {kind} = this.state
    switch (kind) {
      case 'CREATE_OR_TAKE_OVER_COMPANY':
        return `${userYou('Tu veux', 'Vous voulez')} créer ou reprendre une entreprise à :`
      default:
        return `${userYou('Tu cherches', 'Vous cherchez')} autour de :`
    }
  }

  render() {
    const {profile, userCounts, userYou} = this.props
    const {areaType, city, kind, targetJob, isCompanyCreationShown,
      isReorientationShown, isUserCountShown, passionateLevel, isValidated} = this.state
    const maybeE = profile.gender === 'FEMININE' ? 'e' : ''
    const usersWithSameJob = targetJob && userCounts && userCounts.jobGroupCount &&
      userCounts.jobGroupCount[targetJob.jobGroup.romeId] || null
    const usersWithSameLocation = city && userCounts && userCounts.departementCount &&
      userCounts.departementCount[city.departementId] || null
    const userJobCountTip = usersWithSameJob && usersWithSameJob >= 10 && `Ça tombe bien,
      nous avons déja accompagné ${usersWithSameJob} personnes pour ce métier !` || null
    const userLocationCountTip = usersWithSameLocation && usersWithSameLocation >= 10 && `Super,
      ${usersWithSameLocation} personnes de ce département ont déjà testé les conseils
        personnalisés de Bob !` || null
    if (isCompanyCreationShown) {
      return this.renderUnsupportedProjectKind(_CREATION_ARGS)
    }
    if (isReorientationShown) {
      return this.renderUnsupportedProjectKind(_REORIENTATION_ARGS)
    }
    return <Step
      title="Super ! Maintenant, entrons dans le vif du sujet&nbsp;:"
      {...this.props} fastForward={this.fastForward}
      onNextButtonClick={this.handleSubmit}>
      <FieldSet label={`${userYou('Ton', 'Votre')} projet est de\u00A0:`}
        isValid={!!kind} isValidated={isValidated} hasCheck={true}>
        <Select value={kind} options={projectKindOptions} onChange={this.handleChange('kind')}
          placeholder={`${userYou('choisis', 'choisissez')} un type de projet`} />
      </FieldSet>
      <WithNote
        note={`${userYou('Tu ne trouves pas ton', 'Vous ne trouvez pas votre')} métier\u00A0?`}
        link="https://airtable.com/shreUw3GYqAwVAA27">
        <FieldSet
          label={this.renderWhichJobQuestion()}
          isValid={!!targetJob}
          isValidated={isValidated}
          hasCheck={true}
          hasNote={true}
          tip={userJobCountTip}
          isUserCountTipShown={isUserCountShown['targetJob']}>
          <JobSuggest
            placeholder={`${userYou('entre ton', 'entrez votre')} métier`}
            value={targetJob}
            onChange={this.handleChangeFieldWithCount('targetJob')}
            gender={profile.gender}
            style={{padding: 1, ...Styles.INPUT}} />
        </FieldSet>
      </WithNote>
      <FieldSet label={`Pour ${userYou('toi', 'vous')}, ce travail c'est\u00A0:`}
        isValid={!!passionateLevel} isValidated={isValidated} hasCheck={true}>
        <Select value={passionateLevel} options={PROJECT_PASSIONATE_OPTIONS}
          onChange={this.handleChange('passionateLevel')}
          placeholder={`${userYou('choisis', 'choisissez')} une proposition`} />
      </FieldSet>
      <FieldSet
        label={this.renderWhichCityQuestion()}
        isValid={!!city}
        isValidated={isValidated}
        hasCheck={true}
        tip={userLocationCountTip}
        isUserCountTipShown={isUserCountShown['city']}>
        <CitySuggest
          onChange={this.handleChangeFieldWithCount('city')}
          style={{padding: 1, ...Styles.INPUT}}
          value={city}
          placeholder={`${userYou('entre ta', 'entrez votre')} ville ou ${userYou(
            'ton', 'votre')} code postal`} />
      </FieldSet>
      {kind === 'CREATE_OR_TAKE_OVER_COMPANY' ? null : <FieldSet
        label={`${userYou('Tu es', 'Vous êtes')} prêt${maybeE} à bouger\u00A0:`}
        isValid={!!areaType}
        isValidated={isValidated} hasCheck={true}>
        <Select
          options={PROJECT_LOCATION_AREA_TYPE_OPTIONS} value={areaType}
          onChange={this.handleChange('areaType')}
          placeholder={`${userYou('choisis', 'choisissez')} une zone où ${userYou(
            'tu ', 'vous êt')}es
          prêt${maybeE} à ${userYou('te', 'vous')} déplacer`} />
      </FieldSet>}
    </Step>
  }
}
const NewProjectGoalStep = connect(({app, user}) => ({
  defaultProjectProps: app.defaultProjectProps,
  userCounts: app.userCounts,
  userYou: youForUser(user),
}))(NewProjectGoalStepBase)


export {NewProjectGoalStep}
