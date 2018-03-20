import {expect} from 'chai'
import {genderizeJob, getIMTURL, getJobSearchURL,
  getJobPlacesFromDepartementStats} from 'store/job.js'
import {jobFromSuggestion} from 'components/suggestions'

describe('jobFromSuggestion', () => {

  it('should assemble a job proto from a suggestion', () => {
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
  it('should add genderize names when available', () => {
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


describe('getJobPlacesFromDepartementStats', () => {
  it('should get back suggestions of jobs in departements without twice the same job', () => {
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


describe('genderizeJob', () => {
  it('should return an empty string for an empty job', () => {
    const name = genderizeJob({}, 'FEMININE')
    expect(name).to.equal('')
  })
  it('should return the feminine name if FEMININE gender', () => {
    const name = genderizeJob({
      feminineName: 'feminineFoo',
      masculineName: 'masculineFoo',
      name: 'foo',
    }, 'FEMININE')
    expect(name).to.equal('feminineFoo')
  })
  it('should return the masculine name if MASCULINE gender', () => {
    const name = genderizeJob({
      feminineName: 'feminineFoo',
      masculineName: 'masculineFoo',
      name: 'foo',
    }, 'MASCULINE')
    expect(name).to.equal('masculineFoo')
  })
  it('should return the default name if no gender', () => {
    const name = genderizeJob({
      feminineName: 'feminineFoo',
      masculineName: 'masculineFoo',
      name: 'foo',
    }, undefined)
    expect(name).to.equal('foo')
  })
  it('should return the default name if unknown gender', () => {
    const name = genderizeJob({
      feminineName: 'feminineFoo',
      masculineName: 'masculineFoo',
      name: 'foo',
    }, 'WOMAN')
    expect(name).to.equal('foo')
  })
  it('should return the default name if the genderized name is missing', () => {
    const name = genderizeJob({
      masculineName: 'masculineFoo',
      name: 'foo',
    }, 'FEMININE')
    expect(name).to.equal('foo')
  })
})


describe('getJobSearchURL', () => {
  it('should return an empty string for an empty job', () => {
    const url = getJobSearchURL({}, 'FEMININE')
    expect(url).to.equal('')
  })
  it('should return a URL with genderized job name if gender', () => {
    const name = getJobSearchURL({
      feminineName: 'feminineFoo',
      masculineName: 'masculineFoo',
      name: 'foo',
    }, 'FEMININE')
    expect(name).to.equal(
      'https://www.google.fr/search?q=m%C3%A9tier%20feminineFoo')
  })
  it('should return a URL with the default name if no gender', () => {
    const name = getJobSearchURL({
      feminineName: 'feminineFoo',
      masculineName: 'masculineFoo',
      name: 'foo',
    }, undefined)
    expect(name).to.equal('https://www.google.fr/search?q=m%C3%A9tier%20foo')
  })
  it('should return a URL with the default name if unknown gender', () => {
    const name = getJobSearchURL({
      feminineName: 'feminineFoo',
      masculineName: 'masculineFoo',
      name: 'foo',
    }, 'WOMAN')
    expect(name).to.equal('https://www.google.fr/search?q=m%C3%A9tier%20foo')
  })
})


describe('getIMTURL', () => {
  it('should return a URL for the IMT', () => {
    const url = getIMTURL({codeOgr: '15546'}, {departementId: '69'})
    expect(url).to.equal(
      'http://candidat.pole-emploi.fr/marche-du-travail/statistiques?codeMetier=15546' +
      '&codeZoneGeographique=69&typeZoneGeographique=DEPARTEMENT')
  })

  it('should return an empty string when called with empty objects', () => {
    expect(getIMTURL()).to.equal('')
    expect(getIMTURL({}, {})).to.equal('')
    expect(getIMTURL({codeOgr: '15546'}, {})).to.equal('')
    expect(getIMTURL({}, {departementId: '69'})).to.equal('')
  })
})
