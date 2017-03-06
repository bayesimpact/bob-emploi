import React from 'react'
import Radium from 'radium'

import {ChantierKind} from 'api/chantier'
import {Modal, ModalCloseButton} from 'components/modal'
import {Colors, Icon, RoundButton, SmoothTransitions} from 'components/theme'
import {ShortKey} from 'components/shortkey'
import {KIND_ICON_SRC} from 'components/chantier'


const CHANTIER_SHAPE = React.PropTypes.shape({
  chantierId: React.PropTypes.string.isRequired,
  kind: React.PropTypes.oneOf(Object.keys(ChantierKind)).isRequired,
  title: React.PropTypes.string,
})

const KIND_TITLES = {
  IMPROVE_SUCCESS_RATE: {
    modalTitle: 'Pour booster vos candidatures',
    source: "enquêtes Bayes Impact sur les demandeurs d'emploi",
    suggest: 'Voici nos suggestions pour améliorer le succès de vos candidatures et de vos ' +
      'entretiens.',
    title: {
      NOT_NEEDED: "Vos candidatures ont l'air de faire mouche, explorez comment les rendre " +
        'encore meilleures',
      REALLY_NEEDED: 'Vous avez besoin de travailler sur vos candidatures',
      SOMEHOW_NEEDED: 'Vous pouvez booster davantage vos candidatures',
    },
  },
  INCREASE_AVAILABLE_OFFERS: {
    modalTitle: "Pour avoir accès à plus d'offres",
    source: 'analyse en temps réel des annonces Pôle Emploi',
    suggest: "Voici nos suggestions pour obtenir de plus en plus d'offres d'emploi.",
    title: {
      NOT_NEEDED: 'Votre recherche correspond bien au marché, pas besoin de changer vos critères',
      REALLY_NEEDED: "Vous auriez accès à beaucoup plus d'offres en changeant certains de vos " +
        'critères',
      SOMEHOW_NEEDED: "Vous auriez accès à plus d'offres en changeant certains de vos critères",
    },
  },
  UNLOCK_NEW_LEADS: {
    modalTitle: "Pour explorer d'autres pistes",
    source: 'enquêtes Bayes Impact, fichier administratif de Pôle Emploi (2016)',
    suggest: 'Voici nos suggestions pour vous ouvrir de nouvelles opportunités.',
    title: {
      NOT_NEEDED: 'Vous êtes dans un marché favorable, donnez tout',
      REALLY_NEEDED: "Vous êtes dans un marché difficile, ouvrez-vous à d'autres horizons",
      SOMEHOW_NEEDED: "Vous êtes dans un marché peu évident, gardez d'autres fenêtres ouvertes",
    },
  },
}


class ChantierCheckBox extends React.Component {
  static propTypes = {
    chantier: React.PropTypes.shape({
      template: CHANTIER_SHAPE,
      userHasStarted: React.PropTypes.bool,
    }).isRequired,
    onToggle: React.PropTypes.func.isRequired,
    selected: React.PropTypes.bool,
    style: React.PropTypes.object,
  }

  state = {
    isHovered: false,
  }

  render() {
    const {chantier, onToggle, selected, style} = this.props
    const {isHovered} = this.state
    const chantierStyle = {
      backgroundColor: '#fff',
      borderRadius: 3,
      boxShadow: isHovered ? '0 0 50px 0 rgba(0, 0, 0, 0.5)' : 'inherit',
      color: Colors.CHARCOAL_GREY,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 16,
      fontWeight: 'bold',
      height: 110,
      lineHeight: 1.2,
      position: 'relative',
      ...style,
      ...SmoothTransitions,
    }
    const checkStyle = {
      alignItems: 'center',
      backgroundColor: selected ? Colors.SKY_BLUE : Colors.MODAL_PROJECT_GREY,
      borderRadius: '3px 0 0 3px',
      color: selected ? '#fff' : Colors.COOL_GREY,
      display: 'flex',
      fontSize: 28,
      justifyContent: 'center',
      width: 81,
      ...SmoothTransitions,
    }
    const contentStyle = {
      backgroundColor: isHovered ? Colors.MODAL_PROJECT_GREY : 'inherit',
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '14px 19px',
      ...SmoothTransitions,
    }
    const incentiveStyle = {
      color: Colors.CHARCOAL_GREY,
      fontSize: 13,
      fontWeight: 'normal',
      lineHeight: 1.54,
      marginTop: 5,
    }
    const scoreStyle = {
      color: '#fff',
      fontSize: 13,
      fontWeight: 500,
      paddingTop: 4,
      position: 'absolute',
      right: 0,
      top: '100%',
    }
    return <li
        style={chantierStyle}
        onClick={onToggle}
        onMouseOver={() => this.setState({isHovered: true})}
        onMouseOut={() => this.setState({isHovered: false})}>
      <div style={checkStyle}>
        <Icon name={selected ? 'check' : 'checkbox-blank-circle-outline'} />
      </div>
      <div style={contentStyle}>
        {chantier.template.title}
        <div style={incentiveStyle}>
          {chantier.template.incentive}
        </div>
      </div>
      {chantier.additionalJobOffersPercent ? <span style={scoreStyle}>
        +{chantier.additionalJobOffersPercent.toFixed(0)}% d'offres
      </span> : null}
    </li>
  }
}


