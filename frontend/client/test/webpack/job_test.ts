import {expect} from 'chai'
import {genderizeJob, getIMTURL, getJobSearchURL, getApplicationModes,
  getJobPlacesFromDepartementStats, getApplicationModeText, getPEJobBoardURL} from 'store/job'
import {jobFromSuggestion} from 'components/suggestions'

// @ts-ignore
import {ApplicationMode} from 'api/job_pb'

describe('jobFromSuggestion', (): void => {

  it('should assemble a job proto from a suggestion', (): void => {
    const job = jobFromSuggestion({
      codeOgr: '38972',
      codeRome: 'M1403',
      libelleAppellationCourt: 'Data Manager(euse)',
      libelleAppellationLong: 'Data Manager / Manageuse',
      libelleRome: 'Études et prospectives socio-économiques',
    })
    expect(job).to.deep.equal({
      codeOgr: '38972',
      jobGroup: {
        name: 'Études et prospectives socio-économiques',
        romeId: 'M1403',
      },
      name: 'Data Manager(euse)',
    })
  })
  it('should add genderize names when available', (): void => {
    const job = jobFromSuggestion({
      codeOgr: '38972',
      codeRome: 'M1403',
      libelleAppellationCourt: 'Data Manager(euse)',
      libelleAppellationCourtFeminin: 'Data Manageuse',
      libelleAppellationCourtMasculin: 'Data Manager',
      libelleAppellationLong: 'Data Manager / Manageuse',
      libelleRome: 'Études et prospectives socio-économiques',
    })
    expect(job).to.deep.equal({
      codeOgr: '38972',
      feminineName: 'Data Manageuse',
      jobGroup: {
        name: 'Études et prospectives socio-économiques',
        romeId: 'M1403',
      },
      masculineName: 'Data Manager',
      name: 'Data Manager(euse)',
    })
  })
})


describe('getJobPlacesFromDepartementStats', (): void => {
  it('should get back suggestions of jobs in departements without twice the same job', (): void => {
    const departementStats = [
      {
        'departementId': '06',
        'departementInName': 'En Guyanne',
        'jobGroups': [
          {
            'name': 'Professeur de piano',
            'offers': 123,
            'romeId': 'I1202',
          },
          {
            'name': 'Professeur de guitarre',
            'offers': 120,
            'romeId': 'I1203',
          },
        ],
      }, {
        'departementId': '2A',
        'departementInName': 'A la réunion',
        'jobGroups': [
          {
            'name': 'Professeur de piano',
            'offers': 123,
            'romeId': 'I1202',
          },
          {
            'name': 'Professeur de flûte',
            'offers': 120,
            'romeId': 'I1203',
          },
        ],
      },
    ]
    const jobPlaces = getJobPlacesFromDepartementStats(departementStats)
    expect(jobPlaces[0].jobGroup).to.equal('Professeur de piano')
    expect(jobPlaces[0].inDepartement).to.equal('En Guyanne')
    expect(jobPlaces[1].jobGroup).to.equal('Professeur de flûte')
    expect(jobPlaces[1].inDepartement).to.equal('A la réunion')
    expect(jobPlaces[2].jobGroup).to.equal('Professeur de guitarre')
    expect(jobPlaces[2].inDepartement).to.equal('En Guyanne')
  })
})


