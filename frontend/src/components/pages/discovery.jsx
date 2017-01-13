import React from 'react'
import {connect} from 'react-redux'
import {browserHistory} from 'react-router'
import Radium from 'radium'
import {CircularProgress} from 'components/progress'
import moment from 'moment'
moment.locale('fr')

import {fetchDiscoveryData, fetchJobGroupData, logDiscoveryPageOpenedAction,
        GET_DISCOVERY_JOB_GROUP_DATA, openNewProjectModal, addManualExploration,
        editManualExploration, deleteManualExploration} from 'store/actions'
import {inCityPrefix, maybeContract} from 'store/french'
import {genderizeJob, poleEmploiJobOffersUrl} from 'store/job'

import {JobGroupStats} from 'components/job'
import {CitySuggest, JobSuggest} from 'components/suggestions'
import {Modal} from 'components/modal'
import {PageWithNavigationBar} from 'components/navigation'
import {Colors, CoverImage, ExternalSiteButton, Icon, Markdown, RoundButton,
        SmoothTransitions, Styles} from 'components/theme'
import {Routes} from 'components/url'


class JobGroupCardBase extends React.Component {
  static propTypes = {
    city: React.PropTypes.object.isRequired,
    dispatch: React.PropTypes.func.isRequired,
    editButtonCaption: React.PropTypes.string,
    jobGroupExploration: React.PropTypes.object.isRequired,
    onEdit: React.PropTypes.func,
    onSeeMoreClick: React.PropTypes.func,
    style: React.PropTypes.object,
  }

  state = {
    isModalShown: false,
  }

  handleCreateProject = () => {
    const {city, dispatch, jobGroupExploration} = this.props
    if (!jobGroupExploration.jobGroup) {
      return
    }
    dispatch(openNewProjectModal({
      ...jobGroupExploration.jobGroup,
      city,
    }))
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {city, dispatch, editButtonCaption, jobGroupExploration, onEdit,
           onSeeMoreClick, style, ...extraProps} = this.props
    const containerStyle = {
      ':hover': {
        boxShadow: ' 0 0 25px 0 rgba(0, 0, 0, 0.1)',
      },
      backgroundColor: '#fff',
      borderRadius: 4,
      boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
      height: 435,
      overflow: 'hidden',
      position: 'relative',
      width: 380,
      ...style,
    }
    const titleStyle = {
      color: Colors.DARK_TWO,
      display: 'block',
      fontSize: 22,
      fontWeight: 'bold',
      lineHeight: 1.26,
      padding: '25px 35px 20px',
    }
    const buttonsContainerStyle = {
      bottom: 0,
      display: 'flex',
      justifyContent: 'center',
      left: 0,
      padding: 20,
      position: 'absolute',
      right: 0,
    }
    return <div {...extraProps} style={containerStyle}>
      <div style={{height: 150, position: 'relative', zIndex: 0}}>
        <CoverImage
            url={jobGroupExploration.jobGroup.imageLink}
            blur={!onSeeMoreClick ? 3 : 0} coverOpacity={0}
            opaqueCoverColor={Colors.DARK} />
      </div>
      <div style={titleStyle}>
        {jobGroupExploration.jobGroup.name}
      </div>
      <JobGroupStats
          {...jobGroupExploration.stats}
          style={{color: Colors.SLATE, fontSize: 14, padding: '0 35px'}}
          sectionStyle={{marginBottom: 10}} />
      <div style={buttonsContainerStyle}>
        {onEdit ?
          <RoundButton type="discreet" onClick={onEdit}>
            {editButtonCaption}
          </RoundButton> :
          <RoundButton type="discreet" onClick={this.handleCreateProject}>
            Créer un projet
          </RoundButton>}
        <div style={{width: 10}} />
        <RoundButton type="validation" onClick={onSeeMoreClick}>
          Voir le métier
        </RoundButton>
      </div>
    </div>
  }
}
const JobGroupCard = connect()(Radium(JobGroupCardBase))