class PotentialChantiersGroupModal extends React.Component {
  static propTypes = {
    defaultSelected: React.PropTypes.object.isRequired,
    isShown: React.PropTypes.bool,
    onClose: React.PropTypes.func,
    onSubmit: React.PropTypes.func.isRequired,
    potentialChantiers: React.PropTypes.arrayOf(React.PropTypes.shape({
      template: CHANTIER_SHAPE,
      userHasStarted: React.PropTypes.bool,
    })).isRequired,
    source: React.PropTypes.string.isRequired,
    style: React.PropTypes.object,
    suggest: React.PropTypes.node,
    title: React.PropTypes.node,
  }

  componentWillMount() {
    const {defaultSelected, potentialChantiers} = this.props
    const selected = {}
    potentialChantiers.forEach(chantier =>
      selected[chantier.template.chantierId] = (!!defaultSelected[chantier.template.chantierId]))
    this.setState({selected})
  }

  toggle = chantier => {
    this.setState({
      selected: {
        ...this.state.selected,
        [chantier.template.chantierId]: !this.state.selected[chantier.template.chantierId],
      },
    })
  }

  render() {
    const {isShown, potentialChantiers, onClose, onSubmit, source, style, suggest, title,
           ...extraProps} = this.props
    const {selected} = this.state
    if (!potentialChantiers.length) {
      return null
    }
    const numActivatedChantiers = potentialChantiers.
      filter(chantier => selected[chantier.template.chantierId]).length
    const maybeS = numActivatedChantiers > 1 ? 's' : ''
    const modalStyle = {
      backgroundColor: Colors.CHARCOAL_GREY,
      display: 'flex',
      height: '100%',
      width: '100%',
      ...style,
    }
    const closeButtonStyle = {
      color: '#fff',
      cursor: 'pointer',
      padding: 5,
      position: 'absolute',
      right: 45,
      top: 45,
    }
    const leftPaneStyle = {
      alignItems: 'center',
      backgroundColor: Colors.DARK,
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      fontSize: 15,
      fontWeight: 500,
      justifyContent: 'center',
      position: 'relative',
      width: 260,
    }
    const buttonStyle = {
      bottom: 50,
      position: 'absolute',
    }
    const bigNumberStyle = {
      color: numActivatedChantiers ? Colors.GREENISH_TEAL : Colors.CHARCOAL_GREY,
      fontSize: 150,
      fontWeight: 'bold',
      marginBottom: '-.5em',
    }
    const rightPaneStyle = {
      color: '#fff',
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      fontWeight: 'normal',
      padding: '58px 100px',
    }
    const headerStyle = {
      fontSize: 30,
      fontWeight: 'bold',
    }
    const instructionStyle = {
      fontSize: 14,
      lineHeight: 1.36,
      marginBottom: 27,
      marginTop: 55,
      opacity: .5,
    }
    const listStyle = {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      listStyle: 'none',
      margin: 0,
      overflowX: 'visible',
      overflowY: 'auto',
      padding: '0 17px 0 0',
    }
    const checkBoxStyle = {
      marginBottom: 50,
      width: 480,
    }
    return <Modal {...extraProps} isShown={isShown} style={modalStyle}>
      <ModalCloseButton
          closeOnEscape={isShown} onClick={onClose} style={closeButtonStyle} />
      <div style={leftPaneStyle}>
        <div style={bigNumberStyle}>
          {numActivatedChantiers}
        </div>
        <div>solution{maybeS} sélectionnée{maybeS}</div>
        <RoundButton type="validation" style={buttonStyle} onClick={() => onSubmit(selected)}>
          Valider ma sélection
        </RoundButton>
      </div>

      <div style={rightPaneStyle}>
        <header style={headerStyle}>{title}</header>
        <div style={{color: Colors.MODAL_PROJECT_GREY, fontSize: 17, marginTop: 23}}>{suggest}</div>
        <div style={{color: Colors.MODAL_PROJECT_GREY, fontSize: 17}}>Sources: {source}</div>
        <div style={instructionStyle}>
          Sélectionnez une ou plusieurs solutions et nous vous proposerons
          chaque jour des actions précises pour les mettre en oeuvre.
        </div>

        <ol style={listStyle}>
          {potentialChantiers.map(chantier =>
            <ChantierCheckBox
                key={chantier.template.chantierId} style={checkBoxStyle}
                chantier={chantier} selected={selected[chantier.template.chantierId]}
                onToggle={() => this.toggle(chantier)} />)}
        </ol>

        <div style={{flex: 1}} />
      </div>
    </Modal>
  }
}

