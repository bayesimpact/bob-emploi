import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import cyrilleImage from 'images/people/cyrille.png'
import joannaImage from 'images/people/joanna.jpg'
import johnImage from 'images/people/john.png'
import margauxImage from 'images/people/margaux.png'
import marielaureImage from 'images/people/marie-laure.png'
import nicolasImage from 'images/people/nicolas.jpg'
import pascalImage from 'images/people/pascal.png'
import paulImage from 'images/people/paul.png'

import facebookGrayIcon from 'images/share/facebook-gray-ico.svg'
import facebookIcon from 'images/share/facebook-ico.svg'
import linkedinGrayIcon from 'images/share/linkedin-gray-ico.svg'
import linkedinIcon from 'images/share/linkedin-ico.svg'
import twitterGrayIcon from 'images/share/twitter-gray-ico.svg'
import twitterIcon from 'images/share/twitter-ico.svg'

import {isMobileVersion} from 'components/mobile'
import {ModalCloseButton} from 'components/modal'
import {StaticPage, TitleSection} from 'components/static'
import {ExternalLink, MAX_CONTENT_WIDTH, MIN_CONTENT_PADDING,
  SmoothTransitions} from 'components/theme'


const paulBio = {
  description: "Avant de fonder Bayes Impact en 2014, Paul était un data scientist à Eventbrite, \
    où il écrivait des algorithmes ainsi que des mauvais jeux de mots (ce dernier point n'a pas \
    trop changé). Il a étudié un mélange bizarre de mathématiques, d'économie et de sciences \
    politiques à Berkeley, Sciences Po et la Sorbonne.",
  education: 'UC Berkeley, Sciences Po, Université Paris 1',
  experience: 'Data Scientist à Eventbrite',
  linkedin: 'https://www.linkedin.com/in/pyduan',
  twitter: 'https://twitter.com/pyduan',
}

const margauxBio = {
  description: "Margaux a travaillé pour des startups à but non lucratif au Ghana et aux \
    Etats-Unis. Elle adore l'Islande, rendre le monde meilleur et ne dit jamais non à un bon pain \
    au chocolat.",
  education: 'Hult Business school San Francisco, Université Paris - Dauphine',
  experience: 'Developement Associate à Epic Foundation New York',
  linkedin: 'https://www.linkedin.com/in/margauxsalzman/',
  twitter: 'https://twitter.com/margauxsalzman',
}

const pascalBio = {
  description: "Pascal a commencé à programmer quand il avait huit ans et n'a jamais vraiment \
    arrêté, ou juste le temps de dormir un peu. Avant de rejoindre l'équipe, il était Staff \
    Software Engineer chez Google où il était connu pour son leadership par l'exemple. Il adore \
    les enfants (il en a d'ailleurs beaucoup), et va au boulot en rollers.",
  education: 'École Polytechnique, Télécoms Paris',
  experience: 'Tech Lead Manager Google Maps, Ministère de la Défense',
  linkedin: 'https://www.linkedin.com/in/pascalcorpet/',
  twitter: 'https://twitter.com/pascalcorpet',
}

const marielaureBio = {
  description: "Marie Laure a fait de la recherche académique et s'est spécialisée dans l'analyse \
    de données dans le domaine de la santé. Elle est toujours enchantée de découvrir d'obscurs \
    romans dystopiques et ne refusera jamais une rencontre sur un terrain de basket-ball.",
  education: 'Université Paris-Sud',
  experience: 'Développeur web à Symbiosis Technologies, Senior Postdoctoral Fellow à Inserm, \
    Postdoctoral Fellow à INRA',
  linkedin: 'https://fr.linkedin.com/in/ml-endale-07110713b',
}

const johnBio = {
  description: "Depuis qu'il est enfant John est absolument passionné par le design et les \
    interfaces. Il a commencé le design à 14 ans en faisant des covers pour DVDs qu'il partageait \
    en ligne. Il voue un culte très particulier pour la symétrie qui l'inspire au quotidien. \
    Véritable Français accompli il adore évidemment le vin et le fromage.",
  education: "Hetic (Hautes études des technologies de l'information et de la communication)",
  experience: 'Responsable du design à SMACH, Responsable du design à Wipolo, UX Designer \
    freelance pendant 5 ans',
  linkedin: 'https://www.linkedin.com/in/johnmetois/',
  twitter: 'https://twitter.com/serialkimi',
}

