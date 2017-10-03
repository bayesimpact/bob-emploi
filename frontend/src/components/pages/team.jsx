import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import headerImage from 'images/header-img.png'

import benoitImage from 'images/people/benoit.png'
import chemaImage from 'images/people/chema.png'
import cyrilleImage from 'images/people/cyrille.png'
import florianImage from 'images/people/florian.png'
import guillaumeImage from 'images/people/guillaume.png'
import johnImage from 'images/people/john.png'
import margauxImage from 'images/people/margaux.png'
import marielaureImage from 'images/people/marie-laure.png'
import pascalImage from 'images/people/pascal.png'
import paulImage from 'images/people/paul.png'

import facebookGrayIcon from 'images/share/facebook-gray-ico.svg'
import facebookIcon from 'images/share/facebook-ico.svg'
import linkedinGrayIcon from 'images/share/linkedin-gray-ico.svg'
import linkedinIcon from 'images/share/linkedin-ico.svg'
import twitterGrayIcon from 'images/share/twitter-gray-ico.svg'
import twitterIcon from 'images/share/twitter-ico.svg'

import {ModalCloseButton} from 'components/modal'
import {StaticPage} from 'components/static'
import {Colors, SmoothTransitions} from 'components/theme'


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

const florianBio = {
  description: "Florian était le premier ingénieur chez Box. Pendant les 8 années où il y a \
    travaillé, il a contribué à faire grandir l'équipe jusqu'à 1300 salariés. Il a l'accent \
    français le plus prononcé de l'équipe et on peut parfois le croiser dansant en lycra spandex \
    rose.",
  education: 'Université de Berkeley, École Polytechnique',
  experience: 'Premier ingénieur à Box, mentor à The Family',
  linkedin: 'https://www.linkedin.com/in/florianjourda/',
  twitter: 'https://twitter.com/florianjourda',
}

const pascalBio = {
  description: "Pascal a commencé à programmer quand il avait huit ans et n'a jamais vraiment \
    arrêté, ou juste le temps de dormir un peu. Avant de rejoindre l'équipe, il était Staff \
    Software Engineer chez Google où il était connu pour son leadership par l'exemple. Il adore \
    les enfants (il en a d'ailleurs beaucoup), et va au boulot en rollers.",
  education: 'École Polytechnique, Télécoms Paris',
  experience: 'Tech Lead Manager Google Maps, Ministère de la Défense',
  linkedin: 'https://www.linkedin.com/in/johnmetois/',
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

const benoitBio = {
  description: "Benoit est data scientist et ingénieur logiciel. Avant de rejoindre Bayes il a \
    notament travaillé sur les algorithmes de recommendations de musique chez Deezer. Il aime \
    marcher et faire du vélo, et le meilleur moyen d'avoir toute son attention  est probablement \
    de lui parler de charcuteries, fromages et de bières artisanales.",
  education: 'Télécom Bretagne',
  experience: 'Lead Data Architect à Deezer',
  linkedin: 'https://www.linkedin.com/in/mazben/',
  twitter: 'https://twitter.com/matben94',
}

const guillaumeBio = {
  description: "Guillaume s'est spécialisé en Intelligence Artificielle et optimisation. Il a fait \
    des programmes qui ont affronté des professionnels de Go pendant sa thèse, a travaillé sur \
    l'optimisation de YouTube, et la simplification de la législation fiscale pour le gouvernement \
    Français. Il aime dancer et faire du roller, simultanément de préférence.",
  education: 'Centrale Lille, Université Lille 1',
  experience: 'Ingénieur à Etalab, Google',
  linkedin: 'https://www.linkedin.com/in/guillaume-chaslot-6774b982/',
  twitter: 'https://twitter.com/GChaslot',
}

const cyrilleBio = {
  description: "Cyrille a fait de la recherche en mathématiques jusqu'à ce qu'il se rende compte \
    que ça n'avait pas vraiment d'impact, et décide de se rendre utile. Il aime les jeux de \
    société, surtout coopératifs, et partir marcher ou faire de l'escalade si le temps le permet.",
  education: 'École Normale Supérieure, Paris',
  experience: 'Développeur web à Kreactive',
  linkedin: 'https://www.linkedin.com/in/cyrillecorpet',
}

const chemaBio = {
  description: "Chema a précédemment travaillé à l'OCDE sur le développement du secteur privé, et \
    dans le conseil en management. Elle a une formation universitaire mixte en mathématiques, \
    économie et politiques publiques. Elle est une idéaliste passionnée, aime toute sorte de \
    musique, de Muse à Um Kalthoum et ne peut pas résister à une évasion en mer.",
  education: 'ENSIIE, Sciences Po, LSE',
  experience: "Management Consultant à Equinox Consulting et Policy Analyst à l'OCDE",
  facebook: 'https://www.facebook.com/chema.triki',
  linkedin: 'https://www.linkedin.com/in/chema-triki-670abb23/',
  twitter: 'https://twitter.com/ChemaTriki',
}

const allPersons = [
  {bio: paulBio, name: 'Paul Duan', picture: paulImage, position: 'Président'},
  {bio: margauxBio, name: 'Margaux Salzman', picture: margauxImage,
    position: 'Responsable des opérations'},
  {bio: florianBio, name: 'Florian Jourda', picture: florianImage, position: 'Product Manager'},
  {bio: pascalBio, name: 'Pascal Corpet', picture: pascalImage, position: 'Directeur technique'},
  {bio: marielaureBio, name: 'Marie Laure Endale Ahanda', picture: marielaureImage,
    position: 'Ingénieure logiciel'},
  {bio: johnBio, name: 'John Métois', picture: johnImage, position: 'Designer UX'},
  {bio: benoitBio, name: 'Benoit Mathieu', picture: benoitImage, position: 'Ingénieur logiciel'},
  {bio: guillaumeBio, name: 'Guillaume Chaslot', picture: guillaumeImage,
    position: 'Ingénieur logiciel'},
  {bio: chemaBio, name: 'Chema Triki', picture: chemaImage,
    position: 'Responsable développement'},
  {bio: cyrilleBio, name: 'Cyrille Corpet', picture: cyrilleImage,
    position: 'Ingénieur logiciel'},
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
      color: Colors.DARK,
      cursor: 'pointer',
      textAlign: 'center',
      ...this.getTileSize(),
    }
    const descriptionStyle = {
      display: 'flex',
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
      <img style={{display: 'block', height: 220, width: '100%'}} src={picture} alt="" />
      <div style={descriptionStyle}>
        <div style={nameStyle}>{name}</div>
        <div style={positionStyle}>{position}</div>
      </div>
    </div>
  }
}
const PersonTile = Radium(PersonTileBase)


