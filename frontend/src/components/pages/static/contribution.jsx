import GithubCircleIcon from 'mdi-react/GithubCircleIcon'
import React from 'react'

import {isMobileVersion} from 'components/mobile'
import {ShareButtons} from 'components/share'
import {StaticPage, StrongTitle} from 'components/static'
import {Button, ExternalLink, Styles} from 'components/theme'


export default class ContributionPage extends React.Component {
  renderHowto() {
    return <React.Fragment>
      <p>
        Notre objectif est de créer le service le plus utile possible pour aider
        les personnes en recherche d'emploi. La tâche est énorme et nous n'en
        sommes aujourd'hui qu'au début&nbsp;: voici les différentes façons dont vous
        pouvez nous aider dans notre mission.
      </p>

      <h3>
        Partagez {config.productName} autour de vous
      </h3>

      <p>
        {config.productName} est entièrement gratuit et à but non lucratif.
        Nous cherchons à aider le plus de personnes possible, et c'est pour ça
        que nous avons besoin de vous&nbsp;!

        En partageant {config.productName} à une personne à qui nous pourrions
        être utile, vous nous aidez à rendre le monde un peu meilleur - et ça ne
        prend qu'une minute.
      </p>

      <ShareButtons campaign="cb" />

      <h3>
        Proposez de nouvelles recommandations
      </h3>

      <p>
        {config.productName} fonctionne en proposant des recommandations aussi personnalisées
        que possible aux chercheurs d'emploi dans le but de les aider à avancer
        dans leur recherche. Ces recommandations sont de deux types : les solutions
        stratégiques («&nbsp;Avez-vous pensé aux contrats en freelance&nbsp;?&nbsp;») et les
        actions simples et concrètes qui seront proposées chaque jour aux
        chercheurs d'emploi pour les mettre en œuvre («&nbsp;Lire cet article sur
        comment envisager un passage en freelance&nbsp;»).
        Nous avons créé à ce jour plus de 500 recommandations, notamment grâce
        aux contributions de chercheurs d'emploi, de conseillers Pôle emploi, mais
        aussi d'individus provenant de tous horizons.
      </p>

      <p>
        Si vous souhaitez partager des suggestions propres à votre région, vous
        pouvez nous <ExternalLink href="https://airtable.com/shrmcnxqIrQBND0AC">
          les envoyer en cliquant ici
        </ExternalLink>.
      </p>

      <p>
        Si vous avez une idée de recommandation qui pourrait être utile aux
        chercheurs d'emploi, envoyez-la nous
        à <ExternalLink href="mailto:contribuer@bob-emploi.fr">
          contribuer@bob-emploi.fr
        </ExternalLink>.
        N'oubliez pas de préciser également dans quelle situation elle serait
        utile afin que nous puissions la recommander au bon moment et aux
        bonnes personnes&nbsp;!
      </p>

      <h3>
        Contribuez du code, des données ou des services
      </h3>

      <p>
        {config.productName} est rendu en partie possible grâce aux contributions externes.
      </p>

      <p>
        Ces contributions peuvent prendre plusieurs formes&nbsp;:
      </p>

      <ul>
        <li>
          <strong>Contribution de code</strong>&nbsp;: nous avons
          construit {config.productName} dans une logique ouverte. Par exemple,
          certains de nos algorithmes de
          recommandations ont ainsi été co-développés avec d'autres organisations
          comme Etalab et les équipes de l'Administrateur Général des Données.
        </li>
        <li>
          <strong>Contribution de données</strong>&nbsp;: l'accès à des jeux de
          données à jour et de bonne qualité est ce qui permet de rendre les
          algorithmes de {config.productName} intelligents. Nous nous appuyons par exemple sur des
          données anonymisées fournies par Pôle emploi sur les parcours des
          demandeurs d'emploi, des données de formations fournies par le réseau des
          CARIF-OREFs, ainsi que sur diverses APIs comme celles de LaBonneBoîte
          (entreprises susceptibles de recruter) ou de MultiPosting (traduction des
          noms de poste en codes ROME).
        </li>
        <li>
          <strong>Contribution de services</strong>&nbsp;: le développement de
          l'application a été facilité par la générosité d'organisations comme{' '}
          <ExternalLink href="https://ferpection.com/fr/">Ferpection</ExternalLink>{' '}
          (tests utilisateurs), <ExternalLink href="https://www.zendesk.fr">ZenDesk</ExternalLink>
          {' '} (support), <ExternalLink href="http://www.lucca.fr">Lucca</ExternalLink> (SIRH), etc.
          qui nous ont mis à disposition leurs services gratuitement.
        </li>
      </ul>

