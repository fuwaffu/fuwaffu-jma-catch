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