const cyrilleBio = {
  description: "Cyrille a fait de la recherche en mathématiques jusqu'à ce qu'il se rende compte \
    que ça n'avait pas vraiment d'impact, et décide de se rendre utile. Il aime les jeux de \
    société, surtout coopératifs, et partir marcher ou faire de l'escalade si le temps le permet.",
  education: 'École Normale Supérieure, Paris',
  experience: 'Développeur web à Kreactive',
  linkedin: 'https://www.linkedin.com/in/cyrillecorpet',
}

const nicolasBio = {
  description: 'Nicolas a pu travailler dans différentes agences de \
    communication, aussi bien sur des problématiques de réputation digitale, de \
    gestion de crise ou de relations presse. Durant son cursus universitaire, il \
    a étudié la science politique ainsi que la communication politique et \
    institutionnelle. Passionné de mode et de politique française, il adore \
    également découvrir et faire découvrir de nouveaux restaurants.',
  education: 'Sciences-Po Toulouse, La Sorbonne',
  experience: "Consultant en communication d'influence et relations presse dans \
    différentes agences",
  linkedin: 'https://www.linkedin.com/in/nicolasdivet/',
  twitter: 'https://twitter.com/nicolasdivet',
}

const joannaBio = {
  description: "Joanna a étudié le français à Cambridge et est accro à la France depuis lors. \
    Elle aime le design pour l'accessibilité, les podcasts avec de bonnes histoires, \
    la London Review of Books et elle ne dit jamais non à une tasse de thé.",
  education: 'University of Cambridge, Sciences-Po Paris',
  experience: 'Halgo, Qobuz, Apple',
  linkedin: 'https://www.linkedin.com/in/joannabeaufoy/',
}

const allPersons = [
  {bio: paulBio, name: 'Paul Duan', picture: paulImage, position: 'Président'},
  {bio: pascalBio, name: 'Pascal Corpet', picture: pascalImage, position: 'Directeur technique'},
  {bio: margauxBio, name: 'Margaux Salzman', picture: margauxImage,
    position: 'Responsable des opérations'},
  {bio: marielaureBio, name: 'Marie Laure Endale Ahanda', picture: marielaureImage,
    position: 'Ingénieure logiciel'},
  {bio: johnBio, name: 'John Métois', picture: johnImage, position: 'Designer UX'},
  {bio: cyrilleBio, name: 'Cyrille Corpet', picture: cyrilleImage,
    position: 'Ingénieur logiciel'},
  {bio: nicolasBio, name: 'Nicolas Divet', picture: nicolasImage,
    position: 'Chargé de communication'},
  {bio: joannaBio, name: 'Joanna Beaufoy', picture: joannaImage,
    position: 'Responsable contenu et soutien des utilisateurs'},
]

class EmptyPersonTile extends React.Component {

  getTileSize() {
    return {height: 340, width: 320}
  }

  render() {
    return <div style={this.getTileSize()} />
  }
}


class PersonTileBase extends EmptyPersonTile {
  static propTypes = {
    isSelected: PropTypes.bool.isRequired,
    name: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
    picture: PropTypes.string.isRequired,
    position: PropTypes.string.isRequired,
  }

  render() {
    const {isSelected, name, onClick, position, picture} = this.props
    const boxShadow = '0 12px 25px 0 rgba(0, 0, 0, 0.15)'
    const personStyle = {
      ':hover': {
        boxShadow,
      },
      backgroundColor: '#fff',
      boxShadow: isSelected ? boxShadow : 'initial',
      color: colors.DARK,
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      textAlign: 'center',
      ...this.getTileSize(),
    }
    const descriptionStyle = {
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      height: 120,
      justifyContent: 'center',
    }
    const nameStyle = {
      fontSize: 21,
      fontWeight: 'bold',
    }
    const positionStyle = {
      fontSize: 14,
      fontWeight: 500,
      marginTop: 6,
    }

    return <div style={personStyle} onClick={onClick}>
      <img style={{display: 'block', width: '100%'}} src={picture} alt="" />
      <div style={descriptionStyle}>
        <div style={nameStyle}>{name}</div>
        <div style={positionStyle}>{position}</div>
      </div>
    </div>
  }
}
const PersonTile = Radium(PersonTileBase)


