import React from 'react'


import ExternalLink from 'components/external_link'
import Trans from 'components/i18n_trans'

import type {Tool} from '../types/reorientation_tools'
import afpaLogo from './afpa-ico.png'
import capEmploiLogo from './cap-emploi-ico.png'
import hanploiLogo from './hanploi-ico.jpg'
import pixisLogo from './pixis-ico.png'

const linkInheritStyle = {
  color: 'inherit',
  textDecoration: 'inherit',
}

const getHandicapSpecificTools = (departementId?: string): readonly Tool[] => {
  const handicapSpecificTools: readonly Tool[] = [
    {
      description: "service public d'aide aux personnes en situation de handicap pour l'emploi",
      from: "Association de Gestion du Fonds pour l'Insertion professionnelle " +
        'des Personnes Handicapées',
      logo: capEmploiLogo,
      name: 'Cap emploi',
      url: departementId ? `https://www.capemploi-${departementId}.com` : 'https://www.agefiph.fr/annuaire', // checkURL
    },
    {
      description: 'experts en recrutement des personnes en situation de handicap',
      from: <Trans parent={null}>
        <ExternalLink style={linkInheritStyle} href="tel:+33144524069">
          01 44 52 40 69
        </ExternalLink><br />
        Du lundi au vendredi<br />
        de 9h30 à 13h et de 14h à 17h30
      </Trans>,
      logo: hanploiLogo,
      name: 'Hanploi',
      url: 'https://www.hanploi.com', // checkURL
    },
  ]

  return handicapSpecificTools
}

const _REORIENTATION_TOOLS: readonly Tool[] = [
  {
    description: 'pour explorer des centaines de métiers.',
    from: 'Pixis.co',
    logo: pixisLogo,
    name: 'Pixis',
    url: 'https://pixis.co', // checkURL
  },
  {
    description: "un questionnaire complet pour s'orienter.",
    from: 'Association pour la Formation Professionnelle des Adultes',
    logo: afpaLogo,
    name: 'Afpa',
    url: 'https://www.afpa.fr/id-metiers', // checkURL
  },
]

const getTools = (hasHandicap?: boolean, departementId?: string): readonly Tool[] => {
  if (!hasHandicap) {
    return _REORIENTATION_TOOLS
  }
  return [..._REORIENTATION_TOOLS, ...getHandicapSpecificTools(departementId)]
}

export default getTools
