import _uniqueId from 'lodash/uniqueId'
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'

import type {LocalizableString} from 'store/i18n'
import {prepareT, prepareT as prepareTNoExtract} from 'store/i18n'
import isMobileVersion from 'store/mobile'

import benjaminImage from 'images/people/benjamin.png'
import cyrilleImage from 'images/people/cyrille.png'
import emilieImage from 'images/people/emilie.png'
import floImage from 'images/people/flo.png'
import florianImage from 'images/people/florian.png'
import johnImage from 'images/people/john.png'
import lillieImage from 'images/people/lillie.jpg'
import nicolasImage from 'images/people/nicolas.jpg'
import pascalImage from 'images/people/pascal.png'
import paulImage from 'images/people/paul.png'
import silImage from 'images/people/sil.png'
import tabithaImage from 'images/people/tabitha.jpg'

import facebookGrayIcon from 'images/share/facebook-gray-ico.svg'
import facebookIcon from 'images/share/facebook-ico.svg'
import linkedinGrayIcon from 'images/share/linkedin-gray-ico.svg'
import linkedinIcon from 'images/share/linkedin-ico.svg'
import twitterGrayIcon from 'images/share/twitter-gray-ico.svg'
import twitterIcon from 'images/share/twitter-ico.svg'

import ExternalLink from 'components/external_link'
import Trans from 'components/i18n_trans'
import ModalCloseButton from 'components/modal_close_button'
import {SmartLink, RadiumExternalLink} from 'components/radium'
import {StaticPage, TitleSection} from 'components/static'
import {MAX_CONTENT_WIDTH, MIN_CONTENT_PADDING, SmoothTransitions} from 'components/theme'

// i18next-extract-mark-ns-start landing

const paulBio = {
  description: prepareT(
    'team:paul:bio',
    "Avant de fonder Bayes Impact en 2014, Paul était un data scientist à Eventbrite, \
    où il écrivait des algorithmes ainsi que des mauvais jeux de mots (ce dernier point n'a pas \
    trop changé). Il a étudié un mélange bizarre de mathématiques, d'économie et de sciences \
    politiques à Berkeley, Sciences Po et la Sorbonne."),
  education: 'UC Berkeley, Sciences Po, Université Paris 1',
  experience: prepareT('team:paul:experience', 'Data Scientist à Eventbrite'),
  linkedin: 'https://www.linkedin.com/in/pyduan',
  twitter: 'https://twitter.com/pyduan',
}


const pascalBio = {
  description: prepareT(
    'team:pascal:bio',
    "Pascal a commencé à programmer quand il avait huit ans et n'a jamais vraiment \
    arrêté, ou juste le temps de dormir un peu. Avant de rejoindre l'équipe, il était Staff \
    Software Engineer chez Google où il était connu pour son leadership par l'exemple. Il adore \
    les enfants (il en a d'ailleurs beaucoup), et va au boulot en rollers."),
  education: 'École Polytechnique, Télécoms Paris',
  experience: prepareT(
    'team:pascal:experience', 'Tech Lead Manager Google Maps, Ministère de la Défense'),
  linkedin: 'https://www.linkedin.com/in/pascalcorpet/',
  twitter: 'https://twitter.com/pascalcorpet',
}

const silBio = {
  description: prepareT(
    'team:sil:bio',
    "Sil a fait de la recherche académique et s'est spécialisé·e dans l'analyse \
    de données dans le domaine de la santé. Iel est toujours enchanté·e de découvrir d'obscurs \
    romans dystopiques et ne refusera jamais une rencontre sur un terrain de basket-ball."),
  education: 'Université Paris-Sud',
  experience: prepareT(
    'team:sil:experience', 'Développeur web à Symbiosis Technologies, Senior Postdoctoral Fellow à \
    Inserm, Postdoctoral Fellow à INRA'),
  linkedin: 'https://fr.linkedin.com/in/ml-endale-07110713b',
}

