import {expect} from 'chai'
import {convertImiloPropsToBobProps, getNestedValue} from '../src/import-from-imilo/imilo'


describe('getNestedValue', () => {
  const props = {a: {b: {c: 1}}}
  it('should get a nested value', () => {
    expect(getNestedValue(props, 'a', 'b', 'c')).to.equal(1)
  })

  it('should not fail if a branch is missing', () => {
    expect(getNestedValue(props, 'a', 'd')).to.equal(undefined)
  })

  it('should accept parameters as an array', () => {
    expect(getNestedValue(props, ['a', 'b', 'c'])).to.equal(1)
  })

  it('should use the second parameter as a default value', () => {
    expect(getNestedValue(props, ['a', 'd'], 2)).to.equal(2)
  })
})


describe('convertImiloPropsToBobProps', () => {
  it('should convert properly if all props are present', () => {
    const imiloProps = {
      'Coordonnées': {
        'Code postal': '33200',
        'Commune': 'Lectoure',
        'E-mail': 'test@example.com',
      },
      'Cursus': [{'Niveau certification': 'Niveau III'}],
      'Identité': {
        'Civilité': 'Madame',
        'Date de naissance': '15/05/1982',
        'Enfants à charge': 2,
        "Nom d'usage": 'Dupont',
        'Prénom': 'Angèle',
        'Situation familiale': 'Célibataire',
      },
      'Mobilité': {
        'Rayon de mobilité': 'Département',
      },
      'Situations': [{
        'Métier préparé': 'G1101 Accueil touristique',
      }],
    }
    const bobProps = convertImiloPropsToBobProps(imiloProps)
    expect(bobProps).to.deep.eql({
      profile: {
        email: 'test@example.com',
        familySituation: 'SINGLE_PARENT_SITUATION',
        gender: 'FEMININE',
        highestDegree: 'BTS_DUT_DEUG',
        lastName: 'Dupont',
        name: 'Angèle',
        origin: 'FROM_PE_COUNSELOR',
        yearOfBirth: 1982,
      },
      projects: [{
        mobility: {
          areaType: 'DEPARTEMENT',
          city: {
            departementId: '33',
            name: 'Lectoure',
            postcodes: '33200',
          },
        },
        targetJob: {
          jobGroup: {
            name: 'Accueil touristique',
            romeId: 'G1101',
          },
        },
      }],
    })
  })
})