class CardsCarousel extends React.Component {
  static propTypes = {
    cards: React.PropTypes.arrayOf(React.PropTypes.object.isRequired).isRequired,
    city: React.PropTypes.object.isRequired,
    editOnFirstCard: React.PropTypes.string,
    initialScrollPosition: React.PropTypes.number,
    onEdit: React.PropTypes.func,
    onSeeMoreClick: React.PropTypes.func.isRequired,
    style: React.PropTypes.object,
  }

  state = {
    scroll: 0,
  }

  componentWillMount() {
    this.scrollCardWidth = 400
    this.setState({scroll: this.props.initialScrollPosition || 0})
  }

  componentDidMount() {
    this.refs.container.addEventListener('mousewheel', this.handleMouseWheel)
  }

  componentWillUnmount() {
    this.refs.container.removeEventListener('mousewheel', this.handleMouseWheel)
  }

  handleMouseWheel = event => {
    this.setScroll(this.state.scroll + event.deltaX)
    this.refs.container.scrollLeft = 0
    setTimeout(() => {
      this.refs.container.scrollLeft = 0
    }, 1)
  }

  getScrollDelta(scroll) {
    return (Math.trunc(scroll / this.scrollCardWidth) || 1) * this.scrollCardWidth
  }

  setScroll(scroll) {
    const {initialScrollPosition} = this.props
    if (scroll < initialScrollPosition) {
      scroll = initialScrollPosition
    }
    const maxScroll = this.getMaxScroll()
    if (scroll > maxScroll) {
      scroll = maxScroll
    }
    this.setState({scroll})
  }

  getScrollHandler = isLeft => () => {
    const {scroll} = this.state
    const containerWidth = this.refs.container.clientWidth
    const scrollDelta = this.getScrollDelta(containerWidth)
    this.setScroll(scroll + (isLeft ? -1 : 1) * scrollDelta)
  }

  getMaxScroll() {
    const {cards, initialScrollPosition} = this.props
    if (!this.refs.container) {
      return 10000
    }
    const containerWidth = this.refs.container.clientWidth
    const maxScroll = initialScrollPosition +
      cards.length * this.scrollCardWidth - this.getScrollDelta(containerWidth)
    if (maxScroll < initialScrollPosition) {
      return initialScrollPosition
    }
    return maxScroll
  }

  render() {
    const {cards, city, editOnFirstCard, initialScrollPosition, onEdit,
           onSeeMoreClick, style, ...extraProps} = this.props
    const {scroll} = this.state
    const containerStyle = {
      overflowX: 'hidden',
      overflowY: 'visible',
      padding: '13px 0 20px',
      position: 'relative',
      ...style,
    }
    const scrolledStyle = {
      minWidth: this.scrollCardWidth * cards.length,
      transform: `translateX(${-scroll}px)`,
      ...SmoothTransitions,
    }
    return <div {...extraProps} style={containerStyle} ref="container">
      <div style={scrolledStyle}>
        {cards.map((card, i) => <JobGroupCard
            key={card.jobGroup.romeId} city={city}
            style={{display: 'inline-block', marginRight: 20, width: this.scrollCardWidth - 20}}
            jobGroupExploration={card}
            editButtonCaption={i === 0 ? editOnFirstCard : ''}
            onEdit={(i === 0 && editOnFirstCard) ? onEdit : null}
            onSeeMoreClick={event => {
              event.stopPropagation()
              onSeeMoreClick(card.jobGroup)
            }} />)}
      </div>
      {scroll >= this.getMaxScroll() ? null : <CarouselScrollButton
          isLeft={false} onClick={this.getScrollHandler(false)} />}
      {scroll <= initialScrollPosition ? null : <CarouselScrollButton
          isLeft={true} onClick={this.getScrollHandler(true)} />}
    </div>
  }
}


