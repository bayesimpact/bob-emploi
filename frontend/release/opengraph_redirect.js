// The source of this file is in bob-emploi-internal git repo:
// frontend/release/opengraph_redirect.js
// and should be deployed using the frontend/release/deploy_lambda.sh script.

const productName = 'Bob'
const urlRoot = 'https://www.bob-emploi.fr'

const pages = {
  '': {
    description: `${productName} fait un bilan sur votre recherche d'emploi et vous donne ` +
      "les meilleurs conseils. 100% gratuit, rapide et fait par l'ONG Bayes Impact",
  },
  'conseil/competences': {
    description: "3 points pour anticiper l'avenir de votre métier\u00A0:\n" +
      "Un diagnostic pour analyser des perspectives d'avenir offertes par votre métier.\n" +
      'Une liste des compétences qui peuvent faire la différence dans votre domaine.\n' +
      'Des idées de formations à suivre pour vous épanouir et booster votre carrière.',
    title: `Identifiez les compétences clés pour booster votre carrière avec ${productName}`,
  },
  'conseil/confiance': {
    description: '3 points pour avoir plus confiance en vous\u00A0:\n' +
      'Des mini-conférences inspirantes pour vous aider à reprendre confiance en vous.\n' +
      'Des tests de personnalités pour mieux vous connaître et identifier vos forces.\n' +
      "Des conseils pour vous sentir d'attaque avant un entretien.",
    title: `Boostez votre confiance en vous avec ${productName}`,
  },
  'conseil/cv-percutant': {
    description: '3 points pour réussir votre CV\u00A0:\n' +
      'Identifiez les qualités importantes à mettre dans votre CV.\n' +
      'Trouvez les meilleurs outils gratuits pour générer des exemples de CV.\n' +
      'Trouvez des astuces pour repérer les bons mots-clés et adapter vos CV ' +
      'en fonction des offres d’emploi.',
    title: 'Rendez votre CV plus percutant',
  },
  'conseil/entretien': {
    description: "3 points pour réussir vos entretiens d'embauche\u00A0:\n" +
      'La liste des qualités à mettre en avant selon votre métier pour vous aider à réussir vos ' +
      'entretiens.\n' +
      'Une sélection de réponses à préparer et de bonnes questions à poser au recruteur à la fin ' +
      'de vos entretiens.\n' +
      "Des exemples de mails de remerciement à envoyer après l'entretien.",
    title: `Préparez vos entretiens d'embauche avec ${productName}`,
  },
  'conseil/evenements': {
    description: '3 points pour rencontrer des gens à des évènements\u00A0:\n' +
      "Une sélection d'évènements et de salons de l'emploi près de chez vous.\n" +
      "Des astuces pour aller vers les gens pendant l'évènement et des exemples de mails pour " +
      'garder le contact après.\n' +
      'Une sélection des meilleurs outils gratuits pour trouver des évènements près de chez vous.',
    title: `Trouvez les meilleurs évènements emploi avec ${productName}`,
  },
  'conseil/lettre-motivation': {
    description: '3 points pour réussir votre lettre de motivation\u00A0:\n' +
      'Trouver des modèles de mails de motivation.\n' +
      'Trouver les meilleurs outils gratuits pour générer des exemples de ' +
      'lettre de motivation.\n' +
      'Trouver des astuces pour adapter vos mails et lettres de motivation ' +
      'en fonction de la situation.',
    title: 'Réussir vos mails et lettres de motivation',
  },
  'conseil/offres': {
    description: "3 points pour trouver des offres d'emploi\u00A0:\n" +
      'Des conseils pour dénicher des offres et vous attaquer au marché caché.\n' +
      "Une sélection des meilleurs sites d'offres pour trouver des offres dans votre domaine.\n" +
      'Des conseils pour pouvoir lire entre les lignes et analyser ce que recherchent les ' +
      'recruteurs.',
    title: "Trouvez des offres d'emploi, qu'elles soient publiées ou pas",
  },
  'conseil/relocalisation': {
    description: '3 points pour trouver les meilleures opportunités\u00A0:\n' +
      "La liste des villes avec le plus d'entreprises qui recherchent des profils proches du " +
      'vôtre.\n' +
      "La liste des villes qui offrent le plus d'opportunités dans votre région ou à moins de 30 " +
      'min de chez vous.\n' +
      "Des informations sur les métiers à plus fort potentiel de retour à l'emploi rapide.",
    title: `Identifiez les meilleures opportunités avec ${productName}`,
  },
  'conseil/soutien-association': {
    description: "3 points pour bien s'entourer pendant sa recherche\u00A0:\n" +
      `Le soutien de l'équipe de ${productName}\u00A0! On trouve un bon conseil pour vous, un ` +
      "membre de l'équipe vous l'envoie par mail.\n" +
      "Une séléction d'associations près de chez vous pour vous accompagner dans votre " +
      'recherche.\n' +
      'Des conseils pour trouver et rejoindre une association en tant que bénévole.',
    title: `Restez bien entouré pendant votre recherche avec ${productName}`,
  },
  'contribuer': {
    description: 'Ensemble créons le service public de demain.',
    title: 'Contribuer',
  },
  'diagnostic': {
    description: `${productName} vous permet de savoir comment se porte votre marché`,
    image: 'https://www.bob-emploi.fr/assets/quick_diagnostic_screenshot.png',
    title: "Évaluez l'avenir de votre métier en un clic",
  },
  'equipe': {
    description: `Voici l'équipe qui développe ${productName}`,
    title: 'Équipe',
  },
  'notre-mission': {
    description: "Notre mission est d'utiliser le pouvoir " +
      'des algorithmes pour apporter des solutions aux problèmes de société.',
    title: 'Notre mission',
  },
  'transparence': {
    description: `Le fonctionnement et le développement de ${productName} en ` +
      'toute transparence\u00A0: les chiffres clés, nos financements, les plans ' +
      'pour la suite',
    title: 'Transparence',
  },
  'unml': {
    description: 'Faites le point sur où vous en êtes avec votre conseiller des Missions Locales',
    fullTitle: 'Bilan des Missions Locales',
  },
  'vie-privee': {
    description: 'Nous nous engageons à respecter le meilleur niveau de ' +
      'protection en conformité avec la réglementation Informatique et Liberté.',
    title: 'Vie privée',
  },
}

