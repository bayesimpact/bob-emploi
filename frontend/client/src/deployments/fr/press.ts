import pressConsolabImage from 'images/press/consolab.png'
import pressEchoStartImage from 'images/press/echos.png'
import pressEurope1Image from 'images/press/europe1.png'
import pressFemmeActuelleImage from 'images/press/femme-actuelle.png'
import pressFranceInfoImage from 'images/press/franceinfo.png'
import pressLetudiantImage from 'images/press/letudiant.png'
import pressNouvelleVieImage from 'images/press/nouvellevie.png'
import pressPositivrImage from 'images/press/positivr.png'


export default [
  {
    imageAltText: 'PositivR',
    imageSrc: pressPositivrImage,
    title: "Développer le conseil à l'emploi grâce aux nouvelles technologies, avec Bob Emploi.",
    url: 'https://positivr.fr/humain-et-ia-bob-emploi-positiveimpact/',
  },
  {
    imageAltText: 'Les Échos Start',
    imageSrc: pressEchoStartImage,
    title: "Bob Emploi, l'algorithme qui s'attaque au chômage",
    url: 'https://start.lesechos.fr/entreprendre/actu-startup/bob-emploi-l-algorithme-qui-s-attaque-au-chomage-12226.php',
  },
  {
    imageAltText: 'Europe 1',
    imageSrc: pressEurope1Image,
    title: 'Cinq choses à savoir sur Bob Emploi, le site qui veut enrayer le chômage',
    url: 'http://www.europe1.fr/economie/cinq-choses-a-savoir-sur-bob-emploi-le-site-qui-veut-enrayer-le-chomage-2901977',
  },
  {
    imageAltText: 'Nouvelle Vie Pro',
    imageSrc: pressNouvelleVieImage,
    title: "Bob Emploi\u00A0: besoin d'aide dans vos recherches\u00A0? Demandez Bob\u00A0!",
    url: 'https://www.nouvelleviepro.fr/actualite/587/bob-emploi-besoin-daide-dans-vos-recherches-demandez-bob',
  },
  {
    imageAltText: 'Femme Actuelle',
    imageSrc: pressFemmeActuelleImage,
    title: 'Quel site choisir pour trouver un emploi\u00A0?',
    url: 'https://www.femmeactuelle.fr/actu/vie-pratique/quel-site-choisir-pour-trouver-un-emploi-48341',
  },
  {
    imageAltText: 'France Info',
    imageSrc: pressFranceInfoImage,
    title: "VIDÉO. Pour endiguer le chômage, il crée un site de recherche d'emplois personnalisé",
    url: 'https://www.francetvinfo.fr/economie/emploi/chomage/video-pour-endiguer-le-chomage-il-cree-un-site-de-recherche-demplois-personnalise_2801901.html',
  },
  {
    imageAltText: 'Conso Collaborative',
    imageSrc: pressConsolabImage,
    title: 'Big Data et bonnes volontés, la recette de Bob Emploi pour lutter ' +
      'contre le chômage',
    url: 'http://consocollaborative.com/article/big-data-et-bonnes-volontes-la-recette-de-bob-emploi-pour-lutter-contre-le-chomage/',
  },
  {
    imageAltText: "L'Étudiant",
    imageSrc: pressLetudiantImage,
    title: "Bob Emploi, la meilleure façon de démarrer ta recherche d'emploi",
    url: 'https://www.letudiant.fr/metiers/bob-emploi-la-meilleure-facon-de-demarrer-ta-recherche-d-emploi.html',
  },
] as const