class CarouselScrollButton extends React.Component {
  static propTypes = {
    isLeft: React.PropTypes.bool,
    onClick: React.PropTypes.func.isRequired,
  }

  render() {
    const {isLeft, onClick} = this.props
    const containerStyle = {
      alignItems: 'center',
      backgroundImage:
        `linear-gradient(to ${isLeft ? 'left' : 'right'}, transparent, ${Colors.BACKGROUND_GREY})`,
      bottom: 0,
      display: 'flex',
      justifyContent: 'flex-' + (isLeft ? 'end' : 'start'),
      left: isLeft ? 0 : 'initial',
      position: 'absolute',
      right: isLeft ? 'initial' : 0,
      top: 0,
      width: 100,
    }
    const buttonStyle = {
      ':hover': {
        backgroundColor: Colors.SLATE,
        color: '#fff',
        opacity: 1,
      },
      backgroundColor: Colors.SLATE,
      color: '#fff',
      display: 'flex',
      fontSize: 40,
      height: 70,
      justifyContent: 'center',
      opacity: .7,
      padding: '1px 0 0',
      width: 70,
    }
    return <div style={containerStyle}>
      <RoundButton style={buttonStyle} onClick={onClick}>
        <Icon name={'chevron-' + (isLeft ? 'left' : 'right')} />
      </RoundButton>
    </div>
  }
}


class JobExplorationBase extends React.Component {
  static propTypes = {
    city: React.PropTypes.object.isRequired,
    dispatch: React.PropTypes.func.isRequired,
    editButtonText: React.PropTypes.string,
    gender: React.PropTypes.string,
    job: React.PropTypes.object.isRequired,
    jobGroups: React.PropTypes.arrayOf(React.PropTypes.object.isRequired).isRequired,
    onEdit: React.PropTypes.func.isRequired,
    onSeeMoreClick: React.PropTypes.func.isRequired,
    titlePrefix: React.PropTypes.string,
    useEditOnFirstCard: React.PropTypes.bool,
  }

  state = {
    isFetching: false,
  }

  componentWillMount() {
    const {city, job, jobGroups} = this.props
    if (!jobGroups.length) {
      this.fetchData(city, job)
    }
  }

  componentWillReceiveProps(nextProps) {
    const {city, job, jobGroups} = nextProps
    if (city === this.props.city && job === this.props.job || jobGroups.length) {
      return
    }
    this.fetchData(city, job)
  }

  componentWillUnmount() {
    if (this.finishFetching) {
      this.finishFetching.cancel()
    }
  }

  fetchData(city, job) {
    if (this.finishFetching) {
      this.finishFetching.cancel()
    }
    this.setState({isFetching: true})
    this.finishFetching = this.props.dispatch(fetchDiscoveryData(city, job)).then(response => {
      this.setState({isFetching: false})
      this.finishFetching = null
      return response
    })
  }