export default class TeamPage extends React.Component {
  state = {
    nbPersonInARow: isMobileVersion ? 1 : 3,
    showPersonBio: '',
  }

  setPersonBio(personName) {
    this.setState({showPersonBio: this.state.showPersonBio !== personName ? personName : ''})
  }

  renderPersonRow = (personRow, rowIndex) => {
    const {nbPersonInARow, showPersonBio} = this.state
    const rowStyle = {
      display: 'flex',
      justifyContent: nbPersonInARow > 1 ? 'space-between' : 'space-around',
      marginBottom: 70,
    }
    const fullPersonRow = personRow.concat(
      new Array(nbPersonInARow - personRow.length).fill(false))
    return <div key={`row-${rowIndex}`} style={rowStyle} >
      {fullPersonRow.map((person, index) => {
        const personIndex = rowIndex * nbPersonInARow + index
        const personKey = `person-${personIndex}`
        if (person) {
          return <PersonTile
            key={personKey}
            isSelected={showPersonBio === person.name}
            onClick={() => this.setPersonBio(person.name)} {...person} />
        }
        return <EmptyPersonTile key={personKey} />
      })}
    </div>
  }

  handleBioOpen = (bioDiv) => {
    if (bioDiv) {
      const clientHeight = document.documentElement.clientHeight
      const divRect = bioDiv.getBoundingClientRect()
      if (divRect.top < 0 || divRect.bottom > clientHeight) {
        window.scroll({behavior: 'smooth', top: window.scrollY + divRect.top - (clientHeight / 2)})
      }
    }
  }

  renderPersonList(personList) {
    const {nbPersonInARow, showPersonBio} = this.state
    return new Array(Math.ceil(personList.length / nbPersonInARow)).fill().
      map((unused, rowIndex) => personList.slice(
        rowIndex * nbPersonInARow, (rowIndex + 1) * nbPersonInARow)).
      map((personRow, rowIndex) => {
        return [
          this.renderPersonRow(personRow, rowIndex),
          <PersonBio
            key={`bio-${rowIndex}`}
            personRow={personRow}
            onClose={() => this.setPersonBio('')}
            onOpen={this.handleBioOpen}
            showPersonBio={showPersonBio} />,
        ]
      })
  }

  render() {
    const quoteStyle = {
      color: colors.DARK_TWO,
      fontSize: 18,
      lineHeight: 1.7,
      margin: isMobileVersion ? '30px auto 40px' : '60px auto 70px',
      maxWidth: 650,
      padding: '0 25px',
    }
    return <StaticPage style={{backgroundColor: '#fff'}} page="equipe">
      <TitleSection pageContent={{title: 'Notre équipe est déterminée à changer le monde'}} />
      <div style={{padding: `0 ${MIN_CONTENT_PADDING}px`}}>
        <div style={{margin: '0px auto', maxWidth: MAX_CONTENT_WIDTH}}>
          <div style={quoteStyle}>
            Nous sommes une petite équipe convaincue que la technologie peut être utilisée pour des
            choses qui ont du sens, pas juste pour faire du profit.<br />
            <br />
            C'est pourquoi nous avons construit <strong>{config.productName}</strong> et créé{' '}
            <ExternalLink
              style={{color: colors.DARK_TWO, fontWeight: 'bold', textDecoration: 'none'}}
              href="http://www.bayesimpact.org">
              Bayes&nbsp;Impact
            </ExternalLink>, une association à but non lucratif, afin de la mettre au service
            de chacun.
          </div>
          {this.renderPersonList(allPersons)}
        </div>
      </div>
    </StaticPage>
  }
}