class TeamPage extends React.Component {
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  state = {
    nbPersonInARow: 3,
    showPersonBio: '',
  }

  componentWillMount() {
    const {isMobileVersion} = this.context
    this.setState({nbPersonInARow: isMobileVersion ? 1 : 3})
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

  handleBioMounted = (bioDiv) => {
    if (bioDiv) {
      const clientHeight = document.documentElement.clientHeight
      const divRect = bioDiv.getBoundingClientRect()
      if (divRect.top < 0 || divRect.bottom > clientHeight) {
        window.scroll({behavior: 'smooth', top: window.scrollY + divRect.top - (clientHeight / 2)})
      }
    }
  }

  renderPersonBio = (personRow) => {
    const {showPersonBio} = this.state
    const person = personRow.find(person => person.name === showPersonBio)
    if (!person) {
      return null
    }
    const rowStyle = {
      marginBottom: 70,
      position: 'relative',
      textAlign: 'center',
    }
    const hrStyle = {
      backgroundColor: Colors.SILVER,
      border: 0,
      height: 2,
      marginBottom: 35,
      marginTop: 35,
      width: 63,
    }
    const descriptionStyle = {
      color: Colors.DARK_TWO,
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
    return <div style={rowStyle} ref={this.handleBioMounted}>
      <ModalCloseButton onClick={() => this.setPersonBio('')} style={closeStyle} />
      <div style={{color: Colors.DARK, fontSize: 26}}>
        <strong>{person.name}</strong><br />
        <div style={{color: Colors.WARM_GREY, fontSize: 14, fontStyle: 'italic', marginTop: 13}}>
        Études : {person.bio.education}<br />
        Expérience : {person.bio.experience}
        </div>
      </div>
      <hr style={hrStyle} />
      <div style={descriptionStyle}>{person.bio.description}</div>
      {this.renderSocialLinks(person)}
    </div>
  }

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
    return <a
      style={{cursor: 'pointer', margin: '0 5px', position: 'relative', textDecoration: 'none'}}
      onMouseEnter={() => this.setState({[shareIdState]: true})}
      onMouseLeave={() => this.setState({[shareIdState]: false})}
      href={url}
      rel="noopener noreferer"
      target="_blank">
      <img src={icon} style={colorIconStyle} alt="" />
      <img src={grayIcon} alt={shareId} />
    </a>
  }

  renderPersonList(personList) {
    const {nbPersonInARow} = this.state
    return new Array(Math.ceil(personList.length / nbPersonInARow)).fill().
      map((unused, rowIndex) => personList.slice(
        rowIndex * nbPersonInARow, (rowIndex + 1) * nbPersonInARow)).
      map((personRow, rowIndex) => {
        return [
          this.renderPersonRow(personRow, rowIndex),
          // TODO(benoit): Scroll slowly.
          this.renderPersonBio(personRow, rowIndex),
        ]
      })
  }

  renderValue(summary, description) {
    const style = {
      color: Colors.SLATE,
      fontSize: 15,
      lineHeight: 1.47,
    }

    const paragraphStyle = {
      margin: '60px auto',
    }

    return <span style={style}>
      <p style={paragraphStyle}><strong>{summary}</strong> {description}</p>
    </span>
  }

  renderValues() {
    const containerStyle = {
      backgroundColor: '#fff',
      paddingBottom: 100,
    }
    const titleStyle = {
      color: Colors.SLATE,
      fontSize: 35,
      fontWeight: 'bold',
      paddingTop: 100,
      textAlign: 'center',
    }
    const valuesStyle = {
      justifyContent: 'center',
      margin: '100px auto',
      maxWidth: 650,
      padding: '0 25px',
    }

    return <div style={containerStyle}>
      <div style={titleStyle}>Nos valeurs</div>
      <div style={valuesStyle}>
        {this.renderValue('Toujours être bienveillant,', 'afin de mieux servir chacun. ' +
          "Même si la technologie est notre outil, nous croyons qu'il faut toujours mettre " +
          "l'humain d'abord.")}
        {this.renderValue("S'améliorer constamment.", "C'est en se remettant toujours " +
          'en question que nous pourrons nous hisser à la hauteur de la complexité de nos ' +
          'enjeux.')}
        {this.renderValue('Savoir combiner audace et humilité.', "On se doit d'être ambitieux" +
          "lorsque c'est pour l'intérêt général. Même (surtout) si c'est dur.")}
        {this.renderValue('Être pragmatique, mais rester idéaliste.', 'Il ne faut pas faire de ' +
          "solutionnisme. Mais ça ne veut pas dire qu'il n'y a pas de solution. Le plus " +
          'important est de toujours savoir pourquoi on fait les choses.')}
      </div>
    </div>
  }

  render() {
    const {isMobileVersion} = this.context
    const coverStyle = {
      backgroundImage: `url(${headerImage})`,
      backgroundPosition: 'center center',
      backgroundSize: 'cover',
      display: 'flex',
      flexDirection: 'column',
      height: isMobileVersion ? 200 : 450,
      justifyContent: 'center',
    }
    const titleStyle = {
      color: '#fff',
      fontSize: isMobileVersion ? 40 : 62,
      fontWeight: 'bold',
      lineHeight: 0.81,
      textAlign: 'center',
      textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
    }
    const quoteStyle = {
      color: Colors.DARK_TWO,
      fontSize: 18,
      fontStyle: 'italic',
      lineHeight: 1.33,
      margin: isMobileVersion ? '30px auto 40px': '80px auto 90px',
      maxWidth: 650,
      padding: '0 25px',
      textAlign: 'center',
    }
    return <StaticPage
      page="equipe" style={{backgroundColor: Colors.BACKGROUND_GREY}}
      isNavBarTransparent={true} isContentScrollable={false}>
      <div style={coverStyle}>
        <div style={titleStyle}>Qui est Bob ?</div>
      </div>
      <div style={{margin: '0px auto 100px auto', maxWidth: 1000}}>
        <div style={quoteStyle}>
          Nous sommes une petite équipe convaincue que la technologie peut être utilisée pour des
          choses qui ont du sens, pas juste pour faire du profit.<br />
          <br />
          C'est pourquoi nous avons créé{' '}
          <a
            style={{color: Colors.DARK_TWO, fontWeight: 'bold', textDecoration: 'none'}}
            href="http://www.bayesimpact.org" target="_blank" rel="noopener noreferrer">
            Bayes&nbsp;Impact
          </a>, une association à but non lucratif, afin de la mettre au service de chacun.
        </div>
        {this.renderPersonList(allPersons)}
      </div>
      {this.renderValues()}
    </StaticPage>
  }
}

export {TeamPage}
