import { useState } from 'react';
import { useStore } from '../store/useStore';
import { INDICATOR_PRESETS } from '../lib/indicators';
import { GearIcon } from './icons';

/** Chart style options matching Dukascopy/FXReplay style selectors. */
export type ChartStyle = 'candles' | 'hollow' | 'bars' | 'line' | 'area';

const STYLES: { value: ChartStyle; label: string }[] = [
  { value: 'candles', label: 'Candles' },
  { value: 'hollow', label: 'Hollow' },
  { value: 'bars', label: 'Bars' },
  { value: 'line', label: 'Line' },
  { value: 'area', label: 'Area' },
];

export function ChartSettings() {
  const chartStyle = useStore((s) => s.chartStyle);
  const setChartStyle = useStore((s) => s.setChartStyle);
  const indicators = useStore((s) => s.indicators);
  const addIndicator = useStore((s) => s.addIndicator);
  const removeIndicator = useStore((s) => s.removeIndicator);
  const showGrid = useStore((s) => s.showGrid);
  const toggleGrid = useStore((s) => s.toggleGrid);

  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Chart settings"
        className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
          open
            ? 'bg-[#2a2e39] text-white'
            : 'text-[#787b86] hover:bg-[#1e222d] hover:text-white'
        }`}
      >
        <GearIcon width={14} height={14} />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-56 rounded-md border border-[#2a2e39] bg-[#131722] p-3 shadow-xl shadow-black/50">
          {/* Chart style */}
          <div className="mb-3">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#787b86]">
              Chart type
            </label>
            <div className="grid grid-cols-3 gap-1">
              {STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setChartStyle(s.value)}
                  className={`rounded px-1 py-1 text-[10px] font-medium transition-colors ${
                    chartStyle === s.value
                      ? 'bg-[#2962ff] text-white'
                      : 'bg-[#1e222d] text-[#787b86] hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid toggle */}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[#787b86]">
              Grid lines
            </span>
            <button
              onClick={toggleGrid}
              className={`h-5 w-9 rounded-full transition-colors ${
                showGrid ? 'bg-[#2962ff]' : 'bg-[#2a2e39]'
              }`}
            >
              <span
                className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                  showGrid ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Indicators */}
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#787b86]">
              Indicators
            </label>
            <div className="flex flex-col gap-1">
              {INDICATOR_PRESETS.map((preset) => {
                const active = indicators.some((i) => i.id === preset.id);
                return (
                  <button
                    key={preset.id}
                    onClick={() =>
                      active ? removeIndicator(preset.id) : addIndicator(preset)
                    }
                    className={`flex items-center justify-between rounded px-2 py-1 text-[11px] transition-colors ${
                      active
                        ? 'bg-[#1e222d] text-white'
                        : 'text-[#787b86] hover:bg-[#1e222d] hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: preset.color }}
                      />
                      {preset.type.toUpperCase()} ({preset.period})
                    </span>
                    {active && <span className="text-[10px] text-[#2962ff]">ON</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
