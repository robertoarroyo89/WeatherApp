/**
 * Section marker.
 *
 * An index number, a label, a rule spanning the gap, and an optional value on
 * the right — the way a contents page or a specification sheet is set. It does
 * the job a card's border would do, using a single hairline and no box.
 */
export function SectionHeading({
  index,
  label,
  meta,
  className = '',
}: {
  /** Two-digit section number, e.g. "02". Omitted for nested headings. */
  index?: string;
  label: string;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rule-heading ${className}`}>
      {index && (
        <span className="rule-heading__index" aria-hidden>
          {index}
        </span>
      )}
      <h2 className="section-label">{label}</h2>
      <span className="rule-heading__line" aria-hidden />
      {meta ? <span className="rule-heading__meta">{meta}</span> : null}
    </div>
  );
}

/** A row of label, dotted leader and value. The app's replacement for a card. */
export function LeaderRow({
  label,
  value,
  note,
}: {
  label: string;
  value: React.ReactNode;
  /** Small uppercase qualifier after the value, e.g. a direction or a band. */
  note?: string;
}) {
  return (
    <div className="leader-row">
      <dt className="leader-row__label">{label}</dt>
      <span className="leader-row__leader" aria-hidden />
      <dd className="leader-row__value">
        {value}
        {note ? <span className="leader-row__note"> · {note}</span> : null}
      </dd>
    </div>
  );
}