pages['mini'] = pages['unml']

function isOpenGraphBot(userAgent) {
  return /facebot|facebookexternalhit|slackbot|twitterbot|linkedinbot/.test(
    userAgent.value.toLowerCase())
}

function getPageDescription(pageUrl) {
  const {description, fullTitle, image, title} =
    pages[pageUrl] || pages[pageUrl.split('/')[0]] || pages[''] || {}
  return {
    description,
    image: image || 'https://www.bob-emploi.fr/assets/bob-circle-picto.png',
    title: fullTitle || (title ? `${productName} - ${title}` : productName),
    url: `${urlRoot}/${pageUrl}`,
  }
}

function openGraphContent(pageUrl) {
  const {description, image, title, url} = getPageDescription(pageUrl)
  return `<html>
  <head>
    <title>${title}</title>
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${image}" />
    <meta property="fb:app_id" content="1576288225722008" />
  </head>
</html>`
}

// TODO(pascal): Use this to show page descriptions in the app.
exports.getPageDescription = getPageDescription
exports.handler = (event, context, callback) => {
  const request = event.Records[0].cf.request
  const userAgents = request.headers['user-agent'] || []
  if (!userAgents.some(isOpenGraphBot)) {
    request.uri = '/index.html'
    return callback(null, request)
  }

  const pageUrl = request.uri.slice(1)
  if (!pages[pageUrl]) {
    callback(null, {status: '404', statusDescription: 'Not Found'})
    return
  }

  // eslint-disable-next-line no-console
  console.log('OpenGraph bot served for page: ' + request.uri)
  const response = {
    body: openGraphContent(pageUrl),
    headers: {
      'content-type': [{
        key: 'Content-Type',
        value: 'text/html; charset=UTF-8',
      }],
    },
    status: '200',
    statusDescription: 'OK',
  }
  callback(null, response)
}