const johnBio = {
  description: prepareT(
    'team:john:bio',
    "Depuis qu'il est enfant John est absolument passionné par le design et les \
    interfaces. Il a commencé le design à 14 ans en faisant des covers pour DVDs qu'il partageait \
    en ligne. Il voue un culte très particulier pour la symétrie qui l'inspire au quotidien. \
    Véritable Français accompli il adore évidemment le vin et le fromage."),
  education: "Hetic (Hautes études des technologies de l'information et de la communication)",
  experience: prepareT(
    'team:john:experience',
    'Responsable du design à SMACH, Responsable du design à Wipolo, UX Designer freelance pendant \
    5 ans'),
  linkedin: 'https://www.linkedin.com/in/johnmetois/',
  twitter: 'https://twitter.com/serialkimi',
}

const cyrilleBio = {
  description: prepareT(
    'team:cyrille:bio',
    "Cyrille a fait de la recherche en mathématiques jusqu'à ce qu'il se rende compte \
    que ça n'avait pas vraiment d'impact, et décide de se rendre utile. Il aime les jeux de \
    société, surtout coopératifs, et partir marcher ou faire de l'escalade si le temps le permet."),
  education: 'École Normale Supérieure, Paris',
  experience: prepareT('team:cyrille:experience', 'Développeur web à Kreactive'),
  linkedin: 'https://www.linkedin.com/in/cyrillecorpet',
}

const nicolasBio = {
  description: prepareT(
    'team:nicolas:bio',
    'Nicolas a pu travailler dans différentes agences de \
    communication, aussi bien sur des problématiques de réputation digitale, de \
    gestion de crise ou de relations presse. Durant son cursus universitaire, il \
    a étudié la science politique ainsi que la communication politique et \
    institutionnelle. Passionné de mode et de politique française, il adore \
    également découvrir et faire découvrir de nouveaux restaurants.'),
  education: 'Sciences-Po Toulouse, La Sorbonne',
  experience: prepareT(
    'team:nicolas:experience', "Consultant en communication d'influence et relations presse dans \
    différentes agences"),
  linkedin: 'https://www.linkedin.com/in/nicolasdivet/',
  twitter: 'https://twitter.com/nicolasdivet',
}

const benjaminBio = {
  description: prepareT(
    'team:benjamin:bio',
    "Benjamin développe des partenariats avec les services publics de l'emploi, \
    en France et dans le monde, afin d'accompagner des milliers de chercheurs d'emploi. \
    Il travaille également sur la question plus générale du financement de l'ONG. \
    Il découvre son envie de mettre ses compétences au service des plus vulnérables \
    dans le cadre d'un VSI durant ses années d'études. \
    Il a travaillé pendant 2 et demi pour l'association ACAY, aux Philippines et à Marseille. \
    Responsable du fonctionnement et du développement de l'association, il a également accompagné \
    plusieurs dizaines de jeunes mineurs en détention et plusieurs jeunes filles en difficulté, \
    afin de les préparer à une réinsertion sociale et professionnelle."),
  education: 'Université Aix-Marseille en droit des affaires, EDHEC Business School',
  experience: prepareT('team:benjamin:experience', 'ACAY'),
  linkedin: 'https://www.linkedin.com/in/benjamingoullard/',
}

const emilieBio = {
  description: prepareT(
    'team:emilie:bio',
    "Émilie a participé à plusieurs aventures entrepreunariales dans le jeu vidéo et le tourisme, \
    avant de réaliser qu'elle voulait avoir plus d'impact dans son quotidien. Elle aime \
    la course à pieds, et réfléchir à comment avoir un impact positif autour d'elle."),
  education: 'Polytech Paris-Saclay, INSEAD Management Acceleration Program',
  experience: prepareT(
    'team:emilie:experience', 'Direction technique chez Owlient (Ubisoft), associée chez MyAtlas'),
  linkedin: 'https://www.linkedin.com/in/emilieguth/',
}

