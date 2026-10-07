import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock,
  Flame,
  Link,
  PenLine,
  Plus,
  Sparkles,
  Smartphone,
  Target,
  Trash2,
  X
} from 'lucide-react';

const goalCategories = ['Dream Goal', 'Performance Goal', 'Season Goal', 'Academic Goal', 'Personal Goal'];

const emptyGoalDraft = () => ({
  category: '',
  title: '',
  affirmation: '',
  linkedStandardIds: [],
  newActivities: [],
  milestones: [],
  targetDate: ''
});

function goalCategory(goal) {
  return goal?.category || goal?.label || 'Personal Goal';
}

function goalTitle(goal) {
  return goal?.value || goal?.title || goal?.label || 'Untitled goal';
}

function goalAffirmation(goal) {
  if (goal?.affirmation?.trim()) return goal.affirmation.trim();
  return `I am building the discipline and daily evidence to ${goalTitle(goal).replace(/[.!?]+$/, '').toLowerCase()}.`;
}

function goalMilestones(goal) {
  return Array.isArray(goal?.milestones) ? goal.milestones : [];
}

function clampProgress(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function formatTargetDate(value) {
  if (!value) return 'No date set';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { month: 'long', year: 'numeric' });
}

function linkedActivitiesForGoal(standards, goalId) {
  return standards.filter((standard) => String(standard.goalId) === String(goalId));
}

function historyIncludesGoal(entry, goal) {
  return (entry?.standards || []).some((standard) => (
    String(standard.goalId || '') === String(goal.id)
    || (standard.goalValue && standard.goalValue === goalTitle(goal))
    || (!standard.goalId && standard.goalLabel && standard.goalLabel === goalCategory(goal))
  ));
}

function investedDaysForGoal(history, goal) {
  return history.filter((entry) => historyIncludesGoal(entry, goal)).length;
}

function lockedDaysForGoal(history, goal) {
  return history.filter((entry) => (
    (entry?.standards || []).some((standard) => standard.done && (
      String(standard.goalId || '') === String(goal.id)
      || (standard.goalValue && standard.goalValue === goalTitle(goal))
      || (!standard.goalId && standard.goalLabel && standard.goalLabel === goalCategory(goal))
    ))
  )).length;
}

function GoalProgressBar({ progress }) {
  return (
    <span className="goal-command-progress-track" aria-hidden="true">
      <i style={{ width: `${clampProgress(progress)}%` }} />
    </span>
  );
}

function DepositList({ activities, compact = false }) {
  if (!activities.length) return null;
  return (
    <div className={compact ? 'goal-deposit-list compact' : 'goal-deposit-list'}>
      {activities.slice(0, compact ? 4 : activities.length).map((activity) => (
        <span className={activity.done ? 'done' : ''} key={activity.id}>
          <i>{activity.done ? <Check size={12} /> : null}</i>
          <em>{activity.label}</em>
        </span>
      ))}
    </div>
  );
}

function GoalOverviewCard({ goal, standards, standardsHistory, onOpen }) {
  const activities = linkedActivitiesForGoal(standards, goal.id);
  const completed = activities.filter((activity) => activity.done).length;
  const progress = clampProgress(goal.progress);
  const lockedDays = lockedDaysForGoal(standardsHistory, goal);

  return (
    <button className="goal-command-card" onClick={() => onOpen(goal.id)} type="button">
      <header>
        <span>{goalCategory(goal)}</span>
        <ChevronRight size={18} />
      </header>
      <h2>{goalTitle(goal)}</h2>
      <blockquote>“{goalAffirmation(goal)}”</blockquote>
      <div className="goal-command-card-progress">
        <div><strong>{progress}%</strong><span>Goal progress</span></div>
        <GoalProgressBar progress={progress} />
        <p><b>{lockedDays} Locked-In Day{lockedDays === 1 ? '' : 's'}</b><em>{100 - progress}% to go</em></p>
      </div>
      <div className="goal-command-card-deposit">
        <div><span>Today’s Deposit</span><strong>{activities.length ? `${completed} of ${activities.length} actions completed` : 'Your goal needs a daily action'}</strong></div>
        <DepositList activities={activities} compact />
      </div>
    </button>
  );
}

