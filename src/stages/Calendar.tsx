import { CAL_SLOTS, CAL_START, SLOT_MIN, type CalendarChallenge } from "../challenge/types";
import { formatClock, formatDay, monthDay, weekdayShort } from "../lib/format";
import type { CalAction, CalState } from "../game/state";
import type { Rejection } from "../game/run";
import { RejectionNote } from "../components/RejectionNote";

type Props = {
  ch: CalendarChallenge;
  state: CalState;
  dispatch: (a: CalAction) => void;
  onSubmit: () => void;
  /** The latest rejection, while it still describes the current answer. */
  rejection: Rejection | null;
};

const CAL_END = CAL_START + CAL_SLOTS * SLOT_MIN;
const pct = (min: number) => ((min - CAL_START) / (CAL_END - CAL_START)) * 100;

export function clashFor(ch: CalendarChallenge) {
  const e = ch.events.find((x) => x.id === ch.clashEventId);
  return e ? { event: e, who: ch.attendees.find((a) => a.id === e.attendeeId)! } : null;
}

export function Calendar({ ch, state, dispatch, onSubmit, rejection }: Props) {
  const days = [0, 1, 2, 3, 4];
  const starts: number[] = [];
  for (let s = CAL_START; s + ch.durationMin <= CAL_END; s += SLOT_MIN) starts.push(s);
  const clash = clashFor(ch);
  const visible = ch.attendees.filter((a) => !state.hidden.includes(a.id));
  const lanes = visible.length || 1;

  const pickFromPointer = (d: number, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    const slot = Math.min(CAL_SLOTS - 1, Math.max(0, Math.floor(y * CAL_SLOTS)));
    const latest = CAL_START + Math.floor((CAL_END - ch.durationMin - CAL_START) / SLOT_MIN) * SLOT_MIN;
    dispatch({ type: "pick", dayIndex: d, startMin: Math.min(latest, CAL_START + slot * SLOT_MIN) });
  };

  return (
    <div className="cal">
      <div className="cal-top">
        <div className="cal-logo">
          <span className="cal-logo-mark">◷</span> Cadence
        </div>
        <div className="cal-week">
          Week of {monthDay(ch.weekStart)} – {monthDay(ch.weekStart + 4)}
        </div>
        <div className="cal-tz">All times in your time zone</div>
      </div>

      <div className="cal-layout">
        <aside className="cal-side">
          <div className="cal-meeting">
            <div className="cal-meeting-title">{ch.meetingTitle}</div>
            <div className="muted small">
              {ch.durationMin} min · {ch.attendees.length} attendees
            </div>
            <div className="cal-current">
              <span className="dot-warn" /> Currently {formatDay(ch.weekStart + ch.current.dayIndex)}, {formatClock(ch.current.startMin)}–
              {formatClock(ch.current.startMin + ch.durationMin)}
              {clash && (
                <div className="small">
                  Conflicts with {clash.who.name === "You" ? "your" : `${clash.who.name.split(" ")[0]}'s`} “{clash.event.title}”
                </div>
              )}
            </div>
          </div>

          <div className="cal-people">
            <div className="cal-side-label">Attendees & working hours</div>
            {ch.attendees.map((a) => (
              <button
                key={a.id}
                className={`cal-person ${state.hidden.includes(a.id) ? "off" : ""}`}
                data-trace={`cal:person:${a.id}`}
                onClick={() => dispatch({ type: "toggleAttendee", id: a.id })}
                title="Show or hide this calendar"
              >
                <span className="swatch" style={{ background: a.color }} />
                <span className="cal-person-name">{a.name}</span>
                <span className="cal-person-hours">
                  {formatClock(a.startMin)}–{formatClock(a.endMin)}
                </span>
              </button>
            ))}
            <div className="cal-legend">
              <span className="legend-hatch" /> Outside working hours
            </div>
          </div>

          <div className="cal-form">
            <div className="cal-side-label">New time</div>
            <div className="cal-form-row">
              <select
                data-trace="cal:form-day"
                value={state.pick?.dayIndex ?? ""}
                onChange={(e) => dispatch({ type: "pickDay", dayIndex: Number(e.target.value) })}
                aria-label="Day"
              >
                <option value="" disabled>
                  Day
                </option>
                {days.map((d) => (
                  <option key={d} value={d}>
                    {formatDay(ch.weekStart + d)}
                  </option>
                ))}
              </select>
              <select
                data-trace="cal:form-start"
                value={state.pick?.startMin ?? ""}
                onChange={(e) => dispatch({ type: "pickStart", startMin: Number(e.target.value) })}
                aria-label="Start time"
              >
                <option value="" disabled>
                  Start
                </option>
                {starts.map((s) => (
                  <option key={s} value={s}>
                    {formatClock(s)}
                  </option>
                ))}
              </select>
            </div>
            {/* Pinned to the bottom of small screens, so the time you tap in the grid can be saved from there. */}
            <div className="cal-savebar">
              <div className="cal-pick-summary">
                {state.pick
                  ? `${formatDay(ch.weekStart + state.pick.dayIndex)}, ${formatClock(state.pick.startMin)}–${formatClock(state.pick.startMin + ch.durationMin)}`
                  : "Click the calendar or choose a day and start time."}
              </div>
              {rejection && <RejectionNote rejection={rejection} />}
              <button className="btn-cal" data-trace="cal:save" onClick={onSubmit}>
                Save & notify attendees
              </button>
            </div>
          </div>
        </aside>

        <section className="cal-grid-wrap">
          <div className="cal-daytabs">
            {days.map((d) => (
              <button
                key={d}
                data-trace={`cal:tab:${d}`}
                className={state.mobileDay === d ? "on" : ""}
                onClick={() => dispatch({ type: "mobileDay", dayIndex: d })}
              >
                {weekdayShort(ch.weekStart + d)} {monthDay(ch.weekStart + d).split(" ")[1]}
              </button>
            ))}
          </div>
          <div className="cal-grid" data-scroll="cal-grid">
            <div className="cal-head">
              <div className="cal-gutter-head" />
              {days.map((d) => (
                <div key={d} className={`cal-dayhead ${state.mobileDay === d ? "m-on" : ""}`}>
                  <span>{weekdayShort(ch.weekStart + d)}</span> <b>{monthDay(ch.weekStart + d).split(" ")[1]}</b>
                  {/* Whose column is whose, once a single day is wide enough to label them. */}
                  <div className="cal-lanehead">
                    {visible.map((a) => (
                      <span key={a.id}>
                        <i style={{ background: a.color }} />
                        {a.initials}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="cal-body">
              <div className="cal-gutter">
                {Array.from({ length: CAL_SLOTS }, (_, k) => (
                  <div key={k} className="cal-gutter-cell">
                    {k % 2 === 0 ? formatClock(CAL_START + k * SLOT_MIN) : ""}
                  </div>
                ))}
              </div>
              {days.map((d) => (
                <div
                  key={d}
                  className={`cal-day ${state.mobileDay === d ? "m-on" : ""}`}
                  data-trace={`cal:day:${d}`}
                  onClick={(e) => pickFromPointer(d, e)}
                >
                  {Array.from({ length: CAL_SLOTS }, (_, k) => (
                    <div key={k} className={`cal-cell ${k % 2 ? "half" : ""}`} />
                  ))}
                  {visible.map((a, li) => (
                    <div key={a.id} className="cal-lane" style={{ left: `${(li / lanes) * 100}%`, width: `${100 / lanes}%` }}>
                      <div className="cal-off" style={{ top: 0, height: `${pct(Math.max(CAL_START, a.startMin))}%` }} />
                      <div className="cal-off" style={{ top: `${pct(Math.min(CAL_END, a.endMin))}%`, bottom: 0 }} />
                      {ch.events
                        .filter((e) => e.attendeeId === a.id && e.dayIndex === d)
                        .map((e) => (
                          <div
                            key={e.id}
                            className="cal-event"
                            title={`${a.name}: ${e.title} ${formatClock(e.startMin)}–${formatClock(e.endMin)}`}
                            style={{
                              top: `${pct(e.startMin)}%`,
                              height: `${pct(e.endMin) - pct(e.startMin)}%`,
                              background: a.color,
                            }}
                          >
                            <span className="cal-event-who">{a.initials}</span>
                            <span className="cal-event-title">{e.title}</span>
                          </div>
                        ))}
                    </div>
                  ))}
                  {ch.current.dayIndex === d && (
                    <div
                      className="cal-meet current"
                      style={{ top: `${pct(ch.current.startMin)}%`, height: `${pct(ch.current.startMin + ch.durationMin) - pct(ch.current.startMin)}%` }}
                    >
                      <span>Current · {ch.meetingTitle}</span>
                    </div>
                  )}
                  {state.pick?.dayIndex === d && (
                    <div
                      className="cal-meet proposed"
                      style={{ top: `${pct(state.pick.startMin)}%`, height: `${pct(state.pick.startMin + ch.durationMin) - pct(state.pick.startMin)}%` }}
                    >
                      <span>
                        {formatClock(state.pick.startMin)}–{formatClock(state.pick.startMin + ch.durationMin)} · New time
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