const lillieBio = {
  description: prepareT(
    'team:lillie:bio',
    "Lillie se passionne pour connecter les gens à des carrières durables et qui ont du sens. \
    Elle a pu faire ces connexions dans divers contextes\u00A0: de la création d'un programme \
    d'amélioration des compétences pour des personnes précédemment sans logement, au conseil de \
    leaders du secteur public sur les stratégies de développement de l'emploi."),
  education: 'MIT, Harvard, Duke',
  experience: prepareT(
    'team:lillie:experience', 'Consultante senior chez Guidehouse et Ernst & Young'),
  linkedin: 'https://www.linkedin.com/in/lilliecarroll',
}

const florianBio = {
  description: prepareT(
    'team:florian:bio',
    "Florian s'occupe des relations avec les financeurs de Bayes Impact et de la recherche de \
    mécènes afin de multiplier et continuer l'action de l'organisation. Arrivé chez Bayes Impact \
    en 2018, Florian a auparavant travaillé pendant près de 7 ans auprès de Jacques Attali au \
    sein de son cabinet. Il conseillait des grandes entreprises et gouvernements dans leurs \
    stratégies et leurs politiques publiques."),
  education: 'Sciences-Po Paris, Columbia NY',
  experience: prepareT('team:florian:experience', 'cabinet de Jacques Attali'),
  linkedin: 'https://www.linkedin.com/in/florian-dautil-876b9258',
}

const floBio = {
  description: prepareT(
    'team:flo:bio',
    "Florian a commencé sa carrière en écrivant des algorithmes pour prédire les vols de voitures \
    à Etalab (si si, ça marche\u00A0!). Il a ensuite quitté le monde l'IA pour lancer sa startup, \
    Totem, une app sociale pour organiser des sorties entre amis. Après 3 ans d'apprentissage à la \
    dure sur comment créer des produits percutants, il en est tombé amoureux. En 2020, Florian \
    rejoint Bayes Impact, le parfait mélange de tout ce qu'il aime\u00A0: IA, produit et impact \
    social. Il a aussi une grande passion pour la boxe, mais est doux comme un agneau."),
  education: 'ENSAI',
  experience: prepareTNoExtract('Etalab, Totem'),
  linkedin: 'https://www.linkedin.com/in/florian-gauthier-38760b49',
}

const tabithaBio = {
  description: prepareT(
    'team:tabitha:bio',
    "Tabitha est une scientifique sociale et chercheuse ardente qui adore poser des questions et \
    comprendre les points de vue des autres. Elle est particulièrement expérimentée dans les \
    domaines du développement de l'enfant, de l'éducation, et de la santé. Elle est passionnée \
    par la création des outils et des services qui sont vraiment utiles et percutants, et elle \
    est ravie de diriger la recherche dans cette poursuite chez Bayes Impact. En dehors du \
    travail, Tabitha aime beaucoup faire du yoga, manger de la pâtisserie, et se perdre en belles \
    paroles sur Philadelphie."),
  education: 'Temple University',
  experience: prepareT(
    'team:tabitha:experience', 'Sanametrix, Postdoctoral Fellow à University of Virginia'),
  linkedin: 'https://www.linkedin.com/in/tabitha-wurster-37172530',
}

interface Person {
  bio: {
    description: LocalizableString
    education: string
    experience: LocalizableString
    facebook?: string
    linkedin?: string
    twitter?: string
  }
  name: string
  picture: string
  position: LocalizableString
}


