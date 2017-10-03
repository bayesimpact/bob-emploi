'use strict'

const productName = 'Bob Emploi'
const urlRoot = 'https://www.bob-emploi.fr/'

const pages = {
  '': {
    description: `Accélérez votre recherche d'emploi avec ${productName}`,
  },
  'contribuer': {
    description: 'Ensemble créons le service public de demain.',
    title: 'Contribuer',
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
      'toute transparence : les chiffres clés, nos financements, les plans ' +
      'pour la suite',
    title: 'Transparence',
  },
  'vie-privee': {
    description: 'Nous nous engageons à respecter le meilleur niveau de ' +
      'protection en conformité avec la réglementation Informatique et Liberté.',
    title: 'Vie privée',
  },
}

function isOpenGraphBot(userAgent) {
  return /Facebot|facebookexternalhit|Slackbot|twitterbot/.test(userAgent.value)
}

function openGraphContent(pageUrl, {title, description}) {
  const fullTitle = title ? `Bob Emploi - ${title}` : 'Bob Emploi'
  const url = `${urlRoot}/${pageUrl}`
  return `<html>
  <head>
    <title>${fullTitle}</title>
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${fullTitle}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="https://www.bob-emploi.fr/assets/bob-circle-picto.png" />
    <meta property="fb:app_id" content="1576288225722008" />
  </head>
</html>`
}

exports.handler = (event, context, callback) => {
  const request = event.Records[0].cf.request
  const userAgents = request.headers['user-agent'] || []
  if (/^\/assets\//.test(request.uri) || !userAgents.some(isOpenGraphBot)) {
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
    body: openGraphContent(pageUrl, pages[pageUrl]),
    headers: {
      'content-encoding': [{
        key: 'Content-Encoding',
        value: 'UTF-8',
      }],
      'content-type': [{
        key: 'Content-Type',
        value: 'text/html',
      }],
    },
    status: '200',
    statusDescription: 'OK',
  }
  callback(null, response)
}