function GoalCreationFlow({ standards, setGoals, setStandards, awardPoints, celebrate, goalAddedPoints, onClose, onCreated, trackAnalyticsEvent }) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(emptyGoalDraft);
  const [milestoneText, setMilestoneText] = useState('');
  const [activityText, setActivityText] = useState('');
  const [createdGoal, setCreatedGoal] = useState(null);

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function toggleLinkedActivity(id) {
    setDraft((current) => ({
      ...current,
      linkedStandardIds: current.linkedStandardIds.includes(id)
        ? current.linkedStandardIds.filter((item) => item !== id)
        : [...current.linkedStandardIds, id]
    }));
  }

  function addNewActivity() {
    const label = activityText.trim();
    if (!label) return;
    update('newActivities', [...draft.newActivities, { id: `new-${Date.now()}`, label }]);
    setActivityText('');
  }

  function addMilestone() {
    const label = milestoneText.trim();
    if (!label) return;
    update('milestones', [...draft.milestones, { id: `milestone-${Date.now()}`, label, done: false }]);
    setMilestoneText('');
  }

  function createGoal() {
    const category = draft.category.trim();
    const title = draft.title.trim();
    if (!category || !title) return;
    const id = Date.now();
    const nextGoal = {
      id,
      label: category,
      category,
      value: title,
      affirmation: draft.affirmation.trim(),
      progress: 0,
      targetDate: draft.targetDate,
      milestones: draft.milestones
    };
    setGoals((current) => [...current, nextGoal]);
    setStandards((current) => [
      ...current.map((standard) => draft.linkedStandardIds.includes(standard.id) ? { ...standard, goalId: id } : standard),
      ...draft.newActivities.map((activity, index) => ({ id: Date.now() + index + 1, label: activity.label, done: false, goalId: id }))
    ]);
    const awarded = awardPoints?.({
      type: 'goal_added',
      points: goalAddedPoints,
      label: 'Goal added',
      uniqueKey: `goal-added-${id}`,
      metadata: { goalLabel: category, goalTitle: title }
    });
    trackAnalyticsEvent?.('goal_added', {
      category,
      titleLength: title.length,
      linkedStandards: draft.linkedStandardIds.length + draft.newActivities.length,
      milestones: draft.milestones.length
    }, { area: 'goals' });
    setCreatedGoal(nextGoal);
    setStep(7);
    celebrate?.(awarded ? `Goal created. +${goalAddedPoints} points.` : 'The target is set. Now stack the work.');
  }

  const canContinue = step === 1 ? Boolean(draft.category) : step === 2 ? Boolean(draft.title.trim()) : true;

  return (
    <section className="goal-creation-flow" role="dialog" aria-modal="true" aria-label="Create a new goal">
      {step < 7 && (
        <header className="goal-flow-header">
          <button onClick={step === 1 ? onClose : () => setStep((current) => current - 1)} type="button" aria-label={step === 1 ? 'Close goal creation' : 'Previous goal creation step'}>←</button>
          <div><span>Build your target</span><strong>Step {step} of 6</strong></div>
          <button onClick={onClose} type="button" aria-label="Close goal creation"><X size={17} /></button>
        </header>
      )}

      {step < 7 && <div className="goal-flow-progress"><i style={{ width: `${(step / 6) * 100}%` }} /></div>}

      {step === 1 && (
        <div className="goal-flow-step">
          <span>Step 1</span><h2>What are you chasing?</h2><p>Choose the kind of target you’re ready to work toward.</p>
          <div className="goal-type-grid">
            {goalCategories.map((category) => (
              <button className={draft.category === category ? 'active' : ''} key={category} onClick={() => update('category', category)} type="button">
                <Target size={17} /><strong>{category.replace(' Goal', '')}</strong><Check size={15} />
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="goal-flow-step">
          <span>Step 2</span><h2>What’s the goal?</h2><p>Be specific enough that you know exactly what you’re chasing.</p>
          <label className="goal-flow-primary-input">
            <span>Your goal</span>
            <textarea autoFocus maxLength={180} placeholder="Get drafted to the MLB" value={draft.title} onChange={(event) => update('title', event.target.value)} />
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="goal-flow-step">
          <span>Step 3</span><h2>Say it like it’s already yours.</h2><p>Write an identity statement in the present tense so your goal becomes part of how you train.</p>
          <label className="goal-flow-primary-input">
            <span>Identity statement</span>
            <textarea autoFocus maxLength={240} placeholder="I’m so happy and grateful now that I am an MLB Draft Pick." value={draft.affirmation} onChange={(event) => update('affirmation', event.target.value)} />
          </label>
        </div>
      )}

      {step === 4 && (
        <div className="goal-flow-step">
          <span>Step 4</span><h2>What actions will get you there?</h2><p>Connect the work you already track or create a new daily action.</p>
          <div className="goal-flow-activity-list">
            {standards.map((standard) => (
              <button className={draft.linkedStandardIds.includes(standard.id) ? 'active' : ''} key={standard.id} onClick={() => toggleLinkedActivity(standard.id)} type="button">
                <i>{draft.linkedStandardIds.includes(standard.id) ? <Check size={13} /> : null}</i><span>{standard.label}</span>
              </button>
            ))}
            {draft.newActivities.map((activity) => <span className="goal-flow-new-activity" key={activity.id}><Check size={13} />{activity.label}</span>)}
          </div>
          <div className="goal-flow-inline-add">
            <input placeholder="Create new activity" value={activityText} onChange={(event) => setActivityText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addNewActivity(); } }} />
            <button onClick={addNewActivity} type="button"><Plus size={16} /> Add</button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="goal-flow-step">
          <span>Step 5 · Optional</span><h2>Build the roadmap.</h2><p>Big goals are built one milestone at a time.</p>
          <div className="goal-flow-milestones">
            {draft.milestones.map((milestone, index) => (
              <div key={milestone.id}><i>{index + 1}</i><span>{milestone.label}</span><button onClick={() => update('milestones', draft.milestones.filter((item) => item.id !== milestone.id))} type="button" aria-label={`Remove ${milestone.label}`}><X size={15}/></button></div>
            ))}
          </div>
          <div className="goal-flow-inline-add">
            <input placeholder="Add a milestone" value={milestoneText} onChange={(event) => setMilestoneText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addMilestone(); } }} />
            <button onClick={addMilestone} type="button"><Plus size={16} /> Add</button>
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="goal-flow-step">
          <span>Step 6 · Optional</span><h2>Set a target date.</h2><p>A date gives the work direction without defining your worth.</p>
          <label className="goal-flow-date">
            <CalendarDays size={20} />
            <input type="date" value={draft.targetDate} onChange={(event) => update('targetDate', event.target.value)} />
          </label>
          <div className="goal-flow-review">
            <span>{draft.category}</span><strong>{draft.title}</strong><p>{draft.linkedStandardIds.length + draft.newActivities.length} daily actions · {draft.milestones.length} milestones</p>
          </div>
        </div>
      )}

      {step === 7 && (
        <div className="goal-created-state">
          <i><Sparkles size={34} /></i>
          <span>{createdGoal?.category}</span>
          <h2>The target is set.</h2>
          <strong>{createdGoal?.value}</strong>
          <p>Now your daily actions decide how close you get.</p>
          <button onClick={() => onCreated(createdGoal)} type="button">Start Making Deposits <ArrowRight size={18}/></button>
        </div>
      )}

      {step < 6 && (
        <footer className="goal-flow-footer">
          <button disabled={!canContinue} onClick={() => setStep((current) => current + 1)} type="button">Continue <ArrowRight size={17}/></button>
        </footer>
      )}
      {step === 6 && <footer className="goal-flow-footer"><button onClick={createGoal} type="button">Create My Goal <Target size={17}/></button></footer>}
    </section>
  );
}

