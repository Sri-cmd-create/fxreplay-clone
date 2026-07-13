import { useStore, SPEEDS } from '../store/useStore';
import { INSTRUMENTS, TIMEFRAMES, getInstrument } from '../lib/instruments';
import { getBaseCandles } from '../lib/data';
import { formatTime } from '../lib/format';
import { PlayIcon, PauseIcon, StepIcon, RestartIcon, DiceIcon } from './icons';

export function Toolbar() {
  const symbol = useStore((s) => s.symbol);
  const timeframe = useStore((s) => s.timeframe);
  const playing = useStore((s) => s.playing);
  const speed = useStore((s) => s.speed);
  const currentTime = useStore((s) => {
    // Recompute when the playhead moves.
    void s.playheads[s.symbol];
    return s.currentTime();
  });
  const atEnd = useStore((s) => {
    void s.playheads[s.symbol];
    return s.atEnd();
  });

  const setSymbol = useStore((s) => s.setSymbol);
  const setTimeframe = useStore((s) => s.setTimeframe);
  const togglePlay = useStore((s) => s.togglePlay);
  const stepForward = useStore((s) => s.stepForward);
  const setSpeed = useStore((s) => s.setSpeed);
  const restartSession = useStore((s) => s.restartSession);
  const randomStart = useStore((s) => s.randomStart);
  const jumpToTime = useStore((s) => s.jumpToTime);

  // Date-jump bounds derived from the active symbol's dataset.
  const base = getBaseCandles(getInstrument(symbol));
  const toISODate = (sec: number) =>
    new Date(sec * 1000).toISOString().slice(0, 10);
  const minDate = toISODate(base[0].time);
  const maxDate = toISODate(base[base.length - 1].time);
  const curDate = toISODate(currentTime);

  return (
    <div className="flex h-9 items-center gap-2 border-b border-border bg-panel px-2">
      {/* Brand - compact */}
      <div className="flex items-center gap-1.5">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-accent text-[9px] font-bold text-white">
          FX
        </div>
        <span className="hidden text-xs font-semibold tracking-wide text-white sm:inline">
          Replay<span className="text-accent">Pro</span>
        </span>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Symbol selector */}
      <select
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        className="rounded bg-panel-alt px-1.5 py-0.5 text-xs font-semibold text-white outline-none ring-1 ring-border hover:bg-panel-hover focus:ring-accent"
      >
        {INSTRUMENTS.map((i) => (
          <option key={i.symbol} value={i.symbol}>
            {i.symbol}
          </option>
        ))}
      </select>

      {/* Timeframes */}
      <div className="flex items-center gap-px rounded bg-panel-alt p-px">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.code}
            onClick={() => setTimeframe(tf.code)}
            className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
              timeframe === tf.code
                ? 'bg-accent text-white'
                : 'text-muted hover:bg-panel-hover hover:text-white'
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Replay controls - centered group */}
      <div className="flex items-center gap-0.5">
        <button
          title="Restart session"
          onClick={restartSession}
          className="rounded p-1 text-muted hover:bg-panel-hover hover:text-white"
        >
          <RestartIcon />
        </button>
        <button
          title={playing ? 'Pause (Space)' : 'Play (Space)'}
          onClick={togglePlay}
          disabled={atEnd}
          className="rounded bg-accent p-1 text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          title="Step forward one bar"
          onClick={stepForward}
          disabled={atEnd}
          className="rounded p-1 text-muted hover:bg-panel-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <StepIcon />
        </button>

        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          title="Playback speed"
          className="ml-0.5 rounded bg-panel-alt px-1.5 py-0.5 text-[11px] text-white outline-none ring-1 ring-border hover:bg-panel-hover focus:ring-accent"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Random + date jump */}
      <div className="flex items-center gap-0.5">
        <button
          title="Random start date"
          onClick={randomStart}
          className="rounded p-1 text-muted hover:bg-panel-hover hover:text-white"
        >
          <DiceIcon />
        </button>
        <input
          type="date"
          value={curDate}
          min={minDate}
          max={maxDate}
          title="Jump to date"
          onChange={(e) => {
            const secs = Date.parse(`${e.target.value}T00:00:00Z`) / 1000;
            if (!Number.isNaN(secs)) jumpToTime(secs);
          }}
          className="rounded bg-panel-alt px-1.5 py-0.5 text-[11px] text-white outline-none ring-1 ring-border hover:bg-panel-hover focus:ring-accent [color-scheme:dark]"
        />
      </div>

      {/* Right side: time display */}
      <div className="ml-auto flex items-center gap-2 text-[11px] text-muted">
        {atEnd && <span className="text-down font-medium">End of data</span>}
        <span className="rounded bg-panel-alt px-1.5 py-0.5 font-mono text-white">
          {formatTime(currentTime)} UTC
        </span>
      </div>
    </div>
  );
}
