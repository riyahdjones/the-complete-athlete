const createdAt = '2026-09-23T00:00:00.000Z';

const definitions = {
  CONFIDENCE: [
    ['What have you done this week that gives you permission to trust yourself today?', 'text_short'],
    ['What is one part of your game you trust completely?', 'text_short'],
    ['What is something you have already proven to yourself?', 'text_short'],
    ['What would playing with confidence look like today?', 'text_short'],
    ['What is one thing you know you can do well no matter who you are competing against?', 'text_short'],
    ['What preparation are you most proud of heading into today?', 'text_short'],
    ['I trust myself today because ______.', 'statement_completion'],
    ['What is one past performance that reminds you what you are capable of?', 'text_short'],
    ['Which mindset do you want to compete with today?', 'single_select', ['Fearless', 'Calm', 'Aggressive', 'Free', 'Confident', 'Patient']],
    ['If you completely trusted your preparation today, how would you compete differently?', 'text_short']
  ],
  FOCUS: [
    ['What deserves your attention today?', 'text_short'], ['What is one thing you refuse to let steal your focus?', 'text_short'],
    ['What does staying present look like in your sport today?', 'text_short'], ['What is your next-play reminder?', 'text_short'],
    ['Which distraction do you need to ignore today?', 'single_select', ['Stats', 'Crowd', 'Officials', 'Opponent', 'Coach reactions', 'Parents', 'Last play', 'Future outcome', 'Other']],
    ['What is the ONE thing you want your mind focused on when competition starts?', 'text_short'],
    ['When my mind starts wandering, I will ______.', 'statement_completion'], ['What part of your routine helps you slow the game down?', 'text_short'],
    ['How present do you want to be today?', 'scale'], ['What simple cue can bring you back to the present moment?', 'text_short']
  ],
  CONTROLLABLES: [
    ['What are your 3 controllables today?', 'multi_select', ['Effort', 'Energy', 'Attitude', 'Communication', 'Preparation', 'Response', 'Body Language', 'Focus', 'Hustle', 'Discipline'], 3],
    ['Which controllable matters most today?', 'single_select', ['Effort', 'Energy', 'Attitude', 'Communication', 'Preparation', 'Response', 'Body Language', 'Focus', 'Hustle', 'Discipline']],
    ['What can you control no matter how the game is going?', 'text_short'], ['What is completely outside of your control today?', 'text_short'],
    ['No matter what happens, I control my ______.', 'statement_completion'], ['If something unfair happens today, what can you still control?', 'text_short'],
    ['Which controllable can immediately improve your performance today?', 'text_short'], ['What behavior will show that you are controlling what you can control?', 'text_short'],
    ['What is one thing you will NOT waste energy trying to control today?', 'text_short'], ["If the result isn't going your way, what remains fully yours?", 'text_short']
  ],
  IDENTITY: [
    ['Who are you choosing to be when you compete today?', 'text_short'], ['Today I compete like someone who ______.', 'statement_completion'],
    ['What kind of teammate do you want to be today?', 'text_short'], ['What do you want your body language to say about you?', 'text_short'],
    ["How would the best version of you handle today's game?", 'text_short'], ['What standard do you want to hold yourself to today?', 'text_short'],
    ['What identity do you want to play from today?', 'single_select', ['Leader', 'Competitor', 'Warrior', 'Playmaker', 'Teammate', 'Professional', 'Learner']],
    ['What do you want people to feel when they compete beside you today?', 'text_short'], ['What version of yourself are you leaving behind today?', 'text_short'],
    ['Regardless of the scoreboard, I am an athlete who ______.', 'statement_completion']
  ],
  ADVERSITY: [
    ['If you make an early mistake, what will your response be?', 'text_short'], ['What will you tell yourself when something goes wrong?', 'text_short'],
    ['What does a great response to adversity look like today?', 'text_short'], ['If you have a bad start, how will you reset?', 'text_short'],
    ['What is one thing that usually frustrates you during competition?', 'text_short'], ['How do you want to respond if that happens today?', 'text_short'],
    ['One bad moment does not mean ______.', 'statement_completion'], ['When adversity shows up, who are you going to be?', 'text_short'],
    ['Which response do you want to choose after a mistake?', 'single_select', ['Breathe', 'Reset', 'Communicate', 'Attack the next play', 'Slow down', 'Trust my training']],
    ['What will help you move on quickly from a mistake?', 'text_short']
  ],
  PRESSURE: [
    ["What are you feeling about today's competition?", 'single_select', ['Excited', 'Confident', 'Calm', 'Nervous', 'Pressured', 'Unsure', 'Ready']],
    ['What would playing free look like today?', 'text_short'], ['What expectation do you need to let go of before you compete?', 'text_short'],
    ['If nobody was watching today, how would you play?', 'text_short'], ['What pressure are you carrying that does not belong on the field or court?', 'text_short'],
    ['I do not need to be perfect. I need to ______.', 'statement_completion'], ['What would happen if you stopped trying to prove something today?', 'text_short'],
    ['Which feeling do you want to bring into competition?', 'single_select', ['Free', 'Calm', 'Aggressive', 'Focused', 'Joyful', 'Confident']],
    ['What can you remind yourself when the moment feels big?', 'text_short'], ['How can you turn your nerves into energy?', 'text_short']
  ],
  PURPOSE: [
    ['Why do you love playing your sport?', 'text_short'], ['Who are you competing for besides yourself today?', 'text_short'],
    ['What makes today worth enjoying?', 'text_short'], ['What opportunity do you have today that you do not want to take for granted?', 'text_short'],
    ['What are you grateful for before you compete?', 'text_short'], ['What would make you proud of how you compete today even if the result does not go your way?', 'text_short'],
    ['Why does becoming a better athlete matter to you?', 'text_short'], ['Who helped you get to this moment?', 'text_short'],
    ['What would playing with joy look like today?', 'text_short'], ['Today I get to ______.', 'statement_completion']
  ],
  INTENTION: [
    ['What is your ONE focus for today?', 'text_short'], ['What do you want to execute well today?', 'text_short'],
    ['What is one behavior you want to be intentional about?', 'text_short'], ['How do you want to start the game?', 'text_short'],
    ['What kind of energy do you want to bring from the beginning?', 'single_select', ['Calm', 'Explosive', 'Confident', 'Focused', 'Aggressive', 'Joyful']],
    ['What would make today a successful competition beyond the scoreboard?', 'text_short'], ['What is one thing you want to learn today?', 'text_short'],
    ['What do you want to commit to before the game starts?', 'text_short'], ['Today I will ______ no matter what.', 'statement_completion'],
    ['When the game ends, what do you want to know you gave?', 'text_short']
  ]
};

