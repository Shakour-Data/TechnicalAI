import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TimeSeriesAnalysis from '../time-series-analysis';

const mockCandles = Array.from({ length: 100 }, (_, i) => ({
  date: `2024-01-${String((i % 30) + 1).padStart(2, '0')}`,
  open: 100 + i, high: 105 + i, low: 95 + i,
  close: 100 + i, volume: 1000 + i,
}));

describe('TimeSeriesAnalysis', () => {
  it('renders correctly with default quick mode', () => {
    render(<TimeSeriesAnalysis symbol="TEST" candles={mockCandles} currentPrice={100} />);
    expect(screen.getByText(/تحلیل سری زمانی/)).toBeInTheDocument();
  });

  it('renders in detailed mode when defaultMode is "detailed"', () => {
    render(<TimeSeriesAnalysis symbol="TEST" candles={mockCandles} currentPrice={100} defaultMode="detailed" />);
    expect(screen.getByText('دقیق')).toBeInTheDocument();
  });

  it('shows error when insufficient candles', () => {
    const fewCandles = mockCandles.slice(0, 30);
    render(<TimeSeriesAnalysis symbol="TEST" candles={fewCandles} currentPrice={100} />);
    expect(screen.getByText(/حداقل ۶۰ کندل/)).toBeInTheDocument();
  });

  it('mode toggle switches between quick and detailed', () => {
    render(<TimeSeriesAnalysis symbol="TEST" candles={mockCandles} currentPrice={100} />);
    const detailedBtn = screen.getByText('دقیق');
    fireEvent.click(detailedBtn);
    expect(detailedBtn).toHaveClass('bg-violet-600');
  });
});