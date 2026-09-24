import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock3, History, Pause, Play, RotateCcw, Sparkles, Trophy, Volume2, VolumeX, X } from 'lucide-react';
import { GAME_DAY_QUESTIONS, selectGameDayQuestions, toggleGameDayChoice } from './gameDayQuestions';
import { isSupabaseConfigured, supabase } from './supabaseClient';

const STORAGE_PREFIX = 'tca-game-day-sessions';
const DRAFT_PREFIX = 'tca-game-day-draft';
const visualizationThoughts = [
  [0, 'Breathe.'], [5, 'Slow everything down.'], [10, 'See yourself walking into competition.'],
  [16, 'Feel calm.\nFeel ready.'], [22, 'See yourself playing fast and free.'],
  [28, 'Trust what you have trained.'], [34, 'See adversity happen.'],
  [40, 'Watch yourself respond.'], [46, 'Next play.\nNext moment.'],
  [51, 'Compete with confidence.'], [56, 'You are ready.']
];

function storageKey(prefix, userId) {
  return `${prefix}:${userId || 'guest'}`;
}

const isCloudUser = (userId) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId || '');

function sessionFromCloud(row) {
  return {
    id: row.id,
    userId: row.athlete_user_id,
    sport: row.sport,
    opponentName: row.opponent_name || '',
    eventTime: row.event_time || '',
    startedAt: row.started_at,
    questionIds: row.question_ids || [],
    responses: row.responses || [],
    pregameCompletedAt: row.pregame_completed_at,
    visualizationCompleted: Boolean(row.visualization_completed),
    visualizationCompletedAt: row.visualization_completed_at,
    lockedInAt: row.locked_in_at,
    reflection: row.reflection || null,
    reflectionCompletedAt: row.reflection_completed_at,
    updatedAt: row.updated_at,
    stage: 'complete'
  };
}

function sessionToCloud(session, userId) {
  return {
    id: session.id,
    athlete_user_id: userId,
    sport: session.sport,
    opponent_name: session.opponentName || null,
    event_time: session.eventTime || null,
    started_at: session.startedAt,
    question_ids: session.questionIds || [],
    responses: session.responses || [],
    pregame_completed_at: session.pregameCompletedAt || null,
    visualization_completed: Boolean(session.visualizationCompleted),
    visualization_completed_at: session.visualizationCompletedAt || null,
    locked_in_at: session.lockedInAt || null,
    reflection: session.reflection || null,
    reflection_completed_at: session.reflectionCompletedAt || null,
    updated_at: new Date().toISOString()
  };
}

export function loadGameDaySessions(userId) {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey(STORAGE_PREFIX, userId)) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export function gameDayBadgeCounts(sessions) {
  const pregame = sessions.filter((session) => session.pregameCompletedAt).length;
  const reflections = sessions.filter((session) => session.reflectionCompletedAt).length;
  const full = sessions.filter((session) => session.pregameCompletedAt && session.reflectionCompletedAt).length;
  return { pregame, reflections, full };
}

export function getRecentGameDayContext(userId, limit = 5) {
  return loadGameDaySessions(userId).slice(0, limit).map((session) => ({
    date: session.startedAt,
    sport: session.sport,
    opponentName: session.opponentName || null,
    responses: session.responses || [],
    reflection: session.reflection || null
  }));
}

function summarize(session) {
  const responses = session.responses || [];
  const find = (...categories) => responses.find((response) => categories.includes(response.category) && response.answer?.length);
  const focus = find('FOCUS', 'INTENTION')?.answer || 'Trust your preparation.';
  const controls = find('CONTROLLABLES')?.answer || [];
  const mindset = find('IDENTITY', 'CONFIDENCE', 'PRESSURE', 'ADVERSITY', 'PURPOSE')?.answer || 'Compete with confidence.';
  return {
    focus: Array.isArray(focus) ? focus.join(' • ') : focus,
    controls: Array.isArray(controls) ? controls : [controls],
    mindset: Array.isArray(mindset) ? mindset.join(' • ') : mindset
  };
}