class PotentialChantiersGroupBase extends React.Component {
  static propTypes = {
    iconSrc: React.PropTypes.string.isRequired,
    isFirstTime: React.PropTypes.bool,
    modalTitle: React.PropTypes.string,
    onUpdateSelection: React.PropTypes.func,
    potentialChantiers: React.PropTypes.arrayOf(React.PropTypes.shape({
      template: CHANTIER_SHAPE,
      userHasStarted: React.PropTypes.bool,
    })).isRequired,
    selected: React.PropTypes.object,
    style: React.PropTypes.object,
    title: React.PropTypes.node,
  }

  componentWillMount() {
    this.setState({
      isFirstTime: !!this.props.isFirstTime,
      isModalShown: false,
    })
  }

  handleSubmitModal = newSelection => {
    const {onUpdateSelection} = this.props
    this.setState({isFirstTime: false, isModalShown: false})
    onUpdateSelection && onUpdateSelection(newSelection)
  }

  render() {
    const {iconSrc, modalTitle, potentialChantiers, selected, style, title} = this.props
    if (!potentialChantiers.length) {
      return null
    }
    const activatedChantiers = potentialChantiers.
      filter(chantier => selected[chantier.template.chantierId])
    const maybeS = activatedChantiers.length > 1 ? 's' : ''
    const containerStyle = {
      backgroundColor: '#fff',
      borderRadius: 4,
      boxShadow: '0 0 25px 0 rgba(0, 0, 0, 0.08)',
      color: Colors.COOL_GREY,
      fontSize: 16,
      lineHeight: 1.2,
      padding: 30,
      position: 'relative',
      textAlign: 'left',
      ...style,
    }
    const headerStyle = {
      color: Colors.SLATE,
      fontSize: 19,
      fontWeight: 'bold',
    }
    const countStyle = {
      color: Colors.GREENISH_TEAL,
      fontWeight: 500,
      marginTop: 5,
    }
    const itemStyle = {
      fontSize: 18,
      fontWeight: 'normal',
      lineHeight: '31px',
      minHeight: 31,
    }
    const buttonStyle = {
      ':focus': {
        backgroundColor: Colors.SKY_BLUE_HOVER,
      },
      ':hover': {
        backgroundColor: Colors.SKY_BLUE_HOVER,
      },
      backgroundColor: Colors.SKY_BLUE,
      border: 'none',
      borderRadius: 2,
      bottom: 20,
      color: '#fff',
      cursor: 'pointer',
      fontSize: 14,
      fontWeight: 'bold',
      padding: '12px 14px 10px',
      position: 'absolute',
      right: 20,
    }
    const groupIconStyle = {
      marginRight: 40,
      position: 'absolute',
      right: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
    }
    return <section style={containerStyle}>
      <header style={headerStyle}>Diagnostic : {title}</header>
      <div style={countStyle}>
        {activatedChantiers.length} solution{maybeS} sélectionnée{maybeS}
        {this.state.isFirstTime ?
          (activatedChantiers.length ?
            '. Nous vous aiderons à :' :
            ". Vous n'avez pas besoin d'avancer sur ce point a priori.") : '.'}
      </div>
      <ol style={{listStyle: 'disc', marginBottom: 30, marginTop: 20, paddingLeft: '1em'}}>
        {activatedChantiers.slice(0, 3).map(chantier => <li
            key={chantier.template.chantierId} style={itemStyle}>
          {chantier.template.title}
        </li>)}
        {activatedChantiers.length <= 3 ? null : <li style={{...itemStyle, listStyle: 'none'}}>
          <a
              onClick={() => this.setState({isModalShown: true})}
              style={{cursor: 'pointer', textDecoration: 'underline'}}>
            + {activatedChantiers.length - 3} autre{activatedChantiers.length > 4 ? 's' : ''}
          </a>
        </li>}
      </ol>

      {/* TODO: Use SettingsButton here */}
      <button style={buttonStyle} key="open" onClick={() => this.setState({isModalShown: true})}>
        <Icon name="settings" /> Affiner la sélection
      </button>

      <img src={iconSrc} style={groupIconStyle} />

      <PotentialChantiersGroupModal
          {...this.props} isShown={this.state.isModalShown} defaultSelected={selected}
          onClose={() => this.setState({isModalShown: false})}
          onSubmit={this.handleSubmitModal} style={{}} title={modalTitle || title} />
    </section>
  }
}
const PotentialChantiersGroup =Radium(PotentialChantiersGroupBase)


