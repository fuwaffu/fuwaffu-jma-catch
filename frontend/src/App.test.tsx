import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import App from './App';

// Mock Leaflet using vi.hoisted
const mocks = vi.hoisted(() => {
  const mockAddTo = vi.fn();
  return {
    mockAddTo,
    mockPolygon: vi.fn(() => ({ addTo: mockAddTo })),
    mockMarker: vi.fn(() => { const marker = { addTo: vi.fn(() => marker), bindPopup: vi.fn(() => marker) }; return marker; }),
    mockCircle: vi.fn(() => ({ addTo: mockAddTo })),
    mockPolyline: vi.fn(() => ({ addTo: mockAddTo })),
    mockDivIcon: vi.fn((opts) => opts),
    mockMap: vi.fn(() => { const m = { setView: vi.fn(() => m), remove: vi.fn(), fitBounds: vi.fn(), setZoom: vi.fn() }; return m; }),
    mockTileLayer: vi.fn(() => ({ addTo: mockAddTo }))
  };
});

vi.mock('leaflet', () => ({
  default: {
    map: mocks.mockMap,
    tileLayer: mocks.mockTileLayer,
    marker: mocks.mockMarker,
    polygon: mocks.mockPolygon,
    circle: mocks.mockCircle,
    polyline: mocks.mockPolyline,
    divIcon: mocks.mockDivIcon,
    latLngBounds: vi.fn(() => ({ pad: vi.fn() })),
  }
}));

// Mock fetch
global.fetch = vi.fn();

describe('App.tsx Dashboard Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. should show loading overlay when syncStatus.isSyncing is true', async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/status')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ isSyncing: true, progress: 45 }) });
      }
      if (url.includes('/api/warnings') || url.includes('/api/earthquakes') || url.includes('/api/typhoons')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: false });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/情報整理中\.\.\.\s*45%/)).toBeTruthy();
    });
  });

  it('2. should NOT render red dotted polygons or black dot markers for typhoons', async () => {
    const mockTyphoons = [{
      tcNumber: '1',
      name: 'Test Typhoon',
      updatedAt: new Date().toISOString(),
      current: {
        lat: 30, lon: 135,
        pressure: 950, maxWind: 45,
        stormRadii: [{ direction: '全域', radiusKm: 150 }],
        galeRadii: [{ direction: '全域', radiusKm: 300 }]
      },
      forecasts: [
        {
          lat: 32, lon: 136, circleRadiusKm: 50,
          stormRadii: [{ direction: '全域', radiusKm: 150 }],
          galeRadii: [{ direction: '全域', radiusKm: 300 }]
        }
      ]
    }];

    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/status')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ isSyncing: false, progress: 0 }) });
      }
      if (url.includes('/api/typhoons')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTyphoons) });
      }
      if (url.includes('/api/warnings') || url.includes('/api/earthquakes')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: false });
    });

    render(<App />);

    // Wait for the initial load to finish
    await waitFor(() => {
      expect(screen.queryByText(/読み込み中/)).toBeNull();
    });

    // Click the typhoon tab
    const tab = screen.getByRole('button', { name: '台風情報' });
    fireEvent.click(tab);

    // Click the typhoon to show the map
    const typhoonLink = await screen.findByText(/台風1号（Test Typhoon）/);
    fireEvent.click(typhoonLink);

    await waitFor(() => {
      expect(mocks.mockMap).toHaveBeenCalled();
    });

    // VERIFY: No red dotted polygons (stormPolygon) should be drawn!
    const polygonCalls = mocks.mockPolygon.mock.calls;
    for (const call of polygonCalls) {
      const options = call[1];
      expect(options?.dashArray).not.toBe('2,4');
    }

    // VERIFY: No black dots
    const divIconCalls = mocks.mockDivIcon.mock.calls;
    for (const call of divIconCalls) {
      const options = call[0];
      if (options && options.html) {
        expect(options.html).not.toContain('background-color: black');
        expect(options.html).not.toContain('background:#555');
      }
    }
  });
});
