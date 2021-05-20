import adieLogo from 'images/adie-logo.png'
import afeLogo from 'images/afe-ico.png'
import poleEmploiLogo from 'images/ple-emploi-ico.png'

export default [
  {
    description: 'pour réféchir, définir et affiner une idée.',
    from: 'Pôle emploi',
    logo: poleEmploiLogo,
    name: "Activ'crea",
    url: 'http://www.pole-emploi.fr/candidat/activ-crea-@/article.jspz?id=325937',
  },
  {
    description: 'pour calculer vos charges en micro-entreprise.',
    from: 'Agence France Entrepreneur',
    logo: afeLogo,
    name: 'Afecreation',
    url: 'https://www.afecreation.fr/pid11436/calculatrice-de-charges-micro-entrepreneur.html?espace=1',
  },
  {
    description: 'pour financer sa micro-entreprise.',
    from: "Association pour le Droit à l'Initiative Économique",
    logo: adieLogo,
    name: 'Adie',
    url: 'https://www.adie.org?utm_source=bob-emploi',
  },
] as const