function QuestionInput({ question, value, onChange }) {
  if (question.responseType === 'scale') {
    return <div className="game-day-scale">{Array.from({ length: 10 }, (_, index) => index + 1).map((number) => <button className={Number(value) === number ? 'active' : ''} key={number} onClick={() => onChange(String(number))} type="button">{number}</button>)}</div>;
  }
  if (question.responseType === 'single_select' || question.responseType === 'multi_select') {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    return <><p className="game-day-choice-hint">Choose up to 3</p><div className="game-day-chips">{question.options.map((option) => <button className={values.includes(option) ? 'active' : ''} key={option} onClick={() => onChange(toggleGameDayChoice(values, option, 3))} type="button">{option}</button>)}</div></>;
  }
  return <textarea autoFocus className="game-day-answer" maxLength={220} placeholder={question.responseType === 'statement_completion' ? 'Complete the statement…' : 'Keep it short and real…'} value={value || ''} onChange={(event) => onChange(event.target.value)} />;
}

function Visualization({ onComplete, onExit, track }) {
  const [seconds, setSeconds] = useState(60);
  const [playing, setPlaying] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const audioRef = useRef(null);
  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [playing]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = seconds > 57 ? (60 - seconds) / 30 : seconds < 4 ? seconds / 30 : 0.1;
    if (playing && soundOn) audio.play().catch(() => {});
    else audio.pause();
  }, [playing, soundOn, seconds]);
  useEffect(() => {
    if (seconds === 0) {
      track?.('game_day_visualization_completed');
      const transition = window.setTimeout(onComplete, 700);
      return () => window.clearTimeout(transition);
    }
    return undefined;
  }, [seconds, onComplete, track]);
  const elapsed = 60 - seconds;
  const thought = [...visualizationThoughts].reverse().find(([start]) => elapsed >= start)?.[1] || 'Breathe.';
  return <div className={`game-day-visualization ${playing ? 'playing' : 'paused'}`} role="dialog" aria-modal="true" aria-label="Game Day visualization">
    <audio ref={audioRef} loop preload="metadata" src="/audio/game-day-visualization.mp4" />
    <div className="visualization-orb" aria-hidden="true" />
    <button className="visualization-exit" type="button" onClick={onExit} aria-label="Exit visualization"><X /></button>
    <div className="visualization-center">
      <span>Game Day Visualization</span>
      <strong className="visualization-time">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</strong>
      <p key={thought}>{thought}</p>
    </div>
    <div className="visualization-controls">
      <button type="button" onClick={() => setSoundOn((current) => !current)} aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'}>{soundOn ? <Volume2 /> : <VolumeX />}</button>
      <button type="button" onClick={() => setPlaying((current) => !current)} aria-label={playing ? 'Pause' : 'Resume'}>{playing ? <Pause /> : <Play />}</button>
      <button type="button" onClick={() => { setSeconds(60); setPlaying(true); }} aria-label="Restart"><RotateCcw /></button>
    </div>
  </div>;
}

