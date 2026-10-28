import { describe, it, expect } from 'vitest';
import { normalizePrefectureName } from './index';

describe('normalizePrefectureName', () => {
  it('should normalize Hokkaido regions to 北海道', () => {
    expect(normalizePrefectureName('宗谷地方')).toBe('北海道');
    expect(normalizePrefectureName('上川地方')).toBe('北海道');
    expect(normalizePrefectureName('石狩地方')).toBe('北海道');
  });

  it('should normalize Okinawa regions to 沖縄県', () => {
    expect(normalizePrefectureName('沖縄本島地方')).toBe('沖縄県');
    expect(normalizePrefectureName('宮古島地方')).toBe('沖縄県');
  });

  it('should normalize Kagoshima regions to 鹿児島県', () => {
    expect(normalizePrefectureName('奄美地方')).toBe('鹿児島県');
    expect(normalizePrefectureName('鹿児島県（奄美地方除く）')).toBe('鹿児島県');
  });

  it('should normalize Tokyo Region to 東京都', () => {
    expect(normalizePrefectureName('東京地方')).toBe('東京都');
  });

  it('should leave other prefectures unchanged', () => {
    expect(normalizePrefectureName('大阪府')).toBe('大阪府');
    expect(normalizePrefectureName('神奈川県')).toBe('神奈川県');
  });
});

import defaultExport from './index';

describe('processEarthquakeToMemory', () => {
  it('should parse an array of earthquakes', () => {
    const earthquakesData: any[] = [];
    const mockReport = {
      Body: {
        Earthquake: [
          {
            OriginTime: '2026-09-14T20:00:00+09:00',
            Hypocenter: { Area: { Name: '福島県沖' } },
            Magnitude: '4.3'
          },
          {
            OriginTime: '2026-09-14T19:55:00+09:00',
            Hypocenter: { Area: { Name: '宮城県沖' } },
            Magnitude: { '#text': '4.1' }
          }
        ],
        Intensity: { Observation: { MaxInt: '2' } }
      }
    };

    defaultExport.processEarthquakeToMemory(mockReport, 'test-id', '発表', earthquakesData);

    expect(earthquakesData.length).toBe(2);
    expect(earthquakesData[0].hypocenterName).toBe('福島県沖');
    expect(earthquakesData[0].magnitude).toBe('4.3');
    expect(earthquakesData[1].magnitude).toBe('4.1');
    expect(earthquakesData[1].maxIntensity).toBe('2');
  });
});

import { pruneExpiredTyphoons, parseQuakeCoordinate } from './index';

describe('pruneExpiredTyphoons', () => {
  it('should remove typhoons older than 3 days', () => {
    const now = new Date('2026-10-29T00:00:00Z').getTime();
    const typhoons = [
      { tcNumber: '2627', updatedAt: '2026-10-07T12:00:00Z' }, // 22 days ago -> expired
      { tcNumber: '2630', updatedAt: '2026-10-25T12:00:00Z' }, // 3.5 days ago -> expired
      { tcNumber: '2631', updatedAt: '2026-10-28T15:00:00Z' }, // < 1 day ago -> active
    ];
    const filtered = pruneExpiredTyphoons(typhoons, now);
    expect(filtered.map(t => t.tcNumber)).toEqual(['2631']);
  });
});

describe('parseQuakeCoordinate', () => {
  it('should parse coordinate string into lat, lon, and depth in km', () => {
    const coord = '+32.3+130.5-10000/';
    expect(parseQuakeCoordinate(coord)).toEqual({
      lat: 32.3,
      lon: 130.5,
      depthKm: 10
    });
  });

  it('should handle depth when missing', () => {
    const coord = '+35.1+139.8/';
    expect(parseQuakeCoordinate(coord)).toEqual({
      lat: 35.1,
      lon: 139.8,
      depthKm: null
    });
  });
});