function GoalDetail({ goal, goals, standards, standardsHistory, streakCount, setGoals, setStandards, onBack, onArchive, onDelete, onComplete, celebrate, trackAnalyticsEvent }) {
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState({ category: goalCategory(goal), title: goalTitle(goal), affirmation: goal.affirmation || '' });
  const [progressOpen, setProgressOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [milestoneText, setMilestoneText] = useState('');
  const [editingMilestoneId, setEditingMilestoneId] = useState('');
  const [editingMilestoneText, setEditingMilestoneText] = useState('');
  const [newActivityText, setNewActivityText] = useState('');
  const activities = linkedActivitiesForGoal(standards, goal.id);
  const completedActivities = activities.filter((activity) => activity.done).length;
  const progress = clampProgress(goal.progress);
  const milestones = goalMilestones(goal);
  const lockedDays = lockedDaysForGoal(standardsHistory, goal);
  const investedDays = investedDaysForGoal(standardsHistory, goal);

  function updateGoal(fields) {
    setGoals((current) => current.map((item) => String(item.id) === String(goal.id) ? { ...item, ...fields } : item));
  }

  function saveGoalEdit() {
    const category = editDraft.category.trim() || goalCategory(goal);
    const title = editDraft.title.trim();
    if (!title) return;
    updateGoal({ label: category, category, value: title, affirmation: editDraft.affirmation.trim() });
    setEditing(false);
    trackAnalyticsEvent?.('goal_edited', { goalId: goal.id }, { area: 'goals' });
  }

  function updateMilestones(next) {
    updateGoal({ milestones: next });
  }

  function addMilestone() {
    const label = milestoneText.trim();
    if (!label) return;
    updateMilestones([...milestones, { id: `milestone-${Date.now()}`, label, done: false }]);
    setMilestoneText('');
  }

  function toggleMilestone(id) {
    const next = milestones.map((milestone) => milestone.id === id ? { ...milestone, done: !milestone.done } : milestone);
    updateMilestones(next);
    navigator.vibrate?.(12);
    if (next.find((milestone) => milestone.id === id)?.done) celebrate?.('Milestone complete. Keep climbing.');
  }

  function saveMilestone(id) {
    const label = editingMilestoneText.trim();
    if (!label) return;
    updateMilestones(milestones.map((milestone) => milestone.id === id ? { ...milestone, label } : milestone));
    setEditingMilestoneId('');
    setEditingMilestoneText('');
  }

  function moveMilestone(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= milestones.length) return;
    const next = [...milestones];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    updateMilestones(next);
  }

  function toggleActivityLink(activity) {
    setStandards((current) => current.map((standard) => standard.id === activity.id
      ? { ...standard, goalId: String(standard.goalId) === String(goal.id) ? null : goal.id }
      : standard));
    navigator.vibrate?.(8);
  }

  function createLinkedActivity() {
    const label = newActivityText.trim();
    if (!label) return;
    setStandards((current) => [...current, { id: Date.now(), label, done: false, goalId: goal.id }]);
    setNewActivityText('');
    celebrate?.('Activity linked to your goal.');
  }

  return (
    <div className="goal-detail-view">
      <button className="goal-detail-back" onClick={onBack} type="button">← Back to My Goals</button>

      <section className="goal-detail-hero">
        <div className="goal-detail-hero-top"><span>{goalCategory(goal)}</span><button onClick={() => setEditing((value) => !value)} type="button" aria-label="Edit goal"><PenLine size={16}/></button></div>
        {editing ? (
          <div className="goal-detail-edit-form">
            <select value={editDraft.category} onChange={(event) => setEditDraft((current) => ({ ...current, category: event.target.value }))}>
              {[...new Set([...goalCategories, goalCategory(goal)])].map((category) => <option key={category}>{category}</option>)}
            </select>
            <input value={editDraft.title} onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))} aria-label="Goal title" />
            <textarea value={editDraft.affirmation} onChange={(event) => setEditDraft((current) => ({ ...current, affirmation: event.target.value }))} placeholder="Identity statement" />
            <div><button onClick={() => setEditing(false)} type="button">Cancel</button><button onClick={saveGoalEdit} type="button">Save Changes</button></div>
          </div>
        ) : (
          <><h2>{goalTitle(goal)}</h2><blockquote>“{goalAffirmation(goal)}”</blockquote></>
        )}
      </section>

      <section className="goal-detail-progress">
        <div className="goal-progress-primary"><strong>{progress}%</strong><span>Goal progress</span></div>
        <GoalProgressBar progress={progress} />
        <strong className="goal-locked-days">{lockedDays} Locked-In Day{lockedDays === 1 ? '' : 's'}</strong>
        <div className="goal-progress-stats">
          <span><Flame size={15}/><em>Current streak</em><strong>{streakCount} Days</strong></span>
          <span><Clock size={15}/><em>Days invested</em><strong>{investedDays}</strong></span>
          <span><Link size={15}/><em>Activities linked</em><strong>{activities.length}</strong></span>
        </div>
        <button className="goal-feel-progress" onClick={() => setProgressOpen(true)} type="button">How close do you feel? <ChevronRight size={15}/></button>
      </section>

      <section className="goal-detail-deposit">
        <header><div><span>Today’s Deposit</span><h3>What will you do today to earn this goal?</h3></div><strong>{completedActivities} of {activities.length}</strong></header>
        {activities.length ? <DepositList activities={activities} /> : <div className="goal-deposit-empty"><Target size={23}/><strong>Your goal needs a daily action.</strong><p>Connect the work that moves this goal forward.</p></div>}
        <button className="goal-link-activity" onClick={() => setLinkOpen(true)} type="button"><Plus size={16}/>{activities.length ? 'Link Activity' : 'Link Your First Activity'}</button>
      </section>

      <section className="goal-roadmap">
        <header><span>Roadmap</span><h3>Big goals are built one milestone at a time.</h3></header>
        <div className="goal-milestone-timeline">
          {milestones.map((milestone, index) => (
            <article className={milestone.done ? 'done' : ''} key={milestone.id}>
              <button className="goal-milestone-check" onClick={() => toggleMilestone(milestone.id)} type="button" aria-label={`${milestone.done ? 'Reopen' : 'Complete'} ${milestone.label}`}>{milestone.done ? <Check size={14}/> : null}</button>
              {editingMilestoneId === milestone.id ? (
                <div className="goal-milestone-edit"><input value={editingMilestoneText} onChange={(event) => setEditingMilestoneText(event.target.value)} /><button onClick={() => saveMilestone(milestone.id)} type="button">Save</button></div>
              ) : <strong>{milestone.label}</strong>}
              <div className="goal-milestone-actions">
                <button disabled={index === 0} onClick={() => moveMilestone(index, -1)} type="button" aria-label="Move milestone up">↑</button>
                <button disabled={index === milestones.length - 1} onClick={() => moveMilestone(index, 1)} type="button" aria-label="Move milestone down">↓</button>
                <button onClick={() => { setEditingMilestoneId(milestone.id); setEditingMilestoneText(milestone.label); }} type="button" aria-label={`Edit ${milestone.label}`}><PenLine size={13}/></button>
                <button onClick={() => updateMilestones(milestones.filter((item) => item.id !== milestone.id))} type="button" aria-label={`Delete ${milestone.label}`}><Trash2 size={13}/></button>
              </div>
            </article>
          ))}
          {!milestones.length && <p>No milestones yet. Add the first marker between you and the target.</p>}
        </div>
        <div className="goal-roadmap-add"><input placeholder="Add milestone" value={milestoneText} onChange={(event) => setMilestoneText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addMilestone(); } }} /><button onClick={addMilestone} type="button"><Plus size={15}/> Add</button></div>
      </section>

      <section className="goal-target-date">
        <i><CalendarDays size={19}/></i><div><span>Target date</span><strong>{formatTargetDate(goal.targetDate)}</strong></div><button onClick={() => setDateOpen((value) => !value)} type="button">{goal.targetDate ? 'Edit' : 'Set Date'}</button>
        {dateOpen && <input type="date" value={goal.targetDate || ''} onChange={(event) => { updateGoal({ targetDate: event.target.value }); setDateOpen(false); }} />}
      </section>

      <section className="goal-accountability">
        <span>You said this matters.</span><h3>What did you do about it today?</h3>
        <p>{activities.length ? `${completedActivities} of ${activities.length} deposits completed. Your behavior is the evidence.` : 'Connect one daily action and start building evidence.'}</p>
      </section>

      <div className="goal-detail-management">
        <button onClick={onComplete} type="button"><Check size={15}/> {progress >= 100 ? 'Goal Complete' : 'Complete Goal'}</button>
        <button onClick={onArchive} type="button">Archive</button>
        <button onClick={onDelete} type="button"><Trash2 size={14}/> Delete</button>
      </div>

      {progressOpen && (
        <div className="goal-sheet-backdrop" onClick={() => setProgressOpen(false)} role="presentation">
          <section className="goal-bottom-sheet" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Update goal progress">
            <header><div><span>Personal estimate</span><h2>How close do you feel?</h2></div><button onClick={() => setProgressOpen(false)} type="button" aria-label="Close progress editor"><X size={17}/></button></header>
            <strong className="goal-sheet-percentage">{progress}%</strong>
            <input type="range" min="0" max="100" step="1" value={progress} onChange={(event) => updateGoal({ progress: clampProgress(event.target.value) })} style={{ '--goal-progress': `${progress}%` }} />
            <p>This is your own estimate. Locked-In Days remain separate evidence of the work.</p>
            <button className="goal-sheet-primary" onClick={() => setProgressOpen(false)} type="button">Save Progress</button>
          </section>
        </div>
      )}

      {linkOpen && (
        <div className="goal-sheet-backdrop" onClick={() => setLinkOpen(false)} role="presentation">
          <section className="goal-bottom-sheet goal-link-sheet" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Link activities to goal">
            <header><div><span>Today’s Deposit</span><h2>Link Activity</h2></div><button onClick={() => setLinkOpen(false)} type="button" aria-label="Close activity linker"><X size={17}/></button></header>
            <div className="goal-link-sheet-list">
              {standards.map((activity) => {
                const linkedHere = String(activity.goalId) === String(goal.id);
                const otherGoal = goals.find((item) => String(item.id) === String(activity.goalId));
                return <button className={linkedHere ? 'active' : ''} key={activity.id} onClick={() => toggleActivityLink(activity)} type="button"><i>{linkedHere ? <Check size={13}/> : null}</i><span><strong>{activity.label}</strong>{otherGoal && !linkedHere ? <em>Currently linked to {goalTitle(otherGoal)}</em> : null}</span></button>;
              })}
            </div>
            <div className="goal-link-new"><input placeholder="Create new activity" value={newActivityText} onChange={(event) => setNewActivityText(event.target.value)} /><button onClick={createLinkedActivity} type="button"><Plus size={15}/> Add</button></div>
            <button className="goal-sheet-primary" onClick={() => setLinkOpen(false)} type="button">Done</button>
          </section>
        </div>
      )}
    </div>
  );
}