class PotentialChantiersLists extends React.Component {
  static propTypes = {
    isFirstTime: React.PropTypes.bool,
    isIntensitySet: React.PropTypes.bool,
    onDone: React.PropTypes.func,
    onUpdateSelection: React.PropTypes.func,
    potentialChantiers: React.PropTypes.object.isRequired,
    style: React.PropTypes.object,
    submitCaption: React.PropTypes.string,
  }

  componentWillMount() {
    const {potentialChantiers} = this.props
    const areChantiersSelected = {};
    (potentialChantiers.chantiers || []).forEach(chantier => {
      if (chantier.userHasStarted) {
        areChantiersSelected[chantier.template.chantierId] = true
      }
    })
    this.setState({areChantiersSelected})
  }

  isSelectionModified = () => {
    const {areChantiersSelected} = this.state
    var isModified = false;
    (this.props.potentialChantiers.chantiers || []).forEach(chantier => {
      if (!!areChantiersSelected[chantier.template.chantierId] !== !!chantier.userHasStarted) {
        isModified = true
      }
    })
    return isModified
  }

  update = () => {
    if (this.props.isFirstTime || this.isSelectionModified()) {
      const {onUpdateSelection} = this.props
      onUpdateSelection && onUpdateSelection(this.state.areChantiersSelected)
    }
  }

  handleSubmit = () => {
    this.update()
    const {onDone} = this.props
    onDone && onDone()
  }

  handleUpdatePartialSelection = newChantiersSelection => {
    const {areChantiersSelected} = this.state
    this.setState({areChantiersSelected: {
      ...areChantiersSelected,
      ...newChantiersSelection,
    }}, () => {
      if (!this.props.isFirstTime) {
        this.update()
      }
    })
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {isFirstTime, isIntensitySet, onDone, onUpdateSelection,
           potentialChantiers, style, submitCaption,
           ...extraProps} = this.props
    // We do not use onUpdateSelection but we do not want it in extraProps either.
    onUpdateSelection
    const {areChantiersSelected} = this.state
    const chantiersOfKind = kind => (potentialChantiers.chantiers || []).
      filter(chantier => chantier.template.kind === kind)
    const containerStyle = {
      margin: 'auto',
      ...style,
    }
    const groups = potentialChantiers.groups.filter(group => chantiersOfKind(group.kind).length)
    return <div style={containerStyle} {...extraProps}>
      {isIntensitySet ?
        <ShortKey keyCode="KeyF" ctrlKey={true} shiftKey={true} onKeyPress={this.handleSubmit} />
      : null}
      {groups.map(group => <PotentialChantiersGroup
          title={KIND_TITLES[group.kind].title[group.need]}
          modalTitle={KIND_TITLES[group.kind].modalTitle}
          key={group.kind} iconSrc={KIND_ICON_SRC[group.kind]}
          source={KIND_TITLES[group.kind].source}
          suggest={KIND_TITLES[group.kind].suggest}
          isFirstTime={isFirstTime}
          potentialChantiers={chantiersOfKind(group.kind)}
          selected={areChantiersSelected}
          onUpdateSelection={this.handleUpdatePartialSelection}
          style={{margin: '0 auto 30px', width: 590}} />)}
      <RoundButton onClick={this.handleSubmit} type="validation" style={{margin: '20px 0 50px'}}>
        {submitCaption || 'Enregistrer'}
      </RoundButton>
    </div>
  }
}


export {PotentialChantiersLists}
