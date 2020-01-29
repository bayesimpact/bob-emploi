import {expect} from 'chai'
import _forIn from 'lodash/forIn'
import {parseQueryString, parsedValueFlattener, removeAmpersandDoubleEncoding} from 'store/parse'


describe('parseQueryString', (): void => {
  it('should parse query strings', (): void => {
    expect(parseQueryString('a=1&b=2')).to.eql({a: '1', b: '2'})
  })

  it('should parse empty query strings', (): void => {
    expect(parseQueryString('a=&b=')).to.eql({a: '', b: ''})
  })

  it('should parse multiple values and get only the last one', (): void => {
    expect(parseQueryString('a=1&a=2')).to.eql({a: '2'})
  })

  it('should parse multiple values and get only the first one', (): void => {
    expect(parseQueryString('a=1&a=2', 'first')).to.eql({a: '1'})
  })

  it('should parse multiple values and join them', (): void => {
    expect(parseQueryString('a=1&a=2', 'join')).to.eql({a: '1,2'})
  })

  it('should not include undefined values', (): void => {
    expect(parseQueryString('a&b=3')).to.eql({b: '3'})
  })
})


describe('parsedValueFlattener', (): void => {
  it('should not modify string values', (): void => {
    _forIn(parsedValueFlattener, (flattener: typeof parsedValueFlattener.join): void => {
      expect(flattener('a')).to.eq('a')
    })
  })

  it('should not modify empty string values', (): void => {
    _forIn(parsedValueFlattener, (flattener: typeof parsedValueFlattener.join): void => {
      expect(flattener('')).to.eq('')
    })
  })

  it('should keep undefined values', (): void => {
    _forIn(parsedValueFlattener, (flattener: typeof parsedValueFlattener.join): void => {
      expect(flattener(undefined)).to.eq(undefined)
    })
  })

  it('should make null value undefined', (): void => {
    _forIn(parsedValueFlattener, (flattener: typeof parsedValueFlattener.join): void => {
      expect(flattener(null)).to.eq(undefined)
    })
  })

  describe('.join', (): void => {
    it('should join values', (): void => {
      expect(parsedValueFlattener.join(['a', 'b', 'c'])).to.eq('a,b,c')
    })
  })

  describe('.first', (): void => {
    it('should pick the first value', (): void => {
      expect(parsedValueFlattener.first(['a', 'b', 'c'])).to.eq('a')
    })
  })

  describe('.last', (): void => {
    it('should pick the last value', (): void => {
      expect(parsedValueFlattener.last(['a', 'b', 'c'])).to.eq('c')
    })
  })
})


describe('removeAmpersandDoubleEncoding', (): void => {
  it('should not do anything without a double encoded query string', (): void => {
    expect(removeAmpersandDoubleEncoding({hash: '', pathname: '/foo', search: ''})).to.eq(undefined)
    expect(removeAmpersandDoubleEncoding({
      hash: '',
      pathname: '/foo',
      search: '?a=3&b=2&',
    })).to.eq(undefined)
  })

  it('should rewrite the query when double encoding', (): void => {
    expect(removeAmpersandDoubleEncoding({
      hash: '#finalHash',
      pathname: '/foo',
      search: '?a=3&amp;b=2&amp;c=3',
    })).to.eq('/foo?a=3&b=2&c=3#finalHash')
  })

  it('should handle multiple params with the same key', (): void => {
    expect(removeAmpersandDoubleEncoding({
      hash: '#finalHash',
      pathname: '/foo',
      search: '?a=1&amp;a=2&amp;a=3',
    })).to.eq('/foo?a=1&a=2&a=3#finalHash')
  })
})