class PersonBio extends React.Component {
  static propTypes = {
    onClose: PropTypes.func.isRequired,
    onOpen: PropTypes.func.isRequired,
    personRow: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string.isRequired,
    }).isRequired).isRequired,
    showPersonBio: PropTypes.string,
  }

  state = {
    isOpen: false,
    person: null,
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    const {personRow, showPersonBio} = nextProps
    const person = personRow.find(person => person.name === showPersonBio)
    const {person: prevPerson} = prevState
    if (person === prevPerson) {
      return null
    }
    if (person) {
      return {
        isOpen: true,
        person,
      }
    }
    return {isOpen: false}
  }

  componentDidMount() {
    const {onOpen} = this.props
    const {isOpen} = this.state
    if (isOpen) {
      onOpen(this.containerRef.current)
    }
  }

  componentDidUpdate(prevProps, prevState) {
    const {isOpen, person} = this.state
    if (prevState.isOpen === isOpen && prevState.person === person) {
      return
    }
    if (isOpen) {
      this.props.onOpen(this.containerRef.current)
    }
  }

  containerRef = React.createRef()

  renderSocialLinks(person) {
    const style = {
      margin: 35,
      textAlign: 'center',
    }
    return <div style={style}>
      {person.bio.linkedin ? this.renderSocialLink(
        'linkedin', linkedinIcon, linkedinGrayIcon, person.bio.linkedin) : null}
      {person.bio.twitter ? this.renderSocialLink(
        'twitter', twitterIcon, twitterGrayIcon, person.bio.twitter) : null}
      {person.bio.facebook ? this.renderSocialLink(
        'facebook', facebookIcon, facebookGrayIcon, person.bio.facebook) : null}
    </div>
  }

  renderSocialLink(shareId, icon, grayIcon, url) {
    const shareIdState = `is${shareId}IconHovered`
    const isHovered = this.state[shareIdState]
    const colorIconStyle = {
      opacity: isHovered ? 1 : 0,
      position: 'absolute',
      ...SmoothTransitions,
    }
    return <ExternalLink
      style={{cursor: 'pointer', margin: '0 5px', position: 'relative', textDecoration: 'none'}}
      onMouseEnter={() => this.setState({[shareIdState]: true})}
      onMouseLeave={() => this.setState({[shareIdState]: false})}
      href={url}>
      <img src={icon} style={colorIconStyle} alt="" />
      <img src={grayIcon} alt={shareId} />
    </ExternalLink>
  }

  render() {
    const {onClose} = this.props
    const {isOpen, person} = this.state
    const rowStyle = {
      marginBottom: isOpen ? 70 : 0,
      maxHeight: isOpen ? 600 : 0,
      opacity: isOpen ? 1 : 0,
      overflow: 'hidden',
      position: 'relative',
      textAlign: 'center',
      ...SmoothTransitions,
    }
    const hrStyle = {
      backgroundColor: colors.SILVER,
      border: 0,
      height: 2,
      marginBottom: 35,
      marginTop: 35,
      width: 63,
    }
    const descriptionStyle = {
      color: colors.DARK_TWO,
      fontSize: 16,
      lineHeight: 1.31,
      margin: 'auto',
      maxWidth: 500,
    }
    const closeStyle = {
      bottom: 'initial',
      boxShadow: '',
      fontSize: 10,
      height: 20,
      opacity: .6,
      transform: 'initial',
      width: 20,
    }
    return <div
      style={rowStyle} ref={this.containerRef}
      onTransitionEnd={isOpen ? null : () => this.setState({person: null})}>
      <ModalCloseButton onClick={onClose} style={closeStyle} />
      <div style={{color: colors.DARK, fontSize: 26}}>
        <strong>{person && person.name}</strong><br />
        <div style={{color: colors.WARM_GREY, fontSize: 14, fontStyle: 'italic', marginTop: 13}}>
        Études : {person && person.bio.education}<br />
        Expérience : {person && person.bio.experience}
        </div>
      </div>
      <hr style={hrStyle} />
      <div style={descriptionStyle}>{person && person.bio.description}</div>
      {person && this.renderSocialLinks(person)}
    </div>
  }
}