  render() {
    const {city, editButtonText, gender, job, jobGroups, onEdit,
           onSeeMoreClick, titlePrefix, useEditOnFirstCard} = this.props
    const {isFetching} = this.state
    const fetchingNoteStyle = {
      alignItems: 'center',
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      height: 474,
      justifyContent: 'center',
    }
    const titleStyle = {
      color: Colors.CHARCOAL_GREY,
      fontSize: 12,
      fontWeight: 'bold',
      letterSpacing: 1,
      margin: '0 60px',
      textTransform: 'uppercase',
    }
    const editableStyle = {
      color: Colors.SKY_BLUE,
      cursor: 'pointer',
    }
    const miniButtonStyle = {
      fontSize: 12,
      marginLeft: '15px',
      padding: '4px 15px 3px',
    }
    const jobName = genderizeJob(job, gender)
    const {cityName, prefix} = inCityPrefix(city && city.name || '')
    return <div>
      <div style={titleStyle}>
        {titlePrefix || null}
        {titlePrefix ? maybeContract(' de ', " d'", jobName) : null}
        <a onClick={onEdit} style={editableStyle}>{jobName}</a> {prefix}
        <a onClick={onEdit} style={editableStyle}>{cityName}</a> et métiers proches
        {editButtonText ? <RoundButton type="back" style={miniButtonStyle} onClick={onEdit}>
          {editButtonText}
        </RoundButton> : null}
      </div>
      {isFetching ? <div style={fetchingNoteStyle}>
        <CircularProgress style={{marginBottom: 50}} />
        Veuillez patienter pendant que nous analysons les données du marché du
        travail des métiers proches.
      </div> : <CardsCarousel
          initialScrollPosition={-60} city={city}
          cards={jobGroups} editOnFirstCard={useEditOnFirstCard ? editButtonText : ''}
          onEdit={onEdit} onSeeMoreClick={onSeeMoreClick} />}
    </div>
  }
}
const JobExploration = connect(({app}, props) => {
  const {discoveries} = app
  const {city, job} = props
  return {
    jobGroups: discoveries[job.codeOgr + ':' + city.cityId] || [],
  }
})(JobExplorationBase)


class DiscoveryPage extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    user: React.PropTypes.object.isRequired,
  }

  state = {
    editManualIndex: -1,
    lastJobSelected: null,
    modalCity: null,
    modalJobGroup: null,
  }

  componentDidMount() {
    this.props.dispatch(logDiscoveryPageOpenedAction)
  }

  handleAddManualExploration = job => {
    if (!job) {
      return
    }
    this.props.dispatch(addManualExploration(job))
    this.refs.manualJob.reset()
  }

  handleDeleteExploration = () => {
    this.props.dispatch(deleteManualExploration(this.state.editManualIndex))
    this.setState({editManualIndex: -1})
  }

  handleEditExploration = updatedExploration => {
    this.props.dispatch(editManualExploration(this.state.editManualIndex, updatedExploration))
    this.setState({editManualIndex: -1})
  }

  renderHeader() {
    const {user} = this.props
    const headerStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      boxShadow: '0 2px 0 0 rgba(0, 0, 0, 0.1)',
      color: Colors.SLATE,
      display: 'flex',
      flexShrink: 0,
      fontSize: 15,
      fontWeight: 500,
      height: 50,
      lineHeight: 1.33,
      padding: '0 60px',
      width: '100%',
    }
    const suggestStyle = {
      border: 'none',
      marginTop: '.25em',
      width: '100%',
    }
    return <header style={headerStyle}>
      <Icon name="magnify" style={{fontSize: 27}} />
      <div style={{display: 'flex', flex: 1, flexDirection: 'column'}}>
        <JobSuggest
            gender={user.profile.gender} ref="manualJob" style={suggestStyle}
            placeholder="Rechercher un métier à explorer"
            onChange={this.handleAddManualExploration} />
      </div>
    </header>
  }

  render() {
    const {user} = this.props
    const {manualExplorations} = user
    const {editManualIndex, modalCity, modalJobGroup} = this.state

    // Dedupe explorations.
    const isExplorationShown = {}
    const explorationKey = (job, city) => job.codeOgr + ':' + city.cityId
    const getProjectExplorationKey =
      project => explorationKey(project.targetJob,project.mobility.city)
    const profileExplorationKey = explorationKey(user.profile.latestJob, user.profile.city);
    (user.projects || []).forEach(project => {
      const key = getProjectExplorationKey(project)
      if (!isExplorationShown[key]) {
        isExplorationShown[key] = project.projectId
      }
    })
    const shownProjects = (user.projects || []).filter(project =>
        isExplorationShown[getProjectExplorationKey(project)] === project.projectId)

    return <PageWithNavigationBar
        page="discovery" style={{display: 'flex', flexDirection: 'column'}}
        isContentScrollable={true}>
      <JobGroupModal
          city={modalCity} jobGroup={modalJobGroup}
          isShown={!!modalCity}
          onClose={() => this.setState({modalCity: null, modalJobGroup: null})} />
      <EditExplorationModal
          gender={user.profile.gender}
          isShown={editManualIndex >= 0}
          initialValues={editManualIndex >= 0 ? manualExplorations[editManualIndex] : null}
          onClose={() => this.setState({editManualIndex: -1})}
          onDelete={this.handleDeleteExploration}
          onSubmit={this.handleEditExploration} />
      {this.renderHeader()}
      <div style={{flexShrink: 0, padding: '35px 0'}}>
        {(manualExplorations || []).map(({city, sourceJob}, index) => <JobExploration
            key={'manual-' + (manualExplorations.length - index)} city={city} job={sourceJob}
            gender={user.profile.gender}
            onEdit={() => this.setState({editManualIndex: index})}
            editButtonText="Éditer"
            onSeeMoreClick={jobGroup => this.setState({
              modalCity: city,
              modalJobGroup: jobGroup,
            })} />)}

        {shownProjects.map(project => <JobExploration
            key={project.projectId}
            city={project.mobility.city} job={project.targetJob}
            titlePrefix="Votre projet" gender={user.profile.gender}
            onEdit={() => browserHistory.push(Routes.PROJECT_PAGE + '/' + project.projectId)}
            editButtonText="Voir le projet" useEditOnFirstCard={true}
            onSeeMoreClick={jobGroup => this.setState({
              modalCity: project.mobility.city,
              modalJobGroup: jobGroup,
            })} />)}

        {isExplorationShown[profileExplorationKey] ? null : <JobExploration
            city={user.profile.city} job={user.profile.latestJob}
            titlePrefix="Votre métier passé" gender={user.profile.gender}
            onEdit={() => browserHistory.push(Routes.PROFILE_PAGE)}
            onSeeMoreClick={jobGroup => this.setState({
              modalCity: user.profile.city,
              modalJobGroup: jobGroup,
            })} />}
      </div>
    </PageWithNavigationBar>
  }
}