export default function GameDayMode({ athleteProfile, notifyUser, userId, setJournalEntries, trackAnalyticsEvent }) {
  const [sessions, setSessions] = useState(() => loadGameDaySessions(userId));
  const [cloudReady, setCloudReady] = useState(() => !isCloudUser(userId));
  const [draft, setDraft] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey(DRAFT_PREFIX, userId)) || 'null'); } catch { return null; }
  });
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [visualizing, setVisualizing] = useState(false);
  const [readyFinish, setReadyFinish] = useState(false);
  const [reflectingId, setReflectingId] = useState(null);
  const [reflection, setReflection] = useState({ confidenceRating: 5, focusRating: 5, effortRating: 5, emotionalControlRating: 5, mistakeResponseRating: 5, didExecuteFocus: '', whatWentWell: '', whatLearned: '', nextGameTakeaway: '' });

  useEffect(() => localStorage.setItem(storageKey(STORAGE_PREFIX, userId), JSON.stringify(sessions)), [sessions, userId]);
  useEffect(() => {
    if (!isSupabaseConfigured || !isCloudUser(userId)) return undefined;
    let cancelled = false;
    supabase.from('game_day_sessions').select('*').eq('athlete_user_id', userId).order('started_at', { ascending: false }).then(({ data, error }) => {
      if (cancelled) return;
      if (!error && data) setSessions((current) => {
        const merged = new Map(data.map(sessionFromCloud).map((session) => [session.id, session]));
        current.forEach((session) => {
          const remote = merged.get(session.id);
          const localTime = session.updatedAt || session.reflectionCompletedAt || session.lockedInAt || session.startedAt;
          const remoteTime = remote?.updatedAt || remote?.reflectionCompletedAt || remote?.lockedInAt || remote?.startedAt;
          if (!remote || String(localTime) >= String(remoteTime)) merged.set(session.id, session);
        });
        return [...merged.values()].sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
      });
      setCloudReady(true);
    });
    return () => { cancelled = true; };
  }, [userId]);
  useEffect(() => {
    if (!isSupabaseConfigured || !isCloudUser(userId) || !cloudReady || sessions.length === 0) return;
    supabase.from('game_day_sessions').upsert(sessions.map((session) => sessionToCloud(session, userId)), { onConflict: 'id' }).then(() => {});
  }, [cloudReady, sessions, userId]);
  useEffect(() => {
    if (draft) localStorage.setItem(storageKey(DRAFT_PREFIX, userId), JSON.stringify(draft));
    else localStorage.removeItem(storageKey(DRAFT_PREFIX, userId));
  }, [draft, userId]);

  function track(event, data = {}) { trackAnalyticsEvent?.(event, data, { area: 'game_day' }); }
  function begin(startOver = false) {
    if (draft && !startOver) {
      if (draft.stage === 'setup') setDraft((current) => ({ ...current, stage: 'questions', sport: current.sport || athleteProfile?.sport || 'Other' }));
      setOpen(true);
      return;
    }
    const questions = selectGameDayQuestions(sessions);
    setDraft({ id: crypto.randomUUID(), userId, stage: 'questions', sport: athleteProfile?.sport || 'Other', startedAt: new Date().toISOString(), questionIds: questions.map((question) => question.id), responses: [], questionIndex: 0, visualizationCompleted: false });
    setOpen(true);
    track('game_day_started');
  }
  const questions = useMemo(() => (draft?.questionIds || []).map((id) => GAME_DAY_QUESTIONS.find((question) => question.id === id)).filter(Boolean), [draft?.questionIds]);
  const activeQuestion = questions[draft?.questionIndex || 0];
  const activeResponse = draft?.responses?.find((response) => response.questionId === activeQuestion?.id)?.answer ?? (activeQuestion?.responseType === 'multi_select' || activeQuestion?.responseType === 'single_select' ? [] : '');
  function setAnswer(answer) {
    setDraft((current) => ({ ...current, responses: [...current.responses.filter((response) => response.questionId !== activeQuestion.id), { id: crypto.randomUUID(), gameDaySessionId: current.id, questionId: activeQuestion.id, category: activeQuestion.category, questionTextSnapshot: activeQuestion.questionText, answer, createdAt: new Date().toISOString() }] }));
  }
  function advanceQuestion() {
    track('game_day_question_answered', { questionId: activeQuestion.id, category: activeQuestion.category });
    if (draft.questionIndex < 2) setDraft((current) => ({ ...current, questionIndex: current.questionIndex + 1 }));
    else { setDraft((current) => ({ ...current, stage: 'summary' })); track('game_day_questions_completed'); }
  }
  function finishVisualization() {
    setVisualizing(false);
    setDraft((current) => ({ ...current, stage: 'locked', visualizationCompleted: true, visualizationCompletedAt: new Date().toISOString() }));
  }
  function lockIn() {
    const finishedAt = new Date().toISOString();
    const finished = { ...draft, stage: 'complete', pregameCompletedAt: finishedAt, lockedInAt: finishedAt, updatedAt: finishedAt };
    setSessions((current) => [finished, ...current.filter((session) => session.id !== finished.id)]);
    const nextPregameCount = gameDayBadgeCounts(sessions).pregame + 1;
    if (nextPregameCount === 1 || nextPregameCount === 5) {
      notifyUser?.(nextPregameCount === 1 ? 'Badge unlocked: Game Ready' : 'Badge unlocked: Game Day Veteran', nextPregameCount === 1 ? 'You completed your first full Game Day pregame routine.' : 'You completed 5 full Game Day pregame routines.', 'success', { id: `game-day-badge-${nextPregameCount}`, type: 'badge' });
    }
    setDraft(finished);
    setReadyFinish(true);
    track('game_day_locked_in');
    window.setTimeout(() => setReadyFinish(false), 2000);
  }
  function closeFinished() { setOpen(false); setDraft(null); setReadyFinish(false); }
  function saveReflection() {
    const session = sessions.find((item) => item.id === reflectingId);
    if (!session || !reflection.didExecuteFocus || !reflection.whatWentWell.trim() || !reflection.whatLearned.trim() || !reflection.nextGameTakeaway.trim()) return;
    const completedAt = new Date().toISOString();
    const next = sessions.map((item) => item.id === reflectingId ? { ...item, reflection: { ...reflection }, reflectionCompletedAt: completedAt, updatedAt: completedAt } : item);
    setSessions(next);
    const counts = gameDayBadgeCounts(next);
    if (counts.reflections === 10) notifyUser?.('Badge unlocked: Film Study', 'You completed 10 post-game reflections.', 'success', { id: 'game-day-badge-film-study', type: 'badge' });
    if (counts.full === 25) notifyUser?.('Badge unlocked: Competitor', 'You completed 25 full Game Day sessions.', 'success', { id: 'game-day-badge-competitor', type: 'badge' });
    setJournalEntries((current) => [{ id: crypto.randomUUID(), createdAt: completedAt, pending: true, ownerId: userId, body: `Game Day: ${session.sport}${session.opponentName ? ` vs. ${session.opponentName}` : ''}\nWhat I did well: ${reflection.whatWentWell}\nWhat I learned: ${reflection.whatLearned}\nNext game: ${reflection.nextGameTakeaway}\nExecuted my focus: ${reflection.didExecuteFocus}`, type: 'Game Day Reflection', linkedGoalId: null, date: new Date().toLocaleDateString('en-CA'), time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }, ...current]);
    track('game_day_reflection_completed', { sessionId: session.id });
    setReflectingId(null);
  }
  const summary = draft ? summarize(draft) : null;
  const detail = sessions.find((session) => session.id === detailId);
  const reflectionSession = sessions.find((session) => session.id === reflectingId);
  return <>
    <section className="game-day-entry">
      <div className="game-day-entry-icon"><Sparkles /></div>
      <div><span>Game today?</span><h2>Prepare your mind before you compete.</h2><p>Three quick questions. One focused visualization. Walk in ready.</p></div>
      <button className="game-day-start" type="button" onClick={() => begin(false)}>{draft ? 'Continue Game Day' : 'Start Game Day'} <ArrowRight size={18} /></button>
      {draft && draft.stage !== 'complete' && <button className="game-day-restart-link" type="button" onClick={() => begin(true)}><RotateCcw size={15} /> Start Over</button>}
      <button className="game-day-history-link" type="button" onClick={() => setHistoryOpen(true)}><History size={16} /> Game Day History</button>
    </section>

    {open && draft && <div className="game-day-modal" role="dialog" aria-modal="true" aria-label="Game Day Mode">
      <header><button type="button" onClick={() => setOpen(false)} aria-label="Save and exit"><X /></button><div><span>Game Day Mode</span><strong>{draft.stage === 'questions' ? `${draft.questionIndex + 1} of 3` : 'Prepare. Trust. Compete.'}</strong></div></header>
      {draft.stage === 'questions' && activeQuestion && <main className="game-day-step game-day-question"><div className="game-day-progress"><i style={{ width: `${((draft.questionIndex + 1) / 3) * 100}%` }} /></div><span className="game-day-kicker">{activeQuestion.category}</span><h2>{activeQuestion.questionText}</h2><QuestionInput question={activeQuestion} value={activeResponse} onChange={setAnswer} /><button className="game-day-primary" disabled={!activeResponse?.length} type="button" onClick={advanceQuestion}>{draft.questionIndex === 2 ? 'Build My Game Day' : 'Next'} <ArrowRight /></button></main>}
      {draft.stage === 'summary' && <main className="game-day-step game-day-summary"><span className="game-day-kicker">Your Game Day</span><h2>You identified what matters.</h2><div><span>Today’s Focus</span><strong>{summary.focus}</strong></div>{summary.controls.filter(Boolean).length > 0 && <div><span>My Controllables</span><strong>{summary.controls.join(' • ')}</strong></div>}<div><span>Game Day Mindset</span><strong>{summary.mindset}</strong></div><section><Clock3 /><h3>60 Second<br />Game Day Visualization</h3><p>Put your headphones in. Close your eyes. See it before you do it.</p></section><button className="game-day-primary" type="button" onClick={() => { setVisualizing(true); track('game_day_visualization_started'); }}>Begin Visualization <Play /></button></main>}
      {draft.stage === 'locked' && <main className="game-day-step game-day-locked"><div className="locked-check"><Check /></div><span className="game-day-kicker">Locked in.</span><h2>{summary.focus}</h2>{summary.controls.filter(Boolean).length > 0 && <div><span>My Controllables</span><strong>{summary.controls.join(' • ')}</strong></div>}<blockquote>{summary.mindset}</blockquote><button className="game-day-primary" type="button" onClick={lockIn}>I’m Ready</button></main>}
      {draft.stage === 'complete' && <main className="game-day-step game-day-finish"><Trophy /><h2>Go do work!</h2><p>Trust your game</p>{!readyFinish && <button className="game-day-primary" type="button" onClick={closeFinished}>Done</button>}</main>}
    </div>}
    {visualizing && <Visualization onComplete={finishVisualization} onExit={() => setVisualizing(false)} track={track} />}

    {historyOpen && <div className="game-day-modal game-day-history" role="dialog" aria-modal="true" aria-label="Game Day History"><header><button type="button" onClick={() => setHistoryOpen(false)} aria-label="Close history"><X /></button><div><span>Game Day</span><strong>History</strong></div></header><main className="game-day-step">{sessions.length === 0 ? <p className="game-day-empty">Your completed Game Day sessions will appear here.</p> : sessions.map((session) => <article className="game-day-history-card" key={session.id}><button type="button" onClick={() => setDetailId(session.id)}><span>{new Date(session.startedAt).toLocaleDateString()}</span><strong>{session.sport}{session.opponentName ? ` · ${session.opponentName}` : ''}</strong><em>Pregame complete · {session.reflectionCompletedAt ? 'Reflection complete' : 'Reflection pending'}</em></button>{!session.reflectionCompletedAt && <button type="button" onClick={() => { setReflectingId(session.id); setHistoryOpen(false); track('game_day_reflection_started'); }}>Reflect</button>}</article>)}</main></div>}
    {detail && <div className="game-day-modal game-day-detail" role="dialog" aria-modal="true"><header><button type="button" onClick={() => setDetailId(null)} aria-label="Back"><ArrowLeft /></button><div><span>{new Date(detail.startedAt).toLocaleDateString()}</span><strong>{detail.sport}</strong></div></header><main className="game-day-step"><h2>{detail.opponentName || 'Game Day Session'}</h2>{detail.responses.map((response) => <div className="game-day-response" key={response.id}><span>{response.category}</span><strong>{response.questionTextSnapshot}</strong><p>{Array.isArray(response.answer) ? response.answer.join(' • ') : response.answer}</p></div>)}<p className="game-day-completion-line"><Check /> Visualization completed</p>{detail.reflection && <div className="game-day-response"><span>Post-game reflection</span><strong>What went well</strong><p>{detail.reflection.whatWentWell}</p><strong>What I learned</strong><p>{detail.reflection.whatLearned}</p><strong>Next game</strong><p>{detail.reflection.nextGameTakeaway}</p></div>}</main></div>}
    {reflectionSession && <div className="game-day-modal game-day-reflection" role="dialog" aria-modal="true"><header><button type="button" onClick={() => setReflectingId(null)} aria-label="Close"><X /></button><div><span>Post-game</span><strong>Reflection</strong></div></header><main className="game-day-step"><h2>Learn from how you competed.</h2>{[['confidenceRating','Confidence'],['focusRating','Focus'],['effortRating','Effort'],['emotionalControlRating','Emotional Control'],['mistakeResponseRating','Response to Mistakes']].map(([key,label]) => <label className="reflection-rating" key={key}><span>{label}</span><strong>{reflection[key]}/10</strong><input min="1" max="10" type="range" value={reflection[key]} onChange={(event) => setReflection({ ...reflection, [key]: Number(event.target.value) })} /></label>)}<label>What did you do well today?<textarea value={reflection.whatWentWell} onChange={(event) => setReflection({ ...reflection, whatWentWell: event.target.value })} /></label><label>What did you learn?<textarea value={reflection.whatLearned} onChange={(event) => setReflection({ ...reflection, whatLearned: event.target.value })} /></label><label>What will you take into the next game?<textarea value={reflection.nextGameTakeaway} onChange={(event) => setReflection({ ...reflection, nextGameTakeaway: event.target.value })} /></label><span>Did you execute your Game Day focus?</span><div className="game-day-chips">{['Yes','Somewhat','No'].map((value) => <button className={reflection.didExecuteFocus === value.toLowerCase() ? 'active' : ''} key={value} type="button" onClick={() => setReflection({ ...reflection, didExecuteFocus: value.toLowerCase() })}>{value}</button>)}</div><button className="game-day-primary" type="button" onClick={saveReflection}>Save Reflection</button></main></div>}
  </>;
}