describe('genderizeJob', (): void => {
  it('should return an empty string for an undefined job', (): void => {
    const name = genderizeJob(undefined, undefined)
    expect(name).to.equal('')
  })
  it('should return an empty string for an empty job', (): void => {
    const name = genderizeJob({}, 'FEMININE')
    expect(name).to.equal('')
  })
  it('should return an empty string for a job with no name', (): void => {
    const name = genderizeJob({jobGroup: {name: 'group name'}}, 'FEMININE')
    expect(name).to.equal('')
  })
  it('should return the feminine name if FEMININE gender', (): void => {
    const name = genderizeJob({
      feminineName: 'feminineFoo',
      masculineName: 'masculineFoo',
      name: 'foo',
    }, 'FEMININE')
    expect(name).to.equal('feminineFoo')
  })
  it('should return the masculine name if MASCULINE gender', (): void => {
    const name = genderizeJob({
      feminineName: 'feminineFoo',
      masculineName: 'masculineFoo',
      name: 'foo',
    }, 'MASCULINE')
    expect(name).to.equal('masculineFoo')
  })
  it('should return the default name if no gender', (): void => {
    const name = genderizeJob({
      feminineName: 'feminineFoo',
      masculineName: 'masculineFoo',
      name: 'foo',
    }, undefined)
    expect(name).to.equal('foo')
  })
  it('should return the default name if unknown gender', (): void => {
    const name = genderizeJob({
      feminineName: 'feminineFoo',
      masculineName: 'masculineFoo',
      name: 'foo',
    }, 'UNKNOWN_GENDER')
    expect(name).to.equal('foo')
  })
  it('should return the default name if the genderized name is missing', (): void => {
    const name = genderizeJob({
      masculineName: 'masculineFoo',
      name: 'foo',
    }, 'FEMININE')
    expect(name).to.equal('foo')
  })
})


describe('getJobSearchURL', (): void => {
  it('should return an empty string for an empty job', (): void => {
    const url = getJobSearchURL({}, 'FEMININE')
    expect(url).to.equal('')
  })
  it('should return a URL with genderized job name if gender', (): void => {
    const name = getJobSearchURL({
      feminineName: 'feminineFoo',
      masculineName: 'masculineFoo',
      name: 'foo',
    }, 'FEMININE')
    expect(name).to.equal(
      'https://www.google.fr/search?q=m%C3%A9tier%20feminineFoo')
  })
  it('should return a URL with the default name if no gender', (): void => {
    const name = getJobSearchURL({
      feminineName: 'feminineFoo',
      masculineName: 'masculineFoo',
      name: 'foo',
    }, undefined)
    expect(name).to.equal('https://www.google.fr/search?q=m%C3%A9tier%20foo')
  })
  it('should return a URL with the default name if unknown gender', (): void => {
    const name = getJobSearchURL({
      feminineName: 'feminineFoo',
      masculineName: 'masculineFoo',
      name: 'foo',
    }, 'UNKNOWN_GENDER')
    expect(name).to.equal('https://www.google.fr/search?q=m%C3%A9tier%20foo')
  })
})


describe('getIMTURL', (): void => {
  it('should return a URL for the IMT', (): void => {
    const url = getIMTURL({codeOgr: '15546'}, {departementId: '69'})
    expect(url).to.equal(
      'http://candidat.pole-emploi.fr/marche-du-travail/statistiques?codeMetier=15546' +
      '&codeZoneGeographique=69&typeZoneGeographique=DEPARTEMENT')
  })

  it('should return an empty string when called with empty objects', (): void => {
    expect(getIMTURL(undefined, undefined)).to.equal('')
    expect(getIMTURL({}, {})).to.equal('')
    expect(getIMTURL({codeOgr: '15546'}, {})).to.equal('')
    expect(getIMTURL({}, {departementId: '69'})).to.equal('')
  })
})

