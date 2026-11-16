"use client";

import { useEffect, useMemo, useState } from "react";
import { useVisitorPreferences } from "@/components/public/VisitorPreferencesProvider";
import {
  BIORHYTHM_CYCLES, biorhythmWindow, isoAtDay, utcDay,
  validBirthDate, type BiorhythmCycle,
} from "@/lib/biorhythms";
import { biorhythmCopy } from "./biorhythm-copy";
import styles from "./BiorhythmChart.module.css";

const COLORS: Record<BiorhythmCycle,string> = {
  physical: "#245bd0", emotional: "#bf294b", intellectual: "#16814e",
};
const WIDTH = 850, LEFT = 46, RIGHT = 14, TOP = 20, BOTTOM = 54;
const PLOT_W = WIDTH - LEFT - RIGHT;
const PLOT_H = 240;
const xAt = (index: number) => LEFT + index * PLOT_W / 30;
const yAt = (value: number) => TOP + (100 - value) * PLOT_H / 200;

export function BiorhythmChart({ locale }: { locale: string }) {
  const t = biorhythmCopy(locale);
  const { preferences, ready } = useVisitorPreferences();
  // Explicit temporary input only: never update the saved preferences.
  const [temporaryBirth, setTemporaryBirth] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [visible, setVisible] = useState<BiorhythmCycle[]>(["physical","emotional","intellectual"]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(new Date().toISOString().slice(0,10));
  }, []);
  const birth = temporaryBirth ?? (ready ? preferences.birthDate : null) ?? "";
  const valid = today !== null && validBirthDate(birth, today);
  const center = today && utcDay(today) !== null ? isoAtDay((utcDay(today) ?? 0) + offset) : null;
  const points = useMemo(
    () => valid && center ? biorhythmWindow(birth, center) : [],
    [birth, center, valid],
  );
  const middle = points[15];
  const formatDate = (iso: string) => new Intl.DateTimeFormat(locale, {
    day:"numeric", month:"short", year:"numeric", timeZone:"UTC",
  }).format(new Date(iso+"T12:00:00Z"));
  const toggle = (key: BiorhythmCycle) => setVisible(previous =>
    previous.includes(key) ? previous.filter(item=>item!==key) : [...previous,key]);
  const step = (delta: number) => setOffset(previous => previous + delta);

  return <section className={styles.panel} aria-label={t.title}>
    <div className={styles.formRow}>
      <div className={styles.field}>
        <label htmlFor="biorhythm-birth" className="form-label fw-semibold">{t.birth}</label>
        <input id="biorhythm-birth" type="date" className="form-control"
          min="1900-01-01" max={today??undefined}
          disabled={!ready || today===null}
          value={birth} onChange={event=>setTemporaryBirth(event.target.value)}
          aria-describedby="biorhythm-date-hint" />
        <p id="biorhythm-date-hint" className="small text-body-secondary mt-2 mb-0">
          {temporaryBirth === null && ready && preferences.birthDate ? t.saved : t.temporary}
        </p>
      </div>
      {center && <div className={styles.focusDate}><span className="small text-body-secondary">{t.day}</span>
        <strong>{formatDate(center)}</strong></div>}
    </div>
    {!valid ? <p role="status" className="alert alert-info mt-3">
      {birth ? t.invalid : t.missing}
    </p> : <>
      <div className={styles.values} aria-label={t.day}>
        {BIORHYTHM_CYCLES.map(({key,period})=><div key={key} className={styles.valueCard}>
          <div className={styles.valueHeading}>
            <span className={styles.swatch} style={{backgroundColor:COLORS[key]}} aria-hidden="true"/>
            <span>{t[key]} <small>({period} j)</small></span>
          </div>
          <strong className={styles.value} style={{color:COLORS[key]}}>
            {Math.round(middle?.[key] ?? 0)>0?"+":""}{Math.round(middle?.[key] ?? 0)} %
          </strong>
        </div>)}
      </div>
      <div className={styles.chartWrap}>
        <svg className={styles.chart} viewBox={`0 0 ${WIDTH} ${TOP+PLOT_H+BOTTOM}`}
          role="img" aria-labelledby="biorhythm-svg-title biorhythm-svg-description">
          <title id="biorhythm-svg-title">{t.title} — {center?formatDate(center):""}</title>
          <desc id="biorhythm-svg-description">{BIORHYTHM_CYCLES.map(({key}) =>
            `${t[key]}: ${Math.round(middle?.[key]??0)}%`).join("; ")}. {t.disclaimer}</desc>
          {[-100,-50,0,50,100].map(value=><g key={value}>
            <line x1={LEFT} x2={WIDTH-RIGHT} y1={yAt(value)} y2={yAt(value)}
              className={value===0?styles.zero:styles.gridLine}/>
            <text x={LEFT-9} y={yAt(value)+4} textAnchor="end" className={styles.axis}>{value}</text>
          </g>)}
          <line x1={xAt(15)} x2={xAt(15)} y1={TOP} y2={TOP+PLOT_H} className={styles.todayLine}/>
          {BIORHYTHM_CYCLES.filter(({key})=>visible.includes(key)).map(({key})=><g key={key}>
            <polyline fill="none" stroke={COLORS[key]} strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round"
              points={points.map((p,i)=>`${xAt(i)},${yAt(p[key])}`).join(" ")}/>
            <circle cx={xAt(15)} cy={yAt(middle?.[key]??0)}
              r="5" fill={COLORS[key]} stroke="var(--bs-body-bg, #fff)" strokeWidth="2"/>
          </g>)}
          {[0,5,10,15,20,25,30].map(i=><text key={i} x={xAt(i)}
            y={TOP+PLOT_H+24} textAnchor="middle" className={styles.axis}>
            {points[i]?.date.slice(5).replace("-","/")}
          </text>)}
          <text x={xAt(15)} y={TOP+PLOT_H+44} textAnchor="middle"
            className={styles.centerLabel}>{t.day}</text>
        </svg>
      </div>
      <fieldset className={styles.legend}>
        <legend className="small fw-semibold mb-2">{t.curves}</legend>
        {BIORHYTHM_CYCLES.map(({key,period})=><label key={key} className={styles.legendItem}>
          <input type="checkbox" checked={visible.includes(key)} onChange={()=>toggle(key)}/>
          <span className={styles.swatch} style={{backgroundColor:COLORS[key]}} aria-hidden="true"/>
          <span>{t[key]} ({period} j)</span>
        </label>)}
      </fieldset>
      <nav className={styles.navigation} aria-label={t.day}>
        <button type="button" className="btn btn-outline-primary" onClick={()=>step(-15)}>{t.prev}</button>
        <button type="button" className="btn btn-outline-secondary" onClick={()=>setOffset(0)}>{t.today}</button>
        <button type="button" className="btn btn-outline-primary" onClick={()=>step(15)}>{t.next}</button>
      </nav>
    </>}
    <p className="small text-body-secondary mt-4 mb-0" role="note">{t.disclaimer}</p>
  </section>;
}
