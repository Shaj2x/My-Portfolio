"use client";

import { useState, useTransition } from "react";
import { saveRule } from "@/lib/actions/rules";
import { ACTIONS, CONDITIONS, TRIGGERS, describeRule, ruleSchema, type RuleInput } from "@/lib/rules";
import { Button, Notice } from "@/components/ui";

type Room = { slug: string; name: string };
type Cond = RuleInput["conditions"][number];
type Act = RuleInput["actions"][number];

const input = "min-h-10 rounded-lg border border-line bg-surface px-2 text-sm";
const blank: RuleInput = {
  name: "", priority: 100, enabled: true,
  trigger: { type: "booking.ended", room: "*", wait_up_to_minutes: 60 },
  conditions: [{ type: "no_motion_for", room: "$room", minutes: 10 }],
  actions: [{ type: "set_lights", room: "$room", state: "off" }],
};

function num(v: string) {
  return v === "" ? undefined : Number(v);
}

export function RuleEditor({ id, initial, rooms, onDone }: { id: string | null; initial?: RuleInput; rooms: Room[]; onDone?: () => void }) {
  const [rule, setRule] = useState<RuleInput>(initial ?? blank);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const parsed = ruleSchema.safeParse(rule);
  const roomOptions = (allowAny: boolean, allowThat: boolean) => (
    <>
      {allowAny ? <option value="*">Any room</option> : null}
      {allowThat ? <option value="$room">That room</option> : null}
      {rooms.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
    </>
  );
  const t = rule.trigger;
  const setT = (patch: Partial<RuleInput["trigger"]>) => setRule({ ...rule, trigger: { ...t, ...patch } });
  const setC = (i: number, c: Cond) => setRule({ ...rule, conditions: rule.conditions.map((x, j) => (j === i ? c : x)) });
  const setA = (i: number, a: Act) => setRule({ ...rule, actions: rule.actions.map((x, j) => (j === i ? a : x)) });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_6rem]">
        <label className="flex flex-col gap-1 text-sm font-medium">Name
          <input className={input} value={rule.name} onChange={(e) => setRule({ ...rule, name: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">Priority
          <input className={input} type="number" value={rule.priority} onChange={(e) => setRule({ ...rule, priority: Number(e.target.value) })} />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2 rounded-lg border border-line p-3">
        <legend className="px-1 text-sm font-semibold">When</legend>
        <select className={input} value={t.type} aria-label="Trigger" onChange={(e) => setRule({ ...rule, trigger: { type: e.target.value as RuleInput["trigger"]["type"], room: "*" } })}>
          {Object.entries(TRIGGERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {t.type !== "schedule" && !t.type.startsWith("device") ? (
            <label className="flex items-center gap-1">in <select className={input} value={t.room ?? "*"} onChange={(e) => setT({ room: e.target.value })}>{roomOptions(true, false)}</select></label>
          ) : null}
          {t.type === "booking.starting" || t.type === "room.vacant" ? (
            <label className="flex items-center gap-1"><input className={`${input} w-20`} type="number" min={0} value={t.minutes ?? ""} onChange={(e) => setT({ minutes: num(e.target.value) })} /> minutes{t.type === "booking.starting" ? " before" : " without motion"}</label>
          ) : null}
          {t.type === "schedule" ? (
            <>
              <input className={input} type="time" aria-label="At" value={t.at ?? ""} onChange={(e) => setT({ at: e.target.value })} />
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <label key={i} className="flex items-center gap-0.5"><input type="checkbox" checked={!t.days?.length || t.days.includes(i)}
                  onChange={(e) => {
                    const cur = t.days?.length ? t.days : [0, 1, 2, 3, 4, 5, 6];
                    setT({ days: e.target.checked ? [...cur, i].sort() : cur.filter((x) => x !== i) });
                  }} />{d}</label>
              ))}
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-1">Wait up to <input className={`${input} w-20`} type="number" min={0} value={t.wait_up_to_minutes ?? ""} onChange={(e) => setT({ wait_up_to_minutes: num(e.target.value) })} /> min for conditions</label>
          <label className="flex items-center gap-1">At most every <input className={`${input} w-20`} type="number" min={0} value={t.cooldown_minutes ?? ""} onChange={(e) => setT({ cooldown_minutes: num(e.target.value) })} /> min</label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-lg border border-line p-3">
        <legend className="px-1 text-sm font-semibold">Only if</legend>
        {rule.conditions.map((c, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <select className={input} value={c.type} aria-label="Condition" onChange={(e) => setC(i, { type: e.target.value as Cond["type"], room: "$room", minutes: 10 })}>
              {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {["no_motion_for", "motion_within", "no_active_booking", "active_booking"].includes(c.type) ? (
              <>
                <select className={input} value={c.room ?? "$room"} aria-label="Room" onChange={(e) => setC(i, { ...c, room: e.target.value })}>{roomOptions(false, true)}</select>
                <input className={`${input} w-20`} type="number" min={0} aria-label="Minutes" value={c.minutes ?? ""} onChange={(e) => setC(i, { ...c, minutes: num(e.target.value) })} /> min
              </>
            ) : null}
            {c.type === "time_between" ? (
              <>
                <input className={input} type="time" aria-label="From" value={c.from ?? ""} onChange={(e) => setC(i, { ...c, from: e.target.value })} /> and
                <input className={input} type="time" aria-label="To" value={c.to ?? ""} onChange={(e) => setC(i, { ...c, to: e.target.value })} />
              </>
            ) : null}
            {c.type === "price_period" ? (
              ["ultra_low", "mid_peak", "on_peak", "weekend_off_peak"].map((p) => (
                <label key={p} className="flex items-center gap-1"><input type="checkbox" checked={c.in?.includes(p as "on_peak") ?? false}
                  onChange={(e) => setC(i, { ...c, in: e.target.checked ? [...(c.in ?? []), p as "on_peak"] : (c.in ?? []).filter((x) => x !== p) })} />{p.replaceAll("_", " ")}</label>
              ))
            ) : null}
            <Button variant="ghost" onClick={() => setRule({ ...rule, conditions: rule.conditions.filter((_, j) => j !== i) })}>Remove</Button>
          </div>
        ))}
        <Button variant="secondary" className="self-start" onClick={() => setRule({ ...rule, conditions: [...rule.conditions, { type: "no_active_booking", room: "$room" }] })}>Add condition</Button>
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-lg border border-line p-3">
        <legend className="px-1 text-sm font-semibold">Do</legend>
        {rule.actions.map((a, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <select className={input} value={a.type} aria-label="Action" onChange={(e) => {
              const type = e.target.value as Act["type"];
              setA(i, type === "set_lights" ? { type, room: "$room", state: "off" } : type === "set_hvac" ? { type, room: "$room", mode: "setback" } : { type, title: "", body: "" });
            }}>
              {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {a.type === "set_lights" ? (
              <>
                <select className={input} value={a.state} aria-label="State" onChange={(e) => setA(i, { ...a, state: e.target.value as "on" | "off" })}><option value="on">on</option><option value="off">off</option></select>
                in <select className={input} value={a.room} aria-label="Room" onChange={(e) => setA(i, { ...a, room: e.target.value })}>{roomOptions(false, true)}</select>
              </>
            ) : a.type === "set_hvac" ? (
              <>
                <select className={input} value={a.mode} aria-label="Mode" onChange={(e) => setA(i, { ...a, mode: e.target.value as "comfort" })}><option value="comfort">comfort</option><option value="setback">setback</option><option value="off">off</option></select>
                in <select className={input} value={a.room} aria-label="Room" onChange={(e) => setA(i, { ...a, room: e.target.value })}>{roomOptions(false, true)}</select>
              </>
            ) : (
              <>
                <input className={`${input} flex-1`} placeholder="Title ($room = room name)" value={a.title} onChange={(e) => setA(i, { ...a, title: e.target.value })} />
                <input className={`${input} flex-1`} placeholder="Message" value={a.body ?? ""} onChange={(e) => setA(i, { ...a, body: e.target.value })} />
              </>
            )}
            <Button variant="ghost" onClick={() => setRule({ ...rule, actions: rule.actions.filter((_, j) => j !== i) })}>Remove</Button>
          </div>
        ))}
        <Button variant="secondary" className="self-start" onClick={() => setRule({ ...rule, actions: [...rule.actions, { type: "set_hvac", room: "$room", mode: "setback" }] })}>Add action</Button>
      </fieldset>

      <p className="rounded-lg bg-surface-2 p-3 text-sm">{parsed.success ? describeRule(parsed.data) : <span className="text-bad">{parsed.error.issues[0].path.join(".")}: {parsed.error.issues[0].message}</span>}</p>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <div className="flex gap-2">
        <Button disabled={!parsed.success || pending} onClick={() => start(async () => {
          const res = await saveRule(id, rule);
          setMsg(res.error ? { tone: "bad", text: res.error } : { tone: "ok", text: "Saved. The engine picks it up within 10 seconds." });
          if (res.ok && !id) setRule(blank);
          if (res.ok) onDone?.();
        })}>{pending ? "Saving…" : id ? "Save rule" : "Create rule"}</Button>
      </div>
    </div>
  );
}
