import { describe, it, expect } from 'vitest';
import defaultExport, { normalizePrefectureName, pruneExpiredTyphoons, parseQuakeCoordinate } from './index';

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

  it('should overwrite and merge earthquake details when subsequent reports arrive for the same eventId', () => {
    const earthquakesData: any[] = [];
    
    // 1st report: 震度速報 (Intensity only)
    const report1 = {
      Head: { EventID: '20261029010000', TargetDateTime: '2026-10-29T01:00:00+09:00' },
      Body: { Intensity: { Observation: { MaxInt: '3' } } }
    };
    defaultExport.processEarthquakeToMemory(report1, 'xml-1', '発表', earthquakesData);
    expect(earthquakesData.length).toBe(1);
    expect(earthquakesData[0].maxIntensity).toBe('3');
    expect(earthquakesData[0].hypocenterName).toBe('震源調査中');

    // 2nd report: 震源・震度に関する情報 (Hypocenter and update intensity to 4)
    const report2 = {
      Head: { EventID: '20261029010000' },
      Body: {
        Earthquake: {
          OriginTime: '2026-10-29T01:00:00+09:00',
          Hypocenter: {
            Area: { Name: '熊本県熊本地方', Coordinate: '+32.8+130.7-10000/' }
          },
          Magnitude: '4.5'
        },
        Intensity: { Observation: { MaxInt: '4' } }
      }
    };
    defaultExport.processEarthquakeToMemory(report2, 'xml-2', '発表', earthquakesData);
    expect(earthquakesData.length).toBe(1);
    expect(earthquakesData[0].maxIntensity).toBe('4');
    expect(earthquakesData[0].hypocenterName).toBe('熊本県熊本地方');
    expect(earthquakesData[0].magnitude).toBe('4.5');
    expect(earthquakesData[0].depth).toBe(10);
    expect(earthquakesData[0].lat).toBe(32.8);
    expect(earthquakesData[0].lon).toBe(130.7);
    expect(earthquakesData[0].xmlId).toBe('xml-2');
  });
});

describe('pruneExpiredTyphoons', () => {
  it('should remove typhoons older than 3 days', () => {
    const now = new Date('2026-10-29T00:00:00Z').getTime();
    const typhoons = [
      { tcNumber: '2627', updatedAt: '2026-10-07T12:00:00Z' },
      { tcNumber: '2630', updatedAt: '2026-10-25T12:00:00Z' },
      { tcNumber: '2631', updatedAt: '2026-10-28T15:00:00Z' },
    ];
    const filtered = pruneExpiredTyphoons(typhoons, now);
    expect(filtered.map(t => t.tcNumber)).toEqual(['2631']);
  });
});

describe('processTyphoonToMemory', () => {
  it('should not overwrite newer typhoon analysis with older telegram and should merge 5-day forecasts', () => {
    const typhoonsData: any[] = [];
    const makeReport = (dateTime: string, lat: string, lon: string, forecastTimes: string[]) => ({
      Body: {
        MeteorologicalInfos: {
          MeteorologicalInfo: [
            {
              DateTime: { '#text': dateTime, '@_type': '実況' },
              Item: {
                Kind: [
                  { Property: { TyphoonNamePart: { Number: 2631, NameKana: 'インファ', Name: 'IN-FA' } } },
                  { Property: { CenterPart: { Coordinate: { '@_type': '中心位置（度）', '#text': `+${lat}+${lon}/` }, Pressure: { '#text': 940 } } } }
                ]
              }
            },
            ...forecastTimes.map(ft => ({
              DateTime: { '#text': ft, '@_type': '予報' },
              Item: {
                Kind: [
                  { Property: { CenterPart: { ProbabilityCircle: { BasePoint: { '@_type': '中心位置（度）', '#text': '+20.0+145.0/' } } } } }
                ]
              }
            }))
          ]
        }
      }
    });

    // 1. Newer 5-day report (21:00 JST) with 24h & 120h forecasts
    defaultExport.processTyphoonToMemory(
      makeReport('2026-10-29T21:00:00+09:00', '16.6', '151.3', ['2026-10-30T21:00:00+09:00', '2026-11-03T21:00:00+09:00']),
      'vptw61-new',
      '2026-10-29T12:40:44Z',
      typhoonsData
    );
    expect(typhoonsData.length).toBe(1);
    expect(typhoonsData[0].current.lat).toBe(16.6);
    expect(typhoonsData[0].forecasts.length).toBe(2);

    // 2. Older report (03:00 JST) arriving out of order -> must be ignored
    defaultExport.processTyphoonToMemory(
      makeReport('2026-10-29T03:00:00+09:00', '15.6', '156.3', ['2026-10-30T03:00:00+09:00']),
      'vptw61-old',
      '2026-10-28T18:40:59Z',
      typhoonsData
    );
    expect(typhoonsData[0].current.lat).toBe(16.6);
    expect(typhoonsData[0].forecasts.length).toBe(2);

    // 3. Same-time 3-day report (21:00 JST, only 24h forecast) -> must preserve 120h forecast
    defaultExport.processTyphoonToMemory(
      makeReport('2026-10-29T21:00:00+09:00', '16.6', '151.3', ['2026-10-30T21:00:00+09:00']),
      'vptw60-same',
      '2026-10-29T12:45:00Z',
      typhoonsData
    );
    expect(typhoonsData[0].forecasts.length).toBe(2);
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