describe('getPEJobBoardURL', (): void => {
  it('should return a URL for pole-emploi job board', (): void => {
    const url = getPEJobBoardURL({jobGroup: {romeId: 'A1234'}}, {cityId: '31555'})
    expect(url).to.equal(
      'https://candidat.pole-emploi.fr/offres/recherche?lieux=31555&motsCles=A1234')
  })

  it('should return an empty string when called with empty objects', (): void => {
    expect(getPEJobBoardURL()).to.equal('')
    expect(getPEJobBoardURL({}, {})).to.equal('')
    expect(getPEJobBoardURL({jobGroup: {romeId: 'A1234'}}, {})).to.equal('')
    expect(getPEJobBoardURL({}, {cityId: '31555'})).to.equal('')
  })

  it('should add specific query parameters if given', (): void => {
    const url = getPEJobBoardURL({jobGroup: {romeId: 'A1234'}}, {cityId: '31555'}, {emission: 7})
    expect(url).to.equal(
      'https://candidat.pole-emploi.fr/offres/recherche?emission=7&lieux=31555&motsCles=A1234')
  })

  it('should send to 1st arrondissement in Lyon', (): void => {
    const url = getPEJobBoardURL({jobGroup: {romeId: 'A1234'}}, {cityId: '69123'})
    expect(url).to.equal(
      'https://candidat.pole-emploi.fr/offres/recherche?lieux=69381&motsCles=A1234')
  })

  it('should send to département in Paris', (): void => {
    const url = getPEJobBoardURL({jobGroup: {romeId: 'A1234'}}, {cityId: '75056'})
    expect(url).to.equal(
      'https://candidat.pole-emploi.fr/offres/recherche?lieux=75D&motsCles=A1234')
  })

  it('should send to 1st arrondissement in Marseille, with larger radius', (): void => {
    const url = getPEJobBoardURL({jobGroup: {romeId: 'A1234'}}, {cityId: '13055'})
    expect(url).to.equal(
      'https://candidat.pole-emploi.fr/offres/recherche?lieux=13201&motsCles=A1234&rayon=20')
  })
})


describe('getApplicationModes', (): void => {
  it('should return the application modes for a job group with one FAP', (): void => {
    const jobGroup: bayes.bob.JobGroup = {applicationModes: {FAP: {modes: [
      {mode: 'PERSONAL_OR_PROFESSIONAL_CONTACTS', percentage: 4},
      {mode: 'PLACEMENT_AGENCY', percentage: 3},
      {mode: 'SPONTANEOUS_APPLICATION', percentage: 2},
      {mode: 'UNDEFINED_APPLICATION_MODE', percentage: 1},
    ]}}}
    const allModes = getApplicationModes(jobGroup)
    const bestMode = allModes[0]
    expect(bestMode.mode).to.equal('PERSONAL_OR_PROFESSIONAL_CONTACTS')
    expect(bestMode.percentage).to.equal(4)
    const worstMode = allModes[allModes.length - 1]
    expect(worstMode.mode).to.equal('UNDEFINED_APPLICATION_MODE')
    expect(worstMode.percentage).to.equal(1)
  })

  it('should return the application modes for a job group with several FAPs', (): void => {
    const jobGroup: bayes.bob.JobGroup = {applicationModes: {
      FAP: {modes: [
        {mode: 'PERSONAL_OR_PROFESSIONAL_CONTACTS', percentage: 50},
        {mode: 'PLACEMENT_AGENCY', percentage: 20},
        {mode: 'SPONTANEOUS_APPLICATION', percentage: 10},
        {mode: 'UNDEFINED_APPLICATION_MODE', percentage: 5},
      ]},
      otherFAP: {modes: [
        {mode: 'PERSONAL_OR_PROFESSIONAL_CONTACTS', percentage: 10},
        {mode: 'PLACEMENT_AGENCY', percentage: 60},
        {mode: 'SPONTANEOUS_APPLICATION', percentage: 20},
        {mode: 'UNDEFINED_APPLICATION_MODE', percentage: 10},
      ]},
    }} as const
    const allModes = getApplicationModes(jobGroup)
    const bestMode = allModes[0]
    expect(bestMode.mode).to.equal('PERSONAL_OR_PROFESSIONAL_CONTACTS')
    expect(bestMode.percentage).to.equal(50)
    const worstMode = allModes[allModes.length - 1]
    expect(worstMode.mode).to.equal('UNDEFINED_APPLICATION_MODE')
    expect(worstMode.percentage).to.equal(5)
  })
})


describe('getApplicationModeText', (): void => {
  const allModes = Object.keys(ApplicationMode) as readonly bayes.bob.ApplicationMode[]
  allModes.map((mode): void => {
    ApplicationMode[mode] && it(`should return a non-empty string for ${mode}`, (): void =>
      expect(getApplicationModeText(mode)).to.not.be.empty)
  })

  it('should return the same string for empty mode and 0 mode', (): void => {
    const zeroMode = allModes.find((mode): boolean => !ApplicationMode[mode])
    expect(getApplicationModeText(undefined)).to.equal(getApplicationModeText(zeroMode))
  })
})
