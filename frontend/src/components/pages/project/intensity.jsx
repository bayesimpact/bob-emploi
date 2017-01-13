import React from 'react'

import {ShortKey} from 'components/shortkey'
import {Modal} from 'components/modal'
import {Icon, RoundButton, Colors, Styles} from 'components/theme'


const LEVEL_OPTIONS = [
  {
    name: 'Réflexion',
    text: <span>
      <strong>1 à 3</strong> actions pour <strong>affiner votre projet</strong>
    </span>,
    value: 'PROJECT_FIGURING_INTENSITY',
  },
  {
    name: 'Modéré',
    text: <span>
      <strong>2 à 4</strong> actions pour <strong>relancer votre recherche</strong>
    </span>,
    value: 'PROJECT_NORMALLY_INTENSE',
  },
  {
    name: 'À fond',
    text: <span>
      <strong>3 à 5</strong> actions pour <strong>accélérer votre recherche</strong>
    </span>,
    value: 'PROJECT_PRETTY_INTENSE',
  },
  {
    name: 'Extrême',
    text: <span>
      <strong>4 à 6</strong> actions pour <strong>booster à fond votre recherche</strong>
    </span>,
    value: 'PROJECT_EXTREMELY_INTENSE',
  },
]


class IntensityChangeButton extends React.Component {
  static propTypes = {
    projectIntensity: React.PropTypes.string,
    style: React.PropTypes.object,
  }

  render() {
    const {projectIntensity, style, ...otherProps} = this.props
    const leftButtonStyle = {
      alignItems: 'center',
      backgroundImage: `linear-gradient(to bottom, ${Colors.CHARCOAL_GREY}, ${Colors.DARK})`,
      borderBottomLeftRadius: 100,
      borderTopLeftRadius: 100,
      boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.11)',
      display: 'flex',
      fontSize: 14,
      fontWeight: 'bold',
      height: 41,
      justifyContent: 'space-between',
      paddingLeft: 22,
      paddingRight: 16,
      textTransform: 'uppercase',
      width: 165,
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    const rightButtonStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      borderBottomRightRadius: 100,
      borderTopRightRadius: 100,
      boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.11)',
      color: Colors.SLATE,
      display: 'flex',
      height: 41,
      paddingLeft: 18,
      paddingRight: 30,
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    const level = LEVEL_OPTIONS.find(level => level.value === projectIntensity)
    return <div {...otherProps} style={{cursor: 'pointer', display: 'flex', ...style}}>
      <div style={leftButtonStyle}>
        <span>{level.name}</span>
        <Icon name="menu-down" style={{color: Colors.SKY_BLUE, paddingBottom: '.5em'}} />
      </div>
      <div style={rightButtonStyle}>
        <div>{level.text}</div>
      </div>
    </div>
  }
}


class IntensityModal extends React.Component {
  static propTypes = {
    isShown: React.PropTypes.bool,
    onChange: React.PropTypes.func.isRequired,
    onClose: React.PropTypes.func,
    projectIntensity: React.PropTypes.string,
  }

  render() {
    const {isShown, onChange, onClose, projectIntensity} = this.props
    const modalStyle = {
      width: 800,
      ...Styles.CENTERED_COLUMN,
    }
    const explanationLinkStyle = {
      color: Colors.COOL_GREY,
      cursor: 'pointer',
      fontSize: 14,
      textAlign: 'center',
    }
    return <Modal isShown={isShown} onClose={onClose} style={modalStyle}>
      <Header />
      <LevelSelector onChange={onChange} projectIntensity={projectIntensity} />
      <div className="tooltip" style={{paddingBottom: 30}}>
        <span style={explanationLinkStyle}>
          Comment choisir le bon objectif ?
        </span>
        <div className="tooltiptext">
          <Explanation style={{width: 436}} />
        </div>
      </div>
    </Modal>
  }
}


class Header extends React.Component  {

  render() {
    const style = {
      padding: '32px 0',
      width: 600,
      ...Styles.CENTERED_COLUMN,
    }
    const headingStyle = {
      color: Colors.CHARCOAL_GREY,
      fontSize: 23,
      fontWeight: 500,
      lineHeight: 1.3,
      textAlign: 'center',
    }
    const noticeStyle = {
      color: Colors.DARK_TWO,
      fontSize: 14,
      lineHeight: 1.5,
      marginTop: 9,
      textAlign: 'center',
      width: 640,
    }
    return <div style={style}>
      <div style={headingStyle}>Choisir votre objectif quotidien</div>
      <div style={noticeStyle}>
        Nous allons maintenant définir avec vous un plan d'action pour booster
        votre recherche d'emploi. Tout d'abord, choisissez le nombre d'actions
        que vous souhaitez recevoir par jour.
      </div>
    </div>
  }
}