class EditExplorationModal extends React.Component {
  static propTypes = {
    gender: React.PropTypes.string,
    initialValues: React.PropTypes.object,
    isShown: React.PropTypes.bool,
    onDelete: React.PropTypes.func.isRequired,
    onSubmit: React.PropTypes.func.isRequired,
  }

  state = {
    city: null,
    sourceJob: null,
  }

  componentWillMount() {
    const {initialValues} = this.props
    if (initialValues) {
      this.setState(initialValues)
    }
  }

  componentWillReceiveProps(nextProps) {
    const {initialValues, isShown} = nextProps
    if (isShown && !this.props.isShown && initialValues) {
      this.setState(initialValues)
    }
  }

  handleSubmit = () => {
    const {onSubmit} = this.props
    const {city, sourceJob} = this.state
    if (city && sourceJob) {
      onSubmit({city, sourceJob})
    }
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {gender, initialValues, onDelete, onSubmit, ...extraProps} = this.props
    const {city, sourceJob} = this.state
    const style = {
      fontSize: 15,
      padding: '40px 50px 30px',
    }
    const suggestStyle = {
      margin: '0.4em',
      padding: 1,
      ...Styles.INPUT,
    }
    return <Modal style={style} {...extraProps}>
      <div style={{alignItems: 'center', display: 'flex', marginBottom: 40}}>
        Métiers proches de <JobSuggest
            gender={gender} value={sourceJob} style={suggestStyle}
            onChange={sourceJob => this.setState({sourceJob})} />
        <span style={{margin: '0 .4em 0 .8em'}}>à</span>
        <CitySuggest onChange={city => this.setState({city})} value={city} style={suggestStyle} />
      </div>
      <div style={{borderTop: 'solid 1px ' + Colors.SILVER, paddingTop: 30, textAlign: 'right'}}>
        <RoundButton type="discreet" onClick={onDelete} style={{marginRight: 15}}>
          Supprimer
        </RoundButton>
        <RoundButton type="validation" onClick={this.handleSubmit} disabled={!city || !sourceJob}>
          Enregistrer
        </RoundButton>
      </div>
    </Modal>
  }
}


