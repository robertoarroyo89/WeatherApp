import { formatScore } from '@/lib/format';

/**
 * The score, as the dominant element.
 *
 * A very large numeral over a thin ten-point rule. No dial, no ring, no gauge —
 * the number is the message and the rule is only there to say what "8,8" is out
 * of, which a circle communicates far less clearly.
 */
export function ScoreScale({
  score,
  verdict,
  size = 'large',
}: {
  score: number;
  verdict: string;
  size?: 'large' | 'compact';
}) {
  const ratio = Math.min(1, Math.max(0, score / 10));
  return (
    <div>
      <div className="flex items-baseline gap-2.5">
        <span
          className={`legible [font-family:var(--font-display)] ${
            size === 'large' ? 'text-[4.5rem] leading-[0.86]' : 'text-[2.75rem] leading-none'
          }`}
        >
          {formatScore(score)}
        </span>
        <span className="text-ink-faint text-[0.875rem]">/ 10</span>
      </div>

      <div className="relative mt-4 h-px w-full" style={{ background: 'var(--hairline)' }}>
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${ratio * 100}%`,
            background: 'var(--accent)',
            transition: 'width var(--dur-slow) var(--ease-out)',
          }}
        />
        <div
          className="absolute top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${ratio * 100}%`,
            background: 'var(--accent)',
            transition: 'left var(--dur-slow) var(--ease-out)',
          }}
        />
      </div>

      <p
        className={`mt-3 [font-family:var(--font-mono)] tracking-[0.12em] uppercase ${
          size === 'large' ? 'text-[0.75rem]' : 'text-[0.6875rem]'
        }`}
      >
        {verdict}
      </p>
    </div>
  );
}