class LevelSelector extends React.Component {
  static propTypes = {
    onChange: React.PropTypes.func.isRequired,
    projectIntensity: React.PropTypes.string,
  }

  constructor(props) {
    super(props)
    this.state = {
      preselection: props.projectIntensity || 'PROJECT_PRETTY_INTENSE',
    }
  }

  fastForward = () => {
    this.props.onChange(this.state.preselection)
  }

  render() {
    const {onChange, projectIntensity} = this.props
    const {preselection} = this.state
    const separatorStyle = {
      backgroundColor: Colors.BACKGROUND_GREY,
      border: 'none',
      height: 1,
      marginLeft: 30,
      width: 600,
    }
    return <div style={{paddingBottom: 30}}>
      <ShortKey keyCode="KeyF" ctrlKey={true} shiftKey={true} onKeyPress={this.fastForward} />
      {LEVEL_OPTIONS.map((intensityLevel, i) => {
        // TODO: Don't show the separator when hovered.
        return <div key={intensityLevel.value}>
          <IntensityLevel
              isSelected={projectIntensity === intensityLevel.value}
              isPreselected={preselection === intensityLevel.value}
              name={intensityLevel.name} key={intensityLevel.value}
              text={intensityLevel.text}
              onHover={() => this.setState({preselection: intensityLevel.value})}
              onSelect={() => onChange(intensityLevel.value)} />
          {i < LEVEL_OPTIONS.length - 1 ? <div style={separatorStyle} /> : null}
        </div>
      })}
    </div>
  }
}

class IntensityLevel extends React.Component {
  static propTypes = {
    isPreselected: React.PropTypes.bool,
    isSelected: React.PropTypes.bool,
    name: React.PropTypes.string.isRequired,
    onHover: React.PropTypes.func,
    onSelect: React.PropTypes.func.isRequired,
    text: React.PropTypes.node.isRequired,
  };

  state = {
    isHovered: false,
  }

  handleHover = () => {
    const {onHover} = this.props
    this.setState({isHovered: true})
    if (onHover) {
      onHover()
    }
  }

  render() {
    const {isSelected, name, text, onSelect} = this.props
    const {isHovered} = this.state
    const isPreselected = !isHovered && !isSelected && this.props.isPreselected
    const style = {
      alignItems: 'center',
      border: isHovered ? '1px solid ' + Colors.SILVER : '1px solid #fff',
      borderRadius: 4,
      color: Colors.CHARCOAL_GREY,
      display: 'flex',
      height: 70,
      width: 660,
    }
    const nameStyle = {
      fontSize: 14,
      fontWeight: 'bold',
      paddingLeft: 30,
      width: 130,
    }
    const numRangeStyle = {
      flex: 1,
      fontSize: 13,
    }
    const buttonBoxStyle = {
      paddingRight: 30,
      width: 195,
    }
    const isButtonVisible = isHovered || isSelected || isPreselected
    const buttonType = !isSelected ? 'validation' : undefined
    return <div
        style={style}
        onMouseOver={this.handleHover}
        onMouseOut={() => this.setState({isHovered: false})}>
      <div style={nameStyle}>{name}</div>
      <div style={numRangeStyle}>{text}</div>
      {isButtonVisible ? <div style={buttonBoxStyle}>
        <RoundButton style={{width: 165}} onClick={onSelect} isNarrow={true} type={buttonType}>
          {isSelected ? 'Objectif actuel' : 'Choisir cet objectif'}
        </RoundButton>
      </div> : null}
    </div>
  }
}


class Explanation extends React.Component {
  static propTypes = {
    style: React.PropTypes.object,
  }

  render() {
    const explanationStyle = {
      backgroundColor: '#fff',
      color: Colors.DARK,
      fontSize: 14,
      padding: '30px 40px',
      textAlign: 'left',
      ...this.props.style,
    }
    return <div style={explanationStyle}>
      <strong>Candidatures : privilégiez la qualite à la quantité !</strong>
      <div style={{marginBottom: 10}}>
        Vous vous épuiserez moins et vous aurez de meilleurs retours de la part
        des recruteurs.
      </div>
      <strong>Fixez-vous des objectifs quotidiens</strong>
      <div style={{marginBottom: 10}}>
        Gardez le rythme et finissez la journee avec le sentiment du devoir accompli !
      </div>
      <strong>N'oubliez pas de prendre du temps pour vous</strong>
      <div>
        Vous n'avez pas à culpabiliser de prendre du temps pour vous !
      </div>
      <div style={{marginBottom: 10}}>
        Profitez de votre temps libre — vous n'en serez que plus efficace dans votre recherche.
      </div>
    </div>
  }
}


export {IntensityChangeButton, IntensityModal}
