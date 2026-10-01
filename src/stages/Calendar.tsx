import { CAL_SLOTS, CAL_START, SLOT_MIN, type CalendarChallenge } from "../challenge/types";
import { formatClock, formatDay, monthDay, weekdayShort } from "../lib/format";
import type { CalAction, CalState } from "../game/state";
import type { Rejection } from "../game/run";
import { RejectionNote } from "../components/RejectionNote";
import { IconAlert, IconChevronDown, IconClock } from "../components/Icons";

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

/**
 * Cadence. On phones it's one day at a time (tabs that stay pinned while you scroll the day), one lane
 * per attendee, and the new time's pickers and Save docked at the bottom, so a slot tapped in the grid
 * can be checked and saved without scrolling back up.
 */
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
      <header className="cd-top">
        <div className="cd-brand">
          <span className="cd-logo" aria-hidden>
            <IconClock size={16} strokeWidth={2.4} />
          </span>
          Cadence
        </div>
        <div className="cd-week">
          Week of {monthDay(ch.weekStart)} – {monthDay(ch.weekStart + 4)}
        </div>
        <div className="cd-tz">All times in your time zone</div>
      </header>

      <div className="cd-layout">
        <aside className="cd-side">
          <div className="cd-meeting">
            <div className="cd-meeting-title">{ch.meetingTitle}</div>
            <div className="cd-meeting-meta">
              {ch.durationMin} min · {ch.attendees.length} attendees
            </div>
            <div className="cd-current">
              <IconAlert size={16} />
              <div>
                <b>
                  Currently {formatDay(ch.weekStart + ch.current.dayIndex)}, {formatClock(ch.current.startMin)}–
                  {formatClock(ch.current.startMin + ch.durationMin)}
                </b>
                {clash && (
                  <div>
                    Conflicts with {clash.who.name === "You" ? "your" : `${clash.who.name.split(" ")[0]}'s`} “{clash.event.title}”
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="cd-people">
            <div className="cd-label">Attendees & working hours</div>
            <div className="cd-people-list">
              {ch.attendees.map((a) => (
                <button
                  key={a.id}
                  className={`cd-person ${state.hidden.includes(a.id) ? "off" : ""}`}
                  data-trace={`cal:person:${a.id}`}
                  aria-pressed={!state.hidden.includes(a.id)}
                  onClick={() => dispatch({ type: "toggleAttendee", id: a.id })}
                  title="Show or hide this calendar"
                >
                  <span className="cd-avatar" style={{ background: a.color }}>
                    {a.initials}
                  </span>
                  <span className="cd-person-name">{a.name}</span>
                  <span className="cd-person-hours">
                    {formatClock(a.startMin)}–{formatClock(a.endMin)}
                  </span>
                </button>
              ))}
            </div>
            <div className="cd-legend">
              <span className="cd-hatch" /> Outside working hours
            </div>
          </div>

          {/* Docked to the bottom of small screens, so the time you tap in the grid can be saved from there. */}
          <div className="cd-form dock">
            <div className="cd-label cd-form-label">New time</div>
            {rejection && <RejectionNote rejection={rejection} />}
            <div className="cd-form-row">
              <div className="cd-select">
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
                <IconChevronDown size={16} />
              </div>
              <div className="cd-select">
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
                <IconChevronDown size={16} />
              </div>
            </div>
            <div className={`cd-pick-summary ${state.pick ? "set" : ""}`}>
              {state.pick
                ? `${formatDay(ch.weekStart + state.pick.dayIndex)}, ${formatClock(state.pick.startMin)}–${formatClock(state.pick.startMin + ch.durationMin)}`
                : "Click the calendar or choose a day and start time."}
            </div>
            <button className="cd-save" data-trace="cal:save" onClick={onSubmit}>
              Save & notify attendees
            </button>
          </div>
        </aside>

        <section className="cd-grid-wrap">
          {/* Pinned under the game's header while the day scrolls: which day, and whose lane is whose. */}
          <div className="cd-sticky">
            <div className="cd-daytabs" role="tablist" aria-label="Day">
              {days.map((d) => (
                <button
                  key={d}
                  role="tab"
                  aria-selected={state.mobileDay === d}
                  data-trace={`cal:tab:${d}`}
                  className={`${state.mobileDay === d ? "on" : ""} ${state.pick?.dayIndex === d ? "picked" : ""}`}
                  onClick={() => dispatch({ type: "mobileDay", dayIndex: d })}
                >
                  <span>{weekdayShort(ch.weekStart + d)}</span>
                  <b>{monthDay(ch.weekStart + d).split(" ")[1]}</b>
                </button>
              ))}
            </div>
            <div className="cd-head">
              <div className="cd-gutter-head" />
              {days.map((d) => (
                <div key={d} className={`cd-dayhead ${state.mobileDay === d ? "m-on" : ""}`}>
                  <span className="cd-dayname">
                    <span>{weekdayShort(ch.weekStart + d)}</span> <b>{monthDay(ch.weekStart + d).split(" ")[1]}</b>
                  </span>
                  {/* Whose column is whose, once a single day is wide enough to label them. */}
                  <div className="cd-lanehead">
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
          </div>
          <div className="cd-grid" data-scroll="cal-grid">
            <div className="cd-body">
              <div className="cd-gutter">
                {Array.from({ length: CAL_SLOTS }, (_, k) => (
                  <div key={k} className="cd-gutter-cell">
                    {k % 2 === 0 ? formatClock(CAL_START + k * SLOT_MIN) : ""}
                  </div>
                ))}
              </div>
              {days.map((d) => (
                <div
                  key={d}
                  className={`cd-day ${state.mobileDay === d ? "m-on" : ""}`}
                  data-trace={`cal:day:${d}`}
                  onClick={(e) => pickFromPointer(d, e)}
                >
                  {Array.from({ length: CAL_SLOTS }, (_, k) => (
                    <div key={k} className={`cd-cell ${k % 2 ? "half" : ""}`} />
                  ))}
                  {visible.map((a, li) => (
                    <div key={a.id} className="cd-lane" style={{ left: `${(li / lanes) * 100}%`, width: `${100 / lanes}%` }}>
                      <div className="cd-off" style={{ top: 0, height: `${pct(Math.max(CAL_START, a.startMin))}%` }} />
                      <div className="cd-off" style={{ top: `${pct(Math.min(CAL_END, a.endMin))}%`, bottom: 0 }} />
                      {ch.events
                        .filter((e) => e.attendeeId === a.id && e.dayIndex === d)
                        .map((e) => (
                          <div
                            key={e.id}
                            className="cd-event"
                            title={`${a.name}: ${e.title} ${formatClock(e.startMin)}–${formatClock(e.endMin)}`}
                            style={{
                              top: `${pct(e.startMin)}%`,
                              height: `${pct(e.endMin) - pct(e.startMin)}%`,
                              background: a.color,
                            }}
                          >
                            <span className="cd-event-who">{a.initials}</span>
                            <span className="cd-event-title">{e.title}</span>
                          </div>
                        ))}
                    </div>
                  ))}
                  {ch.current.dayIndex === d && (
                    <div
                      className="cd-meet current"
                      style={{ top: `${pct(ch.current.startMin)}%`, height: `${pct(ch.current.startMin + ch.durationMin) - pct(ch.current.startMin)}%` }}
                    >
                      <span>Current · {ch.meetingTitle}</span>
                    </div>
                  )}
                  {state.pick?.dayIndex === d && (
                    <div
                      className="cd-meet proposed"
                      key={`${state.pick.dayIndex}@${state.pick.startMin}`}
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
