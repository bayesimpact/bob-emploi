import {expect} from 'chai'
import convertImiloPropsToBobProps from '../src/import-from-imilo/imilo'


describe('convertImiloPropsToBobProps', (): void => {
  it('should convert properly if all props are present', (): void => {
    const imiloProps = {
      Coordonnées: {
        currentAddress: {
          fullCity: {
            codeCommune: '32208',
            description: 'Lectoure',
          },
          zipCode: '32700',
        },
      },
      Cursus: [
        {fullAcademicLevel: 'Bac', grade: 2},
        {fullAcademicLevel: 'BTS', grade: 9},
      ],
      Identité: {
        childrenNumber: 2,
        identity: {
          birthDate: '15/05/1982',
          civility: '1',
          email: 'test@example.com',
          firstname: 'Angèle',
          fullCivility: 'Madame',
          lastname: 'Dupont',
          situation: 4,
        },
      },
      Mobilité: {
        drivingLicenses: [{type: 8}],
        fullRadiusMobility: 'département',
        radiusMobility: 2,
      },
      Situations: [{
        fullPracticedJob: {
          code: 'G1101',
          description: 'Accueil touristique',
        },
      }],
    } as const
    const before = new Date()
    const bobProps = convertImiloPropsToBobProps(imiloProps)
    const after = new Date()
    expect(bobProps.projects).to.be.ok
    expect(bobProps.projects![0]).to.be.ok
    const {createdAt} = bobProps.projects![0]!
    expect(createdAt).to.be.ok
    expect(new Date(createdAt!)).to.be.at.least(before)
    expect(new Date(createdAt!)).to.be.at.most(after)
    // @ts-ignore
    delete bobProps.projects[0].createdAt
    expect(bobProps).to.eql({
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