const allPersons: Person[] = [
  {bio: paulBio, name: 'Paul Duan', picture: paulImage, position: prepareT('Président')},
  {bio: pascalBio, name: 'Pascal Corpet', picture: pascalImage,
    position: prepareT('Ingénieur logiciel')},
  {bio: silBio, name: 'Sil Endale Ahanda', picture: silImage,
    position: prepareT('Ingénieur·e logiciel')},
  {bio: johnBio, name: 'John Métois', picture: johnImage, position: prepareT('Designer UX')},
  {bio: cyrilleBio, name: 'Cyrille Corpet', picture: cyrilleImage,
    position: prepareT('Ingénieur logiciel')},
  {bio: nicolasBio, name: 'Nicolas Divet', picture: nicolasImage,
    position: prepareT('Chargé de communication')},
  {bio: benjaminBio, name: 'Benjamin Goullard', picture: benjaminImage,
    position: prepareT('Responsable du développement')},
  {bio: emilieBio, name: 'Émilie Guth', picture: emilieImage,
    position: prepareT('Directrice technique')},
  {bio: lillieBio, name: 'Lillie Carroll', picture: lillieImage,
    position: prepareT('Responsable pays, USA')},
  {bio: florianBio, name: 'Florian Dautil', picture: florianImage,
    position: prepareT('Directeur des opérations')},
  {bio: floBio, name: 'Florian Gauthier', picture: floImage,
    position: prepareT('Directeur des produits')},
  {bio: tabithaBio, name: 'Tabitha Wurster', picture: tabithaImage,
    position: prepareT('Directrice de la recherche utilisateur')},
]


const tileSize = {
  height: 340,
  width: 320,
}


const EmptyPersonTileBase: React.FC = () => <div style={tileSize} />
const EmptyPersonTile = React.memo(EmptyPersonTileBase)


interface PersonTileProps {
  isSelected: boolean
  name: string
  onClick: () => void
  picture: string
  position: LocalizableString
}


const PersonTileBase: React.FC<PersonTileProps> = (props) => {
  const {isSelected, name, onClick, position, picture} = props
  const {t: translate} = useTranslation('landing')
  const boxShadow = '0 12px 25px 0 rgba(0, 0, 0, 0.15)'
  const personStyle: RadiumCSSProperties = {
    ':hover': {
      boxShadow,
    },
    'alignItems': 'center',
    'backgroundColor': '#fff',
    'boxShadow': isSelected ? boxShadow : 'initial',
    'color': colors.DARK,
    'cursor': 'pointer',
    'display': 'flex',
    'flexDirection': 'column',
    'textAlign': 'center',
    ...tileSize,
  }
  const descriptionStyle: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    height: 120,
    justifyContent: 'center',
  }
  const nameStyle: React.CSSProperties = {
    fontSize: 21,
    fontWeight: 'bold',
  }
  const positionStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 500,
    marginTop: 6,
  }

  return <SmartLink style={personStyle} onClick={onClick}>
    <img style={{display: 'block', width: '100%'}} src={picture} alt="" />
    <span style={descriptionStyle}>
      <span style={nameStyle}>{name}</span>
      <span style={positionStyle}>{translate(...position)}</span>
    </span>
  </SmartLink>
}
const PersonTile = React.memo(PersonTileBase)


interface TeamPageRowProps {
  getPersonClickHandler: (name: string) => () => void
  nbPersonInARow: number
  personRow: readonly Person[]
  rowIndex: number
  showPersonBio: string
}


const PersonRowBase: React.FC<TeamPageRowProps> = (props) => {
  const {getPersonClickHandler, nbPersonInARow, personRow, rowIndex, showPersonBio} = props
  const rowStyle = {
    display: 'flex',
    justifyContent: nbPersonInARow > 1 ? 'space-between' : 'space-around',
    marginBottom: 70,
  }
  const fullPersonRow = [
    ...personRow,
    ...Array.from<undefined>({length: nbPersonInARow - personRow.length}),
  ]
  return <div key={`row-${rowIndex}`} style={rowStyle} >
    {fullPersonRow.map((person, index): React.ReactNode => {
      const personIndex = rowIndex * nbPersonInARow + index
      const personKey = `person-${personIndex}`
      if (person) {
        return <PersonTile
          key={personKey}
          isSelected={showPersonBio === person.name}
          onClick={getPersonClickHandler(person.name)} {...person} />
      }
      return <EmptyPersonTile key={personKey} />
    })}
  </div>
}
const PersonRow = React.memo(PersonRowBase)


