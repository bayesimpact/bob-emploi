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
        currentAddress: {
          fullCity: {
            codeCommune: '32208',
            description: 'Lectoure',
          },
          zipCode: '32700',
        },
      },
      'Cursus': [{grade: 2}, {grade: 9}],
      'Identité': {
        childrenNumber: 2,
        identity: {
          birthDate: '15/05/1982',
          civility: 1,
          email: 'test@example.com',
          firstname: 'Angèle',
          lastname: 'Dupont',
          situation: 4,
        },
      },
      'Mobilité': {
        drivingLicenses: [{type: 8}],
        radiusMobility: 2,
      },
      'Situations': [{
        fullPracticedJob: {
          code: 'G1101',
          description: 'Accueil touristique',
        },
      }],
    }
    const bobProps = convertImiloPropsToBobProps(imiloProps)
    expect(bobProps).to.deep.eql({
      profile: {
        email: 'test@example.com',
        familySituation: 'SINGLE_PARENT_SITUATION',
        gender: 'FEMININE',
        hasCarDrivingLicense: 'TRUE',
        highestDegree: 'BTS_DUT_DEUG',
        lastName: 'Dupont',
        name: 'Angèle',
        origin: 'FROM_PE_COUNSELOR',
        yearOfBirth: 1982,
      },
      projects: [{
        areaType: 'DEPARTEMENT',
        city: {
          cityId: '32208',
          departementId: '32',
          name: 'Lectoure',
          postcodes: '32700',
        },
        mobility: {
          areaType: 'DEPARTEMENT',
          city: {
            cityId: '32208',
            departementId: '32',
            name: 'Lectoure',
            postcodes: '32700',
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