class JobGroupModalBase extends React.Component {
  static propTypes = {
    city: React.PropTypes.object,
    dispatch: React.PropTypes.func.isRequired,
    gender: React.PropTypes.string,
    isFetching: React.PropTypes.bool.isRequired,
    // TODO(stephan): Find a better name for this prop.
    jobExploration: React.PropTypes.object.isRequired,
    jobGroup: React.PropTypes.object,
    onClose: React.PropTypes.func,
  }

  componentWillReceiveProps(nextProps) {
    const {city, dispatch, jobGroup} = nextProps
    if (city !== this.props.city || jobGroup !== this.props.jobGroup) {
      if (city && jobGroup) {
        dispatch(fetchJobGroupData(city, jobGroup))
      }
    }
  }

  handleCreateProject = () => {
    const {city, jobExploration, onClose} = this.props
    if (!jobExploration.jobGroup) {
      return
    }
    onClose && onClose()
    this.props.dispatch(openNewProjectModal({
      ...jobExploration.jobGroup,
      city,
    }))
  }

  render() {
    const {city, gender, isFetching, jobExploration} = this.props
    const pageStyle = {
      maxWidth: 700,
      zIndex: 0,
    }
    const headerStyle = {
      alignItems: 'center',
      color: '#fff',
      display: 'flex',
      fontWeight: 'bold',
      height: 88,
      lineHeight: 1.1,
      position: 'relative',
      zIndex: 0,
    }
    const titleStyle = {
      flex: 1,
      fontSize: 20,
      margin: '0 auto',
      textAlign: 'center',
      textShadow: '0 0 4px rgba(0, 0, 0, 0.5)',
      textTransform: 'uppercase',
    }
    const contentStyle = {
      color: Colors.CHARCOAL_GREY,
      flex: 1,
      fontSize: 14,
      lineHeight: 1.44,
      margin: '0 auto',
      maxHeight: .9 * (window.innerHeight - 150),
      overflow: 'auto',
      padding: '30px 35px',
    }
    const sectionHeaderStyle = {
      fontWeight: 'bold',
      margin: '30px 0 8px',
    }
    const verticalLineStyle = {
      borderLeft: 'solid 1px',
      color: Colors.CHARCOAL_GREY,
      margin: '0 33px',
    }
    const statsStyle = {
      backgroundColor: Colors.BACKGROUND_GREY,
      fontSize: 14,
      lineHeight: 1.71,
      padding: 15,
      textAlign: 'center',
    }
    const jobGroupName = jobExploration.jobGroup && jobExploration.jobGroup.name || ''
    let availableOffers = 'les offres'
    if (jobExploration.stats && jobExploration.stats.numAvailableJobOffers > 1) {
      availableOffers = `les ${jobExploration.stats.numAvailableJobOffers} offres ou plus`
    }
    // TODO(pascal): Drop this once servers reliably serve it.
    const links = [{
      caption: `Consulter ${availableOffers} sur le site de Pôle Emploi`,
      url: poleEmploiJobOffersUrl({
        departementId: city && city.departementId || '',
        jobGroupId: jobExploration.jobGroup && jobExploration.jobGroup.romeId || '',
      }),
    }]
    return <Modal {...this.props}><div style={pageStyle}>
      {isFetching && !jobExploration.jobGroup ? <CircularProgress /> : null}

      <div style={headerStyle}>
        <CoverImage url={jobExploration.jobGroup && jobExploration.jobGroup.imageLink}
                    style={{zIndex: -1}} coverOpacity={.7} opaqueCoverColor={Colors.DARK} />

        <h1 style={titleStyle}>
          {jobGroupName}
        </h1>
      </div>

      <div style={contentStyle}>
        <JobGroupStats {...jobExploration.stats} style={statsStyle} />

        <div style={{marginTop: 20, textAlign: 'center'}}>
          {(jobExploration.links || links).map((link, i) =>
            <ExternalSiteButton key={i} href={link.url}>
              {link.caption}
            </ExternalSiteButton>)}
        </div>

        <div style={sectionHeaderStyle}>
          Les différents métiers dans cette catégorie
        </div>
        {(jobExploration.jobGroup && jobExploration.jobGroup.jobs || []).map(job => <div
            key={job.codeOgr}>{genderizeJob(job, gender)}</div>)}

        <div style={sectionHeaderStyle}>
          Définition
        </div>
        <Markdown content={jobExploration.jobGroup && jobExploration.jobGroup.description} />

        <div style={sectionHeaderStyle}>
          Accès à l'emploi/métier
        </div>
        <Markdown content={jobExploration.jobGroup && jobExploration.jobGroup.requirementsText} />

        <div style={sectionHeaderStyle}>
          Conditions d'exercice de l'activité
        </div>
        <Markdown content={jobExploration.jobGroup && jobExploration.jobGroup.workingEnvironment} />

        <div style={sectionHeaderStyle}>
          Environnements de travail
        </div>
        <div style={{color: Colors.CHARCOAL_GREY, display: 'flex', lineHeight: 1.69}}>
          <KeywordList jobGroupInfo={jobExploration.jobGroup} field="structures" title="Structures"
            style={{flex: 1}} />

          <div style={verticalLineStyle} />

          <KeywordList jobGroupInfo={jobExploration.jobGroup} field="sectors" title="Secteurs"
            style={{flex: 1}} />

          <div style={verticalLineStyle} />

          <KeywordList jobGroupInfo={jobExploration.jobGroup} field="conditions" title="Conditions"
            style={{flex: 1}} />
        </div>

      </div>
      <div style={{backgroundColor: Colors.BACKGROUND_GREY, padding: 15, textAlign: 'center'}}>
        <RoundButton type="validation" onClick={this.handleCreateProject}>
          Ajouter un projet à partir de ce métier
        </RoundButton>
      </div>
    </div></Modal>
  }
}
const JobGroupModal = connect(({app, asyncState, user}, {city, jobGroup}) => {
  const romeId = jobGroup && jobGroup.romeId || ''
  const cityId = city && city.cityId || ''
  return {
    gender: user.profile.gender,
    isFetching: !!asyncState.isFetching[GET_DISCOVERY_JOB_GROUP_DATA],
    jobExploration: app.jobGroupStats[romeId + ':' + cityId] || {jobGroup},
  }
})(JobGroupModalBase)



class KeywordList extends React.Component {
  static propTypes = {
    field: React.PropTypes.string.isRequired,
    jobGroupInfo: React.PropTypes.object,
    title: React.PropTypes.node,
  }

  render() {
    const subSectionHeaderStyle = {
      color: Colors.CHARCOAL_GREY,
      fontWeight: 'bold',
      lineHeight: 1.69,
    }
    const simpleListStyle = {
      listStyle: 'none',
      margin: 0,
      padding: 0,
    }
    const {field, jobGroupInfo, title, ...extraProps} = this.props
    const keywords = jobGroupInfo && jobGroupInfo.workEnvironmentKeywords &&
      jobGroupInfo.workEnvironmentKeywords[field] || []
    return <div {...extraProps}>
      <div style={subSectionHeaderStyle}>{title}</div>
      <ul style={simpleListStyle}>
        {keywords.map(structure => <li key={structure}>{structure}</li>)}
      </ul>
    </div>
  }
}

export {DiscoveryPage}
