import { describe, it, expect } from 'vitest';
import { getRegionFromHypocenter, deduplicateEarthquakes, REGIONS } from './earthquakeUtils';

describe('earthquakeUtils', () => {
  describe('getRegionFromHypocenter', () => {
    it('should classify hypocenters into correct regions', () => {
      expect(getRegionFromHypocenter('福島県沖')).toBe('東北地方');
      expect(getRegionFromHypocenter('宮城県沖')).toBe('東北地方');
      expect(getRegionFromHypocenter('熊本県熊本地方')).toBe('九州地方');
      expect(getRegionFromHypocenter('日向灘')).toBe('九州地方');
      expect(getRegionFromHypocenter('石川県能登地方')).toBe('中部地方');
      expect(getRegionFromHypocenter('千葉県東方沖')).toBe('関東地方');
      expect(getRegionFromHypocenter('十勝沖')).toBe('北海道地方');
      expect(getRegionFromHypocenter('和歌山県北部')).toBe('近畿地方');
      expect(getRegionFromHypocenter('安芸灘')).toBe('中国地方');
      expect(getRegionFromHypocenter('伊予灘')).toBe('四国地方');
      expect(getRegionFromHypocenter('宮古島近海')).toBe('沖縄地方');
      expect(getRegionFromHypocenter('サハリン近海')).toBe('その他');
    });
  });

  describe('deduplicateEarthquakes', () => {
    it('should merge duplicate reports with the same originTime up to seconds', () => {
      const reports = [
        {
          xmlId: 'rep-1',
          originTime: '2026-10-29T01:30:15+09:00',
          hypocenterName: '震源調査中',
          magnitude: '',
          maxIntensity: '3',
        },
        {
          xmlId: 'rep-2',
          originTime: '2026-10-29T01:30:15+09:00',
          hypocenterName: '熊本県熊本地方',
          magnitude: '4.2',
          maxIntensity: '3',
          depth: 10,
          lat: 32.8,
          lon: 130.7,
        }
      ];

      const merged = deduplicateEarthquakes(reports);
      expect(merged.length).toBe(1);
      expect(merged[0].hypocenterName).toBe('熊本県熊本地方');
      expect(merged[0].magnitude).toBe('4.2');
      expect(merged[0].maxIntensity).toBe('3');
      expect(merged[0].depth).toBe(10);
    });

    it('should merge duplicate reports by eventId', () => {
      const reports = [
        {
          eventId: '20261029013000',
          originTime: '2026-10-29T01:30:00+09:00',
          hypocenterName: '福島県沖',
          magnitude: '4.0',
          maxIntensity: '2',
        },
        {
          eventId: '20261029013000',
          originTime: '2026-10-29T01:30:05+09:00',
          hypocenterName: '福島県沖',
          magnitude: '4.3',
          maxIntensity: '3',
        }
      ];

      const merged = deduplicateEarthquakes(reports);
      expect(merged.length).toBe(1);
      expect(merged[0].magnitude).toBe('4.3');
      expect(merged[0].maxIntensity).toBe('3');
    });
  });
});