      <p>
        Si vous souhaitez discuter de contributions de ce type, n'hésitez pas à
        nous écrire à <ExternalLink href="mailto:contribuer@bob-emploi.fr">
          contribuer@bob-emploi.fr
        </ExternalLink>&nbsp;!
      </p>

      <h3>
        Faites un don
      </h3>

      <p>
        Nous sommes une association de loi 1901 financée par du mécénat public
        et privé. Votre générosité nous permet de soutenir notre petite équipe
        d'ingénieurs et de data scientists afin de pouvoir continuer à nous dédier
        à plein temps à l'intérêt général&nbsp;!
      </p>
    </React.Fragment>
  }

  renderRoadmap() {
    return <React.Fragment>
      <p>
        Le chômage est un domaine extrêmement complexe et nous travaillons avec
        des ressources limitées. Nous venons tout juste de lancer {config.productName} en version
        bêta et nous avons donc encore beaucoup de perspectives d'amélioration.
        Voici les chantiers que nous avons sur le feu&nbsp;: contactez-nous si
        certains d'entre eux vous parlent&nbsp;!
      </p>

      <h3>1. Intégrer les compétences et centres d'intérêts</h3>
      <p>
        Nos recommandations se font aujourd'hui sur la base des métiers
        recherchés ainsi que de leur proximité entre eux. Cette approche nous
        permet de faire des premières suggestions, mais est limitée par nature.
        Nous travaillons sur l'intégration d'autres méthodes de recommandation
        axées sur les compétences et les centres d'intérêts.
      </p>

      <h3>2. Intégrer les recommandations de formations</h3>
      <p>
        Les formations professionnelles jouent un rôle important dans la
        recherche d'emploi, mais intégrer cette dimension requiert de bien
        comprendre à la fois les mécanismes de prescription des formations (comment
        évaluer le besoin de formation et comment faire valider ce choix), les
        modalités administratives et financières (comment connaître et utiliser ses
        droits à la formation, ou savoir quelles aides sont disponibles), ainsi
        que les questions plus logistiques (comment trouver le bon organisme et
        faire les démarches). Si certaines de ces briques existent déjà,
        notamment via des services comme LaBonneFormation, beaucoup de ces
        questions restent des problèmes ouverts. Nous avons donc choisi d'attendre
        avant de nous attaquer au sujet, mais comptons y travailler prochainement.
      </p>

      <h3>3. Intégrer les aides et règles administratives de façon plus poussée</h3>
      <p>
        Les options ouvertes à un chercheur d'emploi sont en partie dépendantes
        des droits dont ils disposent. Cette dimension est d'autant plus importante
        que beaucoup d'individus ignorent les droits auxquels ils sont éligibles ou
        comment les utiliser. Intégrer les aides et règles administratives de façon
        plus poussée nous permettrait de personnaliser davantage nos
        recommandations d'actions.
      </p>

      <h3>4. Affiner les recommandations en fonction des métiers et situations</h3>
      <p>
        Il n'existe pas de «&nbsp;chercheur d'emploi type&nbsp;»&nbsp;: faire des
        recommandations utiles pour un individu donné requiert de prendre en compte
        toutes les particularités de sa situation. Il en va de même pour les
        métiers&nbsp;: une recommandation très pertinente pour un expert-comptable ne
        l'est pas forcément pour un menuisier&nbsp;! Si nos recommandations actuelles
        ainsi que nos algorithmes prennent globalement ces dimensions en compte,
        faire des recommandations très spécialisées demande un travail plus
        poussé de création de contenu.
      </p>

      <h3>5. Mieux suivre l'évolution des personnes au fil du temps</h3>
      <p>
        La recherche d'emploi n'est pas statique&nbsp;: au fur et à mesure qu'un
        chercheur d'emploi progresse dans sa recherche (y compris suite à son
        activité sur {config.productName}&nbsp;!), sa situation et ses besoins
        évoluent. Comment mesurer ces changements, donner à l'individu un sentiment
        de progrès, et adapter les recommandations en fonction&nbsp;?
      </p>

      <h3>6. Accompagner sur plus de types de projets (création d'activité, reconversions…)</h3>
      <p>
        Nous avons aujourd'hui choisi de nous concentrer sur la recherche d'un
        poste précis, mais la recherche d'emploi recouvre un large spectre de types
        de projets. En particulier, nous souhaitons approfondir notre capacité à
        accompagner les personnes en reconversion professionnelle, ainsi que les
        personnes cherchant à créer leur activité. {config.productName} a été pensé de façon
        modulable, mais intégrer ces types de parcours requiert un travail
        conséquent de création de contenu et d'algorithmes de recommandation
        spécifiques.
      </p>

      <h3>7. Faciliter la complémentarité avec les formes d'accompagnement humain</h3>
      <p>
        La vocation de {config.productName} n'est pas de remplacer l'accompagnement humain. Au
        contraire, il lui est complémentaire. Lors de nos tests utilisateurs nous
        avons vu le potentiel de l'alliance entre un accompagnement numérique,
        toujours disponible au quotidien mais moins profond, et un accompagnement
        humain, plus fin mais aussi plus lourd à mettre en œuvre. Nous avons
        commencé sur cette lancée, avec la possibilité pour l'utilisateur de
        partager son activité sur {config.productName} avec les personnes de son choix, mais nous
        comptons explorer diverses façons de faciliter davantage la collaboration
        entre les deux.
      </p>
    </React.Fragment>
  }

  render() {
    const leftTitleStyle = {
      color: colors.SLATE,
      flexShrink: 0,
      fontSize: 35,
      fontWeight: 'bold',
      lineHeight: 1.34,
      marginRight: isMobileVersion ? 'initial' : 80,
      marginTop: 18,
      width: 320,
    }
    const textSectionStyle = {
      display: 'flex',
      margin: '72px 100px 100px',
    }
    if (isMobileVersion) {
      Object.assign(textSectionStyle, {
        flexDirection: 'column',
        margin: '22px 20px 40px',
      })
    }
    const callOutStyle = {
      backgroundColor: colors.SLATE,
      color: '#fff',
      fontSize: 30,
      fontWeight: 'bold',
      lineHeight: 1.33,
      padding: isMobileVersion ? 30 : 60,
      textAlign: 'center',
    }
    const githubLinkStyle = {
      alignItems: 'center',
      backgroundColor: colors.SLATE,
      borderRadius: 5,
      color: '#fff',
      display: 'flex',
      fontSize: 15,
      margin: 15,
      padding: 9,
      position: isMobileVersion ? 'initial' : 'absolute',
      right: 0,
      textDecoration: 'none',
      top: 0,
    }
    return <StaticPage page="contribution" title={<span>
      Comment <StrongTitle>contribuer</StrongTitle>&nbsp;?
    </span>} style={{padding: 0}}>
      <ExternalLink style={githubLinkStyle} href={config.githubSourceLink}>
        <GithubCircleIcon style={{fill: '#fff', height: 29, marginRight: 9, width: 29}} />
        <span style={Styles.CENTER_FONT_VERTICALLY}>
          Voir le code source sur GitHub
        </span>
      </ExternalLink>

      <div style={textSectionStyle}>
        <div style={leftTitleStyle}>
          Par la communauté,<br />
          pour la communauté
          <ExternalLink href={config.donationUrl}>
            <Button type="validation" style={{marginTop: 20}}>
              Faire un don
            </Button>
          </ExternalLink>
        </div>
        <div style={{fontSize: 16, lineHeight: 1.44}}>
          {this.renderHowto()}
        </div>
      </div>

      <div style={callOutStyle}>
        <div style={{margin: 'auto', maxWidth: 400}}>
          Ensemble créons le service&nbsp;public de demain
        </div>
      </div>

      <div style={textSectionStyle}>
        <div style={leftTitleStyle}>
          Nos pistes d'améliorations
        </div>
        <div style={{fontSize: 16, lineHeight: 1.44}}>
          {this.renderRoadmap()}
        </div>
      </div>
    </StaticPage>
  }
}
