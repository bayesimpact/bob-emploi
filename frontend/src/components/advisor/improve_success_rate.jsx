import React from 'react'

import {Colors} from 'components/theme'

import {AdviceCard, HowToBox} from './base'


class FullAdviceCard extends React.Component {
  renderTitle(title) {
    const style = {
      fontSize: 16,
      fontStyle: 'italic',
      fontWeight: 500,
      marginBottom: 10,
      textTransform: 'uppercase',
    }
    return <header style={style}>
      {title}
    </header>
  }

  renderHow(style) {
    // TODO(guillaume) : Make advice personalized.
    return <div style={style}>
      {this.renderTitle('Comment :')}
      <HowToBox
          title="Mettez en avant les bonnes compétences"
          style={{marginTop: 10}}>
        <div style={{fontStyle: 'italic'}}>
          Par exemple en fonction des entreprises que vous visez
          certains logiciels seront plus ou moins demandés&nbsp;:
        </div>
        <ul style={{fontSize: 15, lineHeight: 1.47, marginBottom: 0}}>
          <li>
            <strong>En cabinet d'expertise comptable : </strong>
            SAGE, Cegid, Coala, CCMX, Quadratus, Pegase, Silae.
          </li>
          <li style={{marginTop: 10}}>
            <strong>En entreprise PME : </strong>
            SAGE, Hypervision, l'outil d'ADP GSI, le groupe Cegid/ CCMX.
          </li>
          <li style={{marginTop: 10}}>
            <strong>Grande entreprise : </strong>
            HRAccess, Pléiades et GXP d'ADP.
          </li>
        </ul>
      </HowToBox>

      <HowToBox
          title="Faites une formation pour acquérir de nouvelles compétences"
          reason="Vous nous avez dit ne pas trouver assez d'offres">
        <div style={{fontStyle: 'italic'}}>
          Vous pourriez par exemple apprendre à&nbsp;:
        </div>
        <ul style={{fontSize: 15, lineHeight: 1.47, marginBottom: 0}}>
          <li>Établir les déclarations fiscales et sociales</li>
          <li>Établir un rapprochement bancaire</li>
          <li>Réaliser un suivi des dossiers clients et fournisseurs</li>
        </ul>
      </HowToBox>
      <HowToBox
          title="Compenser votre manque d'expérience dans ce métier avec vos expériences sociales"
          reason="Vous nous avez dit que votre âge était un obstacle">
        <span style={{fontStyle: 'italic'}}>
          Même si cela ne correspond pas au job recherché, cela
          montre que l'on est actif, débrouillard et curieux.
        </span>
      </HowToBox>
    </div>
  }

  renderWhy(style) {
    const frameStyle = {
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      borderRadius: 4,
      padding: '30px 0',
      textAlign: 'center',
    }
    return <div style={style}>
      {this.renderTitle('Pourquoi :')}
      <div style={frameStyle}>
        Vous auriez pu obtenir
        <div style={{fontSize: 30, marginBottom: 10}}>
          <strong style={{color: Colors.GREENISH_TEAL, fontSize: 40}}>4X</strong> plus d'entretiens
        </div>
      </div>
    </div>
  }

  render() {
    return <AdviceCard
        title="Mettez plus en valeur votre profil pour obtenir plus d'entretiens"
        goal="obtenir d'autres secteurs"
        {...this.props}>
      <div style={{display: 'flex'}}>
        {this.renderWhy({flex: 1, marginRight: 30})}
        {this.renderHow({flex: 2, marginRight: 30})}
      </div>
    </AdviceCard>
  }
}


export default {FullAdviceCard}