const handleBioOpen = (bioDiv: HTMLDivElement): void => {
  const clientHeight = document.documentElement.clientHeight
  const divRect = bioDiv.getBoundingClientRect()
  if (divRect.top < 0 || divRect.bottom > clientHeight) {
    window.scroll({behavior: 'smooth', top: window.scrollY + divRect.top - (clientHeight / 2)})
  }
}


const TeamPage: React.FC = (): React.ReactElement => {
  const nbPersonInARow = isMobileVersion ? 1 : 3
  const [showPersonBio, setShowPersonBio] = useState('')
  const getPersonClickHandler = useMemo(
    (): ((bio: string) => () => void) => (bio: string): () => void =>
      (): void => setShowPersonBio(bio === showPersonBio ? '' : bio),
    [showPersonBio, setShowPersonBio])
  const quoteStyle = {
    fontSize: 18,
    lineHeight: 1.7,
    margin: isMobileVersion ? '30px auto 40px' : '60px auto 70px',
    maxWidth: 650,
    padding: '0 25px',
  }
  return <StaticPage style={{backgroundColor: '#fff'}} page="equipe">
    <TitleSection pageContent={{title: <Trans parent={null} ns="landing">
      Notre équipe est déterminée<br />
      à changer le monde
    </Trans>}} />
    <div style={{padding: `0 ${MIN_CONTENT_PADDING}px`}}>
      <div style={{margin: '0px auto', maxWidth: MAX_CONTENT_WIDTH}}>
        <Trans style={quoteStyle} ns="landing" parent="p">
          Nous sommes une petite équipe convaincue que la technologie peut être utilisée pour des
          choses qui ont du sens, pas juste pour faire du profit.<br />
          <br />
          C'est pourquoi nous avons
          construit <strong>{{productName: config.productName}}</strong> et créé{' '}
          <ExternalLink
            style={{color: 'inherit', fontWeight: 'bold', textDecoration: 'none'}}
            href="http://www.bayesimpact.org">
            Bayes&nbsp;Impact
          </ExternalLink>, une association à but non lucratif, afin de la mettre au service
          de chacun.
        </Trans>
        {Array.from(
          {length: Math.ceil(allPersons.length / nbPersonInARow)},
          (unused, rowIndex): readonly Person[] => allPersons.slice(
            rowIndex * nbPersonInARow, (rowIndex + 1) * nbPersonInARow),
        ).map((personRow: readonly Person[], rowIndex: number): React.ReactNode => {
          return [
            <PersonRow
              key={rowIndex}
              {...{getPersonClickHandler, nbPersonInARow, personRow, rowIndex, showPersonBio}} />,
            <PersonBio
              key={`bio-${rowIndex}`}
              personRow={personRow}
              onClose={getPersonClickHandler('')}
              onOpen={handleBioOpen}
              showPersonBio={showPersonBio} />,
          ]
        })}
      </div>
    </div>
  </StaticPage>
}

export default React.memo(TeamPage)


interface SocialLinkProps {
  grayIcon: string
  icon: string
  shareId: string
  url: string
}


const SocialLinkBase: React.FC<SocialLinkProps> = (props) => {
  const {icon, grayIcon, shareId, url} = props
  const colorIconStyle: RadiumCSSProperties = {
    ':hover': {
      opacity: 1,
    },
    'opacity': 0,
    'position': 'absolute',
    ...SmoothTransitions,
  }
  return <RadiumExternalLink
    style={{cursor: 'pointer', margin: '0 5px', position: 'relative', textDecoration: 'none'}}
    href={url}>
    <img src={icon} style={colorIconStyle} alt="" />
    <img src={grayIcon} alt={shareId} />
  </RadiumExternalLink>
}
const SocialLink = React.memo(SocialLinkBase)


interface PersonBioProps {
  onClose: () => void
  onOpen: (div: HTMLDivElement) => void
  personRow: readonly Person[]
  showPersonBio: string
}