export const GAME_DAY_QUESTIONS = Object.entries(definitions).flatMap(([category, questions], categoryIndex) =>
  questions.map(([questionText, responseType, options, maxSelections], index) => ({
    id: `gd-${category.toLowerCase()}-${index + 1}`,
    category,
    questionText,
    responseType,
    options: options || [],
    maxSelections: maxSelections || null,
    active: true,
    createdAt,
    displayOrder: categoryIndex * 10 + index + 1,
    weight: 1
  }))
);

export function selectGameDayQuestions(sessionHistory, random = Math.random) {
  const recentIds = new Set(sessionHistory.slice(0, 5).flatMap((session) => session.questionIds || []));
  const active = GAME_DAY_QUESTIONS.filter((question) => question.active);
  const available = active.filter((question) => !recentIds.has(question.id));
  const pool = available.length >= 3 ? available : active;
  const shuffledCategories = [...new Set(pool.map((question) => question.category))].sort(() => random() - 0.5);
  const selected = [];
  const usedTypes = new Set();
  for (const category of shuffledCategories) {
    const candidates = pool.filter((question) => question.category === category);
    candidates.sort((a, b) => (usedTypes.has(a.responseType) ? 1 : 0) - (usedTypes.has(b.responseType) ? 1 : 0) || random() - 0.5);
    const question = candidates[0];
    if (question) {
      selected.push(question);
      usedTypes.add(question.responseType);
    }
    if (selected.length === 3) break;
  }
  return selected;
}

export function toggleGameDayChoice(currentValue, option, maxSelections = 3) {
  const values = Array.isArray(currentValue) ? currentValue : currentValue ? [currentValue] : [];
  if (values.includes(option)) return values.filter((value) => value !== option);
  return values.length < maxSelections ? [...values, option] : values;
}