export default function GoalCommandCenter({
  awardPoints,
  celebrate,
  goalAddedPoints = 10,
  goalCompletedPoints = 150,
  goals,
  setGoals,
  setStandards,
  standards,
  standardsHistory = [],
  streakCount = 0,
  trackAnalyticsEvent,
  userId
}) {
  const [filter, setFilter] = useState('active');
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [widgetNoticeVisible, setWidgetNoticeVisible] = useState(false);
  const widgetNoticeRecorded = useRef(false);
  const [archivedGoalIds, setArchivedGoalIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('the-complete-athlete-archived-goals') || '[]'); }
    catch { return []; }
  });

  const selectedGoal = goals.find((goal) => String(goal.id) === String(selectedGoalId))
    || (String(selectedGoalId || '').startsWith('created:')
      ? goals.find((goal) => goalTitle(goal) === String(selectedGoalId).slice(8))
      : null);
  const filteredGoals = useMemo(() => goals.filter((goal) => {
    const archived = archivedGoalIds.some((id) => String(id) === String(goal.id));
    if (filter === 'archived') return archived;
    if (filter === 'completed') return !archived && clampProgress(goal.progress) >= 100;
    return !archived && clampProgress(goal.progress) < 100;
  }), [archivedGoalIds, filter, goals]);

  useEffect(() => {
    if (widgetNoticeRecorded.current) return undefined;
    widgetNoticeRecorded.current = true;
    const storageKey = `tca-goal-widget-notice-count:v1:${String(userId || 'local-athlete')}`;
    let appearanceCount = 0;
    try {
      appearanceCount = Math.max(0, Number(localStorage.getItem(storageKey)) || 0);
    } catch {
      appearanceCount = 0;
    }
    if (appearanceCount >= 3) return undefined;
    try {
      localStorage.setItem(storageKey, String(appearanceCount + 1));
    } catch {
      // The notice can still appear when storage is unavailable.
    }
    setWidgetNoticeVisible(true);
    const timer = window.setTimeout(() => setWidgetNoticeVisible(false), 10000);
    return () => window.clearTimeout(timer);
  }, [userId]);

  function toggleArchive(id) {
    setArchivedGoalIds((current) => {
      const archived = current.some((goalId) => String(goalId) === String(id));
      const next = archived ? current.filter((goalId) => String(goalId) !== String(id)) : [...current, id];
      localStorage.setItem('the-complete-athlete-archived-goals', JSON.stringify(next));
      return next;
    });
  }

  function completeGoal(goal) {
    const wasComplete = clampProgress(goal.progress) >= 100;
    setGoals((current) => current.map((item) => String(item.id) === String(goal.id) ? { ...item, progress: 100 } : item));
    const awarded = !wasComplete && awardPoints?.({
      type: 'goal_completed',
      points: goalCompletedPoints,
      label: `${goalCategory(goal)} completed`,
      uniqueKey: `goal-completed-${goal.id}`,
      metadata: { goalLabel: goalCategory(goal), goalTitle: goalTitle(goal) }
    });
    trackAnalyticsEvent?.('goal_completed', { alreadyComplete: wasComplete, linkedStandards: linkedActivitiesForGoal(standards, goal.id).length }, { area: 'goals' });
    celebrate?.(awarded ? `Goal complete. +${goalCompletedPoints} points.` : 'Goal complete. Achievement unlocked.');
  }

  function deleteGoal(goal) {
    if (!window.confirm(`Delete “${goalTitle(goal)}”? This cannot be undone.`)) return;
    setGoals((current) => current.filter((item) => String(item.id) !== String(goal.id)));
    setStandards((current) => current.map((standard) => String(standard.goalId) === String(goal.id) ? { ...standard, goalId: null } : standard));
    setSelectedGoalId(null);
  }

  if (composerOpen) {
    return <GoalCreationFlow standards={standards} setGoals={setGoals} setStandards={setStandards} awardPoints={awardPoints} celebrate={celebrate} goalAddedPoints={goalAddedPoints} onClose={() => setComposerOpen(false)} onCreated={(goal) => { setComposerOpen(false); setSelectedGoalId(`created:${goal.value}`); }} trackAnalyticsEvent={trackAnalyticsEvent} />;
  }

  if (selectedGoal) {
    return <GoalDetail goal={selectedGoal} goals={goals} standards={standards} standardsHistory={standardsHistory} streakCount={streakCount} setGoals={setGoals} setStandards={setStandards} onBack={() => setSelectedGoalId(null)} onArchive={() => { toggleArchive(selectedGoal.id); setSelectedGoalId(null); }} onDelete={() => deleteGoal(selectedGoal)} onComplete={() => completeGoal(selectedGoal)} celebrate={celebrate} trackAnalyticsEvent={trackAnalyticsEvent} />;
  }

  return (
    <div className="goal-command-center">
      <blockquote className="goals-discipline-quote">
        “Goals are the GPS for where you want to go, but it’s your daily discipline that gets you there.”
      </blockquote>

      <div className={`goal-command-controls${goals.length ? '' : ' no-filters'}`}>
        {goals.length > 0 && (
          <div className="goal-command-filters" aria-label="Filter goals">
            {['active', 'completed', 'archived'].map((item) => <button className={filter === item ? 'active' : ''} key={item} onClick={() => setFilter(item)} type="button">{item}</button>)}
          </div>
        )}
        <button className="goal-command-add" onClick={() => setComposerOpen(true)} type="button"><Plus size={16}/> New Goal</button>
      </div>

      {!goals.length ? (
        <section className="goal-command-empty">
          <div className="goal-empty-visual"><Target size={30}/><span><ArrowRight size={15}/></span><Check size={25}/><span><ArrowRight size={15}/></span><Sparkles size={27}/></div>
          <span>Goal → Action → Progress</span><h2>What are you chasing?</h2><p>Goals give your work a destination. Set the target, connect the actions, then stack the days.</p>
          <button onClick={() => setComposerOpen(true)} type="button">Set My First Goal <ArrowRight size={17}/></button>
        </section>
      ) : filteredGoals.length ? (
        <div className="goal-command-list">{filteredGoals.map((goal) => <GoalOverviewCard goal={goal} standards={standards} standardsHistory={standardsHistory} onOpen={setSelectedGoalId} key={goal.id} />)}</div>
      ) : (
        <section className="goal-command-filter-empty"><CircleHelp size={22}/><strong>No {filter} goals yet.</strong><p>Your goals will appear here when their status changes.</p></section>
      )}

      {widgetNoticeVisible && (
        <aside className="goal-widget-notice" role="status">
          <i><Smartphone size={20}/></i>
          <div>
            <strong>Keep your goals in sight</strong>
            <p>You can add Complete Athlete widgets to your Home Screen and see your goals every day.</p>
          </div>
          <button aria-label="Dismiss Home Screen widget notice" onClick={() => setWidgetNoticeVisible(false)} type="button"><X size={16}/></button>
        </aside>
      )}
    </div>
  );
}