const PersonSocialLinksBase: React.FC<Person> = (person: Person) => {
  const style: React.CSSProperties = {
    margin: 35,
    textAlign: 'center',
  }
  return <div style={style}>
    {person.bio.linkedin ? <SocialLink
      shareId="linkedin" icon={linkedinIcon}
      grayIcon={linkedinGrayIcon} url={person.bio.linkedin} /> : null}
    {person.bio.twitter ? <SocialLink
      shareId="twitter" icon={twitterIcon}
      grayIcon={twitterGrayIcon} url={person.bio.twitter} /> : null}
    {person.bio.facebook ? <SocialLink
      shareId="facebook" icon={facebookIcon}
      grayIcon={facebookGrayIcon} url={person.bio.facebook} /> : null}
  </div>
}
const PersonSocialLinks = React.memo(PersonSocialLinksBase)


const PersonBioBase: React.FC<PersonBioProps> = (props: PersonBioProps) => {
  const {onClose, onOpen, personRow, showPersonBio} = props
  const [isOpen, setIsOpen] = useState(false)
  const [shownPerson, showPerson] = useState<Person|undefined>(undefined)
  const handleUnsetPerson = useCallback((): void => showPerson(undefined), [showPerson])
  const containerRef = useRef<HTMLDivElement>(null)
  const {t, t: translate} = useTranslation('landing')

  const newPerson = personRow.find((person): boolean => person.name === showPersonBio)
  useEffect(() => {
    if (isOpen && newPerson) {
      if (containerRef.current) {
        onOpen(containerRef.current)
      }
      showPerson(newPerson)
    } else if (!isOpen && newPerson) {
      setIsOpen(true)
      showPerson(newPerson)
    } else if (isOpen && !newPerson) {
      setIsOpen(false)
    }
  }, [isOpen, newPerson, onOpen])

  const person = newPerson || shownPerson

  const rowStyle: React.CSSProperties = {
    marginBottom: isOpen ? 70 : 0,
    maxHeight: isOpen ? 600 : 0,
    opacity: isOpen ? 1 : 0,
    overflow: 'hidden',
    position: 'relative',
    textAlign: 'center',
    ...SmoothTransitions,
  }
  const hrStyle: React.CSSProperties = {
    backgroundColor: colors.SILVER,
    border: 0,
    height: 2,
    marginBottom: 35,
    marginTop: 35,
    width: 63,
  }
  const descriptionStyle: React.CSSProperties = {
    fontSize: 16,
    lineHeight: 1.31,
    margin: '0 auto',
    maxWidth: 500,
  }
  const closeStyle: React.CSSProperties = {
    bottom: 'initial',
    boxShadow: '',
    fontSize: 10,
    height: 20,
    opacity: .6,
    transform: 'initial',
    width: 20,
  }
  const titleId = useMemo(_uniqueId, [])
  return <div
    style={rowStyle} ref={containerRef}
    onTransitionEnd={isOpen ? undefined : handleUnsetPerson} aria-hidden={!isOpen}>
    <ModalCloseButton
      onClick={onClose} style={closeStyle} tabIndex={isOpen ? undefined : -1}
      aria-describedby={titleId} />
    <div style={{color: colors.DARK, fontSize: 26}}>
      <p style={{margin: 0}} id={titleId}>{person && person.name}</p>
      <p style={{color: colors.WARM_GREY, fontSize: 14, fontStyle: 'italic', margin: '13px 0 0'}}>
        {t('Études\u00A0:')} {person && person.bio.education}
      </p>
      <p style={{color: colors.WARM_GREY, fontSize: 14, fontStyle: 'italic', margin: 0}}>
        {t('Expérience\u00A0:')} {person && translate(...person.bio.experience)}
      </p>
    </div>
    <hr style={hrStyle} />
    <p style={descriptionStyle}>
      {person && translate(...person.bio.description)}
    </p>
    {person ? <PersonSocialLinks {...person} /> : null}
  </div>
}
const PersonBio = React.memo(PersonBioBase)
