import { logAppEvent } from './_monitoring.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_MODERATION_URL = 'https://api.openai.com/v1/moderations';
const MAX_MESSAGE_LENGTH = 1200;
const MAX_HISTORY_MESSAGES = 12;
const MAX_MEMORY_ITEMS = 8;
const MAX_CURRICULUM_PLANS = 18;
const MAX_CURRICULUM_STEPS = 10;
const DAILY_COACH_MESSAGE_LIMIT = 15;
const SPORTS_FETCH_TIMEOUT_MS = 3500;
const SPORTS_MAX_EVENTS_PER_LEAGUE = 6;
const SPORTS_MAX_NEWS_PER_LEAGUE = 5;
const SPORTS_TEAM_CACHE_TTL_MS = 1000 * 60 * 60 * 12;

const sportsLeagues = {
  nba: { label: 'NBA', sport: 'basketball', league: 'nba' },
  nfl: { label: 'NFL', sport: 'football', league: 'nfl' },
  mlb: { label: 'MLB', sport: 'baseball', league: 'mlb' },
  mls: { label: 'MLS', sport: 'soccer', league: 'usa.1' }
};

const sportsTeamAliases = {
  mlb: [
    'dodgers', 'yankees', 'mets', 'red sox', 'redsox', 'cubs', 'white sox', 'whitesox', 'giants',
    'padres', 'angels', 'athletics', 'a s', 'astros', 'rangers', 'mariners', 'orioles',
    'blue jays', 'bluejays', 'rays', 'guardians', 'tigers', 'twins', 'royals', 'braves',
    'phillies', 'nationals', 'marlins', 'brewers', 'cardinals', 'reds', 'pirates',
    'diamondbacks', 'dbacks', 'rockies'
  ],
  nba: [
    'lakers', 'clippers', 'warriors', 'celtics', 'knicks', 'nets', 'heat', 'magic', 'hawks',
    'hornets', 'bulls', 'cavaliers', 'cavs', 'pistons', 'pacers', 'bucks', 'timberwolves',
    'wolves', 'thunder', 'nuggets', 'jazz', 'blazers', 'trail blazers', 'kings', 'suns',
    'mavericks', 'mavs', 'rockets', 'spurs', 'grizzlies', 'pelicans', 'raptors', 'sixers',
    '76ers', 'wizards'
  ],
  nfl: [
    'chiefs', 'eagles', 'cowboys', 'giants', 'jets', 'patriots', 'dolphins', 'bills', 'ravens',
    'steelers', 'bengals', 'browns', 'texans', 'colts', 'titans', 'jaguars', 'broncos',
    'raiders', 'chargers', 'commanders', 'packers', 'bears', 'lions', 'vikings', 'falcons',
    'panthers', 'saints', 'buccaneers', 'bucs', 'cardinals', 'rams', 'seahawks', '49ers', 'niners'
  ],
  mls: [
    'inter miami', 'lafc', 'la galaxy', 'galaxy', 'atlanta united', 'austin fc', 'charlotte fc',
    'chicago fire', 'colorado rapids', 'columbus crew', 'dc united', 'd c united', 'fc cincinnati',
    'fc dallas', 'houston dynamo', 'sporting kc', 'sporting kansas city', 'minnesota united',
    'cf montreal', 'nashville sc', 'new england revolution', 'nycfc', 'new york city fc',
    'orlando city', 'philadelphia union', 'portland timbers', 'real salt lake',
    'san jose earthquakes', 'seattle sounders', 'st louis city', 'toronto fc', 'vancouver whitecaps'
  ]
};

let sportsTeamAliasCache = { expiresAt: 0, aliases: {} };

const crisisPattern =
  /\b(kill myself|end my life|suicide|suicidal|hurt myself|self harm|self-harm|i want to die|don't want to live|cut myself)\b/i;

const coachInstructions = `
You are My Mindset Coach for The Complete Athlete, a mental performance app for young athletes.

Your role:
- Coach mindset, composure, confidence, accountability, preparation, team dynamics, coach communication, slumps, fear of failure, and pressure.
- Understand the language, moments, and demands of major youth sports, especially football, basketball, baseball, volleyball, golf, and track. Use sport-specific context when it helps: positions, practices, games/meets/matches, reps, routines, slumps, playing time, role changes, pressure moments, and coach/team dynamics.
- If the athlete mentions a sport-specific situation, respond in that sport's language without pretending to know facts they did not share.
- Be supportive, direct, and honest. Do not be a yes-man.
- Challenge excuses without shaming the athlete.
- Keep answers practical and short enough for an athlete to use immediately.
- Use the athlete's context when provided, but do not invent personal facts.
- If an age is available, adjust language and safety caution for that age. For younger athletes, use simpler language and encourage involving a parent/guardian or trusted adult sooner.
- Use prior growth memory only as context. Do not mention private memory as if it is surveillance; phrase it naturally as patterns the athlete has been working on.
- Use the app curriculum context when the athlete asks about the Daily Deposit, Today's Focus, or Performance Plans. Explain the idea in plain athlete language and help them apply it to their sport or day.
- When answering about a Performance Plan, mention the athlete's current plan day when available, such as "Day 1 of 7," and anchor the advice to that day's steps.
- If a Performance Plan is locked, explain that it unlocks after the prior plan is completed and the next day arrives. Do not give locked-plan steps as if they are available today.
- Do not claim the athlete completed a deposit, plan, goal, productivity item, or reflection unless the provided data says so.
- When the athlete asks about current professional sports scores, schedules, standings, or news in MLB, MLS, NBA, or NFL, use the provided live sports context. If live sports context is not available or does not answer the question, say that you cannot verify the live update from inside the app right now instead of guessing.
- For sports-score questions, answer directly inside the chat from the provided context. Do not send athletes to ESPN, MLB, NBA, NFL, MLS, another app, or another website.
- Keep sports-news answers short and practical. Give source names only from the provided sports context, and do not quote long article text.

Safety boundaries:
- You are not a therapist, doctor, lawyer, or crisis counselor.
- Do not diagnose mental health conditions.
- Do not give medical, injury treatment, medication, eating-disorder, or emergency advice.
- For injuries, encourage the athlete to tell a parent/guardian, coach, athletic trainer, or medical professional.
- For bullying, abuse, threats, self-harm, or serious distress, encourage immediate help from a trusted adult and local emergency/crisis resources.
- Never encourage violence, retaliation, dangerous training, hiding symptoms, extreme dieting, or playing through serious injury.
- If the athlete asks for help harming themselves or someone else, respond with immediate safety support and do not continue ordinary coaching.

Response style:
- Sound like a real coach in a private conversation, not a worksheet, script, or motivational poster.
- If the athlete sends a casual check-in like "you there," "hey," "what's up," or "can you help," answer naturally first. Do not treat it as a performance problem.
- Use the athlete's first name sometimes when it feels natural, especially to greet, reassure, or bring them back to the point. Do not use their name in every message.
- Listen first. If the athlete's message is vague, broad, or emotional without details, do not give steps yet. Ask 1-2 warm clarifying questions and wait for the athlete to explain.
- Do not assume the problem. Reflect what the athlete actually said, then find out what happened, when it happens, and what they want help changing.
- If the problem is clear, give a short human response: one honest observation, one or two practical moves, and one question or small action for today.
- Never start with "One clear truth" or use labels like "Reflection," "Action step," "Cue ideas," or "Do this right now."
- Do not use markdown formatting, asterisks, bold marks, headings, rigid formats, numbered lists, repeated slogans, hashtags, or clinical language.
- Keep it concise, but let it feel natural.

Examples of the right style:
Athlete: "you there"
Coach: "I'm here. What's going on today?"

Athlete: "im having a challenge"
Coach: "I'm with you. What kind of challenge are we talking about: practice, a game, confidence, a coach, teammates, or something outside the sport?"

Athlete: "I keep messing up in games"
Coach: "That is frustrating, especially when you know you can play better. When the mistake happens, what changes first: your body language, your focus, or the way you talk to yourself?"
`.trim();

function json(res, status, payload) {
  res.statusCode = status;
  setCorsHeaders(res);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function cleanMessage(value, maxLength = MAX_MESSAGE_LENGTH) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function displayCoachText(value) {
  return cleanMessage(value, 3000)
    .replace(/\*\*/g, '')
    .replace(/__+/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .trim();
}

function crisisResponse() {
  return [
    'Your safety matters more than performance right now.',
    'Please tell a trusted adult immediately: a parent, guardian, coach, school counselor, or another adult near you. If you might hurt yourself or someone else, call emergency services now. In the U.S. or Canada, call or text 988 for crisis support.',
    'For this moment: move away from anything you could use to hurt yourself, get near another person, and say out loud, “I need help right now.”'
  ].join(' ');
}

function blockedResponse() {
  return [
    'I can help you reset and choose a better response, but I cannot help with harm, threats, sexual content, or anything unsafe.',
    'Bring this to a trusted adult if someone could get hurt. If this is about competition pressure, tell me the sport moment and what response you want to train.'
  ].join(' ');
}

function limitResponse(limit) {
  return [
    `You have used your ${limit} coach messages for today.`,
    'Come back tomorrow and we will keep working from here. For now, write down the real moment, the response you want to train, and one action you can still control today.'
  ].join(' ');
}

function needsClarifyingQuestion(message, history) {
  const words = message.split(/\s+/).filter(Boolean);
  const lower = message.toLowerCase();
  const recentAthleteTurns = cleanMessages(history).filter((entry) => entry.role === 'athlete').length;
  if (recentAthleteTurns > 1) return false;
  if (isCasualCheckIn(message)) return false;

  const vaguePhrases = [
    'challenge',
    'struggling',
    'having a hard time',
    'need help',
    'help me',
    'stressed',
    'overthinking',
    'pressure',
    'not confident',
    'feel off',
    'bad day'
  ];
  const specificClues =
    /\b(free throw|shot|shooting|miss|turnover|strike|pitch|hit|serve|race|meet|sprint|jump|lap|hole|putt|swing|practice|game|match|coach said|teammate|playing time|bench|injury|hurt)\b/i;

  return (words.length <= 8 || vaguePhrases.some((phrase) => lower.includes(phrase))) && !specificClues.test(message);
}

function isCurriculumQuestion(message) {
  return /\b(daily deposit|deposit|today'?s focus|focus question|performance plan|plan|challenge|lesson|step|what does this mean|explain this|how do i use this)\b/i.test(message);
}

function normalizeSportsText(value) {
  const text = String(value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? ` ${text} ` : ' ';
}

function hasSportsCurrentIntent(message) {
  const lower = String(message ?? '').toLowerCase();
  return /\b(score|scores|scored|schedule|game|games|playoff|standings|rankings|record|injury report|trade|traded|draft|news|headline|today|tonight|last night|yesterday|tomorrow|latest|current|live|who won|winning|lost|beat)\b/i.test(lower);
}

function messageMentionsAlias(message, aliases) {
  const normalizedMessage = normalizeSportsText(message);
  return asArray(aliases).some((alias) => {
    const normalizedAlias = normalizeSportsText(alias).trim();
    return normalizedAlias && normalizedMessage.includes(` ${normalizedAlias} `);
  });
}

function staticSportsLeaguesForMessage(message) {
  const lower = String(message ?? '').toLowerCase();
  const leagues = new Set();
  if (/\bnba\b|basketball/.test(lower)) leagues.add('nba');
  if (/\bnfl\b|football/.test(lower)) leagues.add('nfl');
  if (/\bmlb\b|baseball/.test(lower)) leagues.add('mlb');
  if (/\bmls\b|soccer/.test(lower)) leagues.add('mls');
  Object.entries(sportsTeamAliases).forEach(([league, aliases]) => {
    if (messageMentionsAlias(message, aliases)) leagues.add(league);
  });
  return leagues;
}

function isSportsCurrentQuestion(message) {
  return hasSportsCurrentIntent(message) && staticSportsLeaguesForMessage(message).size > 0;
}

async function getLiveSportsTeamAliases() {
  const now = Date.now();
  if (sportsTeamAliasCache.expiresAt > now) return sportsTeamAliasCache.aliases;

  const entries = await Promise.all(Object.entries(sportsLeagues).map(async ([key, league]) => {
    const baseUrl = `https://site.api.espn.com/apis/site/v2/sports/${league.sport}/${league.league}`;
    const data = await fetchJsonWithTimeout(`${baseUrl}/teams`, SPORTS_FETCH_TIMEOUT_MS);
    const teams = asArray(data?.sports?.[0]?.leagues?.[0]?.teams)
      .map((entry) => entry.team || entry)
      .filter(Boolean);
    const aliases = teams.flatMap((team) => [
      team.displayName,
      team.shortDisplayName,
      team.name,
      team.nickname,
      team.abbreviation
    ]).filter(Boolean);
    return [key, aliases];
  }));

  sportsTeamAliasCache = {
    expiresAt: now + SPORTS_TEAM_CACHE_TTL_MS,
    aliases: Object.fromEntries(entries)
  };
  return sportsTeamAliasCache.aliases;
}

async function requestedSportsLeagues(message) {
  const leagues = staticSportsLeaguesForMessage(message);

  if (hasSportsCurrentIntent(message)) {
    const liveAliases = await getLiveSportsTeamAliases();
    Object.entries(liveAliases).forEach(([league, aliases]) => {
      if (messageMentionsAlias(message, aliases)) leagues.add(league);
    });
  }

  if (!leagues.size && hasSportsCurrentIntent(message)) {
    Object.keys(sportsLeagues).forEach((league) => leagues.add(league));
  }
  return [...leagues];
}

function sportsDateParams(message) {
  const lower = String(message ?? '').toLowerCase();
  const today = new Date();
  const offset = /\b(yesterday|last night)\b/i.test(lower) ? -1 : 0;
  const target = new Date(today);
  target.setDate(today.getDate() + offset);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return [`${yyyy}${mm}${dd}`];
}

async function fetchJsonWithTimeout(url, timeoutMs = SPORTS_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'The Complete Athlete Coach/1.0'
      },
      signal: controller.signal
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeScoreboard(data, leagueLabel) {
  const events = asArray(data?.events).slice(0, SPORTS_MAX_EVENTS_PER_LEAGUE);
  if (!events.length) return [`${leagueLabel} scoreboard: no current games returned.`];

  return events.map((event) => {
    const competition = asArray(event.competitions)[0] || {};
    const competitors = asArray(competition.competitors);
    const teams = competitors.map((competitor) => {
      const name = competitor.team?.shortDisplayName || competitor.team?.displayName || competitor.team?.abbreviation || 'Team';
      const score = competitor.score ?? '';
      return score !== '' ? `${name} ${score}` : name;
    });
    const status = event.status?.type?.shortDetail || event.status?.type?.description || event.status?.type?.state || '';
    const venue = competition.venue?.fullName ? ` at ${competition.venue.fullName}` : '';
    return `${leagueLabel}: ${teams.join(' vs ')}${status ? ` - ${status}` : ''}${venue}`;
  });
}

function summarizeNews(data, leagueLabel) {
  const articles = asArray(data?.articles).slice(0, SPORTS_MAX_NEWS_PER_LEAGUE);
  if (!articles.length) return [`${leagueLabel} news: no current headlines returned.`];

  return articles.map((article) => {
    const headline = cleanMessage(article.headline || article.title, 180);
    const description = cleanMessage(article.description, 220);
    const source = cleanMessage(article.source || article.provider || 'ESPN', 40);
    return `${leagueLabel} news from ${source}: ${headline}${description ? ` - ${description}` : ''}`;
  });
}

async function getSportsContext(message) {
  if (!hasSportsCurrentIntent(message)) return '';

  const keys = (await requestedSportsLeagues(message)).slice(0, 4);
  const dates = sportsDateParams(message);
  const sections = await Promise.all(keys.map(async (key) => {
    const league = sportsLeagues[key];
    if (!league) return '';

    const baseUrl = `https://site.api.espn.com/apis/site/v2/sports/${league.sport}/${league.league}`;
    const scoreboardUrl = `${baseUrl}/scoreboard?dates=${dates.join(',')}`;
    const [scoreboard, news] = await Promise.all([
      fetchJsonWithTimeout(scoreboardUrl),
      fetchJsonWithTimeout(`${baseUrl}/news`)
    ]);
    const lines = [
      ...summarizeScoreboard(scoreboard, league.label),
      ...summarizeNews(news, league.label)
    ];

    return [`${league.label} live context source: ESPN public sports data.`, ...lines].join('\n');
  }));

  const context = sections.filter(Boolean).join('\n\n');
  return context || 'Live sports lookup was requested, but no current sports data returned.';
}

function isCasualCheckIn(message) {
  return /^(yo+|hey+|hi+|hello+|sup|what'?s up|you there|are you there|u there|can you help|help me|coach|mindset coach)[\s?.!]*$/i.test(message);
}

function clarifyingResponse(message, athlete) {
  if (isCasualCheckIn(message)) {
    const firstName = cleanMessage(athlete?.name, 60).split(/\s+/)[0];
    const namePhrase = firstName && firstName !== 'Athlete' && firstName !== 'Unknown' ? `, ${firstName}` : '';
    return `I'm here${namePhrase}. What's going on today?`;
  }

  const sport = cleanMessage(athlete?.sport, 40);
  const sportPhrase = sport && sport !== 'Unknown' ? ` in ${sport}` : '';
  return [
    "I'm with you. Help me understand the moment a little more.",
    `Is it about confidence, pressure, a coach, teammates, playing time, focus${sportPhrase ? `, or something in ${sport}` : ', or something outside the sport'}?`,
    'What happened most recently?'
  ].join(' ');
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function planCurrentDay(releaseDate, challengeLength) {
  if (!releaseDate) return 1;
  const start = new Date(`${releaseDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return 1;
  const today = new Date();
  const current = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const diffDays = Math.floor((current.getTime() - start.getTime()) / 86400000) + 1;
  const length = Number(challengeLength) || 7;
  return Math.min(Math.max(diffDays, 1), length);
}

function cleanMessages(messages) {
  return asArray(messages)
    .map((entry) => ({
      role: entry?.role === 'coach' ? 'coach' : 'athlete',
      text: cleanMessage(entry?.text, 1000)
    }))
    .filter((entry) => entry.text)
    .slice(-40);
}

function buildMemoryContext(memory) {
  if (!memory) return 'No prior coach memory yet.';

  const patterns = asArray(memory.patterns).slice(0, MAX_MEMORY_ITEMS).join('; ');
  const growth = asArray(memory.growth_markers).slice(0, MAX_MEMORY_ITEMS).join('; ');
  const flags = asArray(memory.safety_flags).slice(0, MAX_MEMORY_ITEMS).join('; ');

  return [
    `Summary: ${memory.summary || 'None yet'}`,
    `Patterns: ${patterns || 'None yet'}`,
    `Growth markers: ${growth || 'None yet'}`,
    `Next focus: ${memory.next_focus || 'None yet'}`,
    `Safety notes: ${flags || 'None'}`
  ].join('\n');
}

function buildCurriculumContext(curriculum) {
  if (!curriculum) return 'No app curriculum loaded.';

  const deposit = curriculum.dailyDeposit;
  const depositLines = deposit
    ? [
        'Today\'s Daily Deposit:',
        `Deposit message: ${deposit.body || 'None provided'}`,
        `Today's Focus: ${deposit.focusQuestion || 'None provided'}`,
        `Release date: ${deposit.releaseDate || 'Unknown'}`
      ]
    : ['Today\'s Daily Deposit: Not available.'];

  const plans = asArray(curriculum.performancePlans).slice(0, MAX_CURRICULUM_PLANS);
  const planLines = plans.length
    ? plans.map((plan, index) => {
        const steps = asArray(plan.steps).slice(0, MAX_CURRICULUM_STEPS).join('; ');
        return [
          `Plan ${index + 1}: ${plan.title || 'Untitled'}`,
          `Series: ${plan.seriesTitle || 'Unknown series'}`,
          `Subject: ${plan.subject || 'None provided'}`,
          `Challenge: ${plan.challengeDay || 'Open'}${plan.challengeLength ? ` (${plan.challengeLength} days)` : ''}`,
          `Athlete plan progress: Day ${plan.currentDay || planCurrentDay(plan.releaseDate, plan.challengeLength)} of ${plan.challengeLength || 7}`,
          `Completion status: ${plan.completedAt ? `Completed on ${plan.completedAt}` : 'Not completed yet'}`,
          `Unlock status: ${plan.unlocked === false ? `Locked${plan.unlockDate ? ` until ${plan.unlockDate}` : ''}` : 'Unlocked'}`,
          `Steps: ${steps || 'No steps provided'}`
        ].join('\n');
      })
    : ['Released Performance Plans: None available.'];

  return [...depositLines, '', ...planLines].join('\n');
}

function buildInput({ message, history, athlete, memory, curriculum, sportsContext }) {
  const goals = asArray(athlete?.goals).filter(Boolean);
  const standards = asArray(athlete?.standards).filter(Boolean);
  const context = [
    `Athlete name: ${athlete?.name || 'Unknown'}`,
    `Sport: ${athlete?.sport || 'Unknown'}`,
    `Age: ${athlete?.age || 'Unknown'}`,
    `Location: ${athlete?.location || 'Unknown'}`,
    `Goals: ${goals.slice(0, 5).join('; ') || 'No goals provided'}`,
    `Today’s productivity items: ${standards.slice(0, 6).join('; ') || 'No productivity items provided'}`
  ].join('\n');

  const recentHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_MESSAGES) : [];
  const messages = recentHistory
    .map((entry) => ({
      role: entry.role === 'coach' ? 'assistant' : 'user',
      content: cleanMessage(entry.text, 900)
    }))
    .filter((entry) => entry.content);

  return [
    {
      role: 'developer',
      content: `${coachInstructions}\n\nAthlete context:\n${context}\n\nApp curriculum context:\n${buildCurriculumContext(curriculum)}\n\nCurrent sports context:\n${sportsContext || 'No live sports lookup was needed for this message.'}\n\nPrivate coach growth memory:\n${buildMemoryContext(memory)}`
    },
    ...messages,
    {
      role: 'user',
      content: message
    }
  ];
}

function extractOutputText(response) {
  if (response.output_text) return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  return output
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .map((content) => content.text || '')
    .join('\n')
    .trim();
}

async function verifySupabaseUser(req) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const authHeader = req.headers.authorization || '';

  if (!supabaseUrl || !supabaseAnonKey || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: authHeader
    }
  });

  if (!response.ok) return null;
  return response.json();
}

function supabaseConfig() {
  return {
    url: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  };
}

async function supabaseRequest(path, token, options = {}) {
  const { url, anonKey } = supabaseConfig();
  if (!url || !anonKey || !token) return { data: null, error: 'Missing Supabase config.' };

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    return { data: null, error: await response.text() };
  }

  if (response.status === 204) return { data: null, error: null };
  return { data: await response.json().catch(() => null), error: null };
}

async function getProfile(userId, token) {
  const { data } = await supabaseRequest(
    `profiles?select=id,role,full_name&id=eq.${encodeURIComponent(userId)}`,
    token,
    { method: 'GET' }
  );
  return Array.isArray(data) ? data[0] : null;
}

async function getAthleteContext(userId, token, profile, fallbackAthlete = {}) {
  const [athleteProfileResult, goalsResult, standardsResult] = await Promise.all([
    supabaseRequest(
      `athlete_profiles?select=sport,age,location&user_id=eq.${encodeURIComponent(userId)}`,
      token,
      { method: 'GET' }
    ),
    supabaseRequest(
      `goals?select=label,value,progress&athlete_user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc&limit=5`,
      token,
      { method: 'GET' }
    ),
    supabaseRequest(
      `daily_standards?select=label&athlete_user_id=eq.${encodeURIComponent(userId)}&active=eq.true&order=created_at.asc&limit=6`,
      token,
      { method: 'GET' }
    )
  ]);

  const athleteProfile = Array.isArray(athleteProfileResult.data) ? athleteProfileResult.data[0] : null;
  const goals = Array.isArray(goalsResult.data)
    ? goalsResult.data.map((goal) => `${goal.label}: ${goal.value}${Number.isFinite(Number(goal.progress)) ? ` (${goal.progress}%)` : ''}`)
    : [];
  const standards = Array.isArray(standardsResult.data)
    ? standardsResult.data.map((standard) => standard.label)
    : [];

  return {
    name: profile?.full_name || fallbackAthlete.name || '',
    sport: athleteProfile?.sport || fallbackAthlete.sport || '',
    age: athleteProfile?.age || fallbackAthlete.age || '',
    location: athleteProfile?.location || fallbackAthlete.location || '',
    goals: goals.length ? goals : asArray(fallbackAthlete.goals),
    standards: standards.length ? standards : asArray(fallbackAthlete.standards)
  };
}

function normalizeFallbackCurriculum(fallback = {}) {
  const deposit = fallback.dailyDeposit || fallback.lesson || null;
  const plans = asArray(fallback.performancePlans || fallback.plans);

  return {
    dailyDeposit: deposit
      ? {
          title: cleanMessage(deposit.title, 140),
          body: cleanMessage(deposit.body, 900),
          focusQuestion: cleanMessage(deposit.focusQuestion || deposit.focus_question, 240),
          releaseDate: deposit.releaseDate || deposit.release_date || ''
        }
      : null,
    performancePlans: plans.slice(0, MAX_CURRICULUM_PLANS).map((plan) => ({
      title: cleanMessage(plan.title, 140),
      seriesTitle: cleanMessage(plan.seriesTitle || plan.series_title, 140),
      subject: cleanMessage(plan.subject, 700),
      steps: asArray(plan.steps).map((step) => cleanMessage(step, 240)).filter(Boolean),
      releaseDate: plan.releaseDate || plan.release_date || '',
      challengeDay: cleanMessage(plan.challengeDay || plan.challenge_day, 80),
      challengeLength: Number(plan.challengeLength || plan.challenge_length) || 0,
      currentDay: Number(plan.currentDay || plan.current_day) || planCurrentDay(plan.releaseDate || plan.release_date, plan.challengeLength || plan.challenge_length),
      completedAt: plan.completedAt || plan.completed_at || '',
      unlocked: plan.unlocked !== false,
      unlockDate: plan.unlockDate || plan.unlock_date || ''
    }))
  };
}

async function getCurriculumContext(token, fallbackCurriculum = {}, userId = '') {
  const fallback = normalizeFallbackCurriculum(fallbackCurriculum);
  const today = new Date().toISOString().slice(0, 10);
  const [depositResult, plansResult, planProgressResult] = await Promise.all([
    supabaseRequest(
      `daily_deposits?select=title,body,focus_question,release_date,status&status=eq.posted&release_date=lte.${today}&order=release_date.desc&limit=1`,
      token,
      { method: 'GET' }
    ),
    supabaseRequest(
      `performance_plans?select=id,title,subject,steps,release_date,challenge_day,challenge_length&release_date=lte.${today}&order=release_date.asc&limit=${MAX_CURRICULUM_PLANS}`,
      token,
      { method: 'GET' }
    ),
    userId
      ? supabaseRequest(
          `performance_plan_progress?select=plan_id,completed_at&athlete_user_id=eq.${encodeURIComponent(userId)}`,
          token,
          { method: 'GET' }
        )
      : Promise.resolve({ data: [], error: null })
  ]);

  const deposit = Array.isArray(depositResult.data) ? depositResult.data[0] : null;
  const plans = Array.isArray(plansResult.data) ? plansResult.data : [];
  const progressByPlanId = new Map(
    (Array.isArray(planProgressResult.data) ? planProgressResult.data : [])
      .map((entry) => [String(entry.plan_id), entry.completed_at || ''])
  );

  return {
    dailyDeposit: deposit
      ? {
          title: cleanMessage(deposit.title, 140),
          body: cleanMessage(deposit.body, 900),
          focusQuestion: cleanMessage(deposit.focus_question, 240),
          releaseDate: deposit.release_date || ''
        }
      : fallback.dailyDeposit,
    performancePlans: plans.map((plan) => ({
      title: cleanMessage(plan.title, 140),
      seriesTitle: cleanMessage(seriesTitleFromSubject(plan.subject), 140),
      subject: cleanMessage(plan.subject, 700),
      steps: asArray(plan.steps).map((step) => cleanMessage(step, 240)).filter(Boolean),
      releaseDate: plan.release_date || '',
      challengeDay: cleanMessage(plan.challenge_day, 80),
      challengeLength: Number(plan.challenge_length) || 0,
      currentDay: planCurrentDay(plan.release_date, plan.challenge_length),
      completedAt: progressByPlanId.get(String(plan.id)) || '',
      unlocked: true,
      unlockDate: ''
    })).concat(plans.length ? [] : fallback.performancePlans)
  };
}

function seriesTitleFromSubject(subject) {
  const match = String(subject ?? '').match(/Series:\s*([^.!]+)[.!]?/i);
  return match?.[1]?.trim() || 'Performance Plans';
}

async function createAthleteProfile(user, token) {
  const fullName = cleanMessage(user.user_metadata?.full_name || user.email || 'Athlete', 120);
  const { data, error } = await supabaseRequest('profiles', token, {
    method: 'POST',
    body: JSON.stringify({
      id: user.id,
      role: 'athlete',
      full_name: fullName
    })
  });

  if (error) return null;
  return Array.isArray(data) ? data[0] : { id: user.id, role: 'athlete', full_name: fullName };
}

async function getCoachMemory(userId, token) {
  const { data } = await supabaseRequest(
    `coach_memories?select=summary,patterns,growth_markers,next_focus,safety_flags&athlete_user_id=eq.${encodeURIComponent(userId)}`,
    token,
    { method: 'GET' }
  );
  return Array.isArray(data) ? data[0] : null;
}

async function reserveCoachMessage(token) {
  const { data, error } = await supabaseRequest('rpc/reserve_coach_message', token, {
    method: 'POST',
    body: JSON.stringify({ p_limit: DAILY_COACH_MESSAGE_LIMIT })
  });
  if (error) return { allowed: false, error };
  const usage = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(usage?.allowed),
    messageCount: Number(usage?.message_count ?? 0),
    messageLimit: Number(usage?.message_limit ?? DAILY_COACH_MESSAGE_LIMIT)
  };
}

async function saveCoachSession({ userId, token, sessionId, title, messages, safety }) {
  if (!sessionId) return;
  const now = new Date();
  await supabaseRequest('coach_sessions?on_conflict=id', token, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: String(sessionId),
      athlete_user_id: userId,
      title: cleanMessage(title, 120) || 'Coach conversation',
      session_date: now.toISOString().slice(0, 10),
      session_time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      messages: cleanMessages(messages),
      safety: safety || 'ok',
      updated_at: now.toISOString()
    })
  });
}

async function updateCoachMemory({ apiKey, model, userId, token, previousMemory, athleteMessage, coachMessage, safety }) {
  if (safety !== 'ok') return;

  const memoryPrompt = `
Update this private athlete coach memory after one new exchange.

Rules:
- Keep it concise and useful for future mental performance coaching.
- Track patterns, growth, recurring friction points, and next focus.
- Do not include medical diagnosis, protected traits, gossip, or unnecessary sensitive details.
- Do not store exact raw messages.
- Return only valid JSON with keys: summary, patterns, growth_markers, next_focus, safety_flags.

Previous memory:
${JSON.stringify(previousMemory ?? {})}

New athlete message:
${athleteMessage}

Coach response:
${coachMessage}
`.trim();

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'developer',
          content: 'You update private memory for a youth sports mental performance coach. Output strict JSON only.'
        },
        {
          role: 'user',
          content: memoryPrompt
        }
      ],
      max_output_tokens: 350
    })
  });

  if (!response.ok) return;
  const data = await response.json();
  const text = extractOutputText(data);
  const nextMemory = safeJsonParse(text, null);
  if (!nextMemory || typeof nextMemory !== 'object') return;

  await supabaseRequest('coach_memories?on_conflict=athlete_user_id', token, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      athlete_user_id: userId,
      summary: cleanMessage(nextMemory.summary, 700),
      patterns: asArray(nextMemory.patterns).slice(0, MAX_MEMORY_ITEMS),
      growth_markers: asArray(nextMemory.growth_markers).slice(0, MAX_MEMORY_ITEMS),
      next_focus: cleanMessage(nextMemory.next_focus, 280),
      safety_flags: asArray(nextMemory.safety_flags).slice(0, MAX_MEMORY_ITEMS),
      updated_at: new Date().toISOString()
    })
  });
}

async function moderate(message, apiKey) {
  const response = await fetch(OPENAI_MODERATION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'omni-moderation-latest',
      input: message
    })
  });

  if (!response.ok) return { unavailable: true };
  const data = await response.json();
  return data.results?.[0] ?? { unavailable: true };
}

function shouldBlockModeration(result) {
  if (!result || result.unavailable) return false;
  const categories = result.categories ?? {};
  return Boolean(
    categories['sexual/minors'] ||
      categories['self-harm/instructions'] ||
      categories['violence/graphic'] ||
      categories['illicit/violent'] ||
      categories['hate/threatening'] ||
      categories['harassment/threatening']
  );
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    await logAppEvent({
      area: 'coach',
      eventType: 'openai_key_missing',
      severity: 'error'
    });
    return json(res, 501, { error: 'Coach backend is missing OPENAI_API_KEY.' });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: 'Invalid request body.' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  const user = await verifySupabaseUser(req);
  if (!user) {
    await logAppEvent({
      area: 'coach',
      eventType: 'unauthorized_request',
      severity: 'warning'
    });
    return json(res, 401, { error: 'Sign in again before using My Mindset Coach.' });
  }

  let profile = await getProfile(user.id, token);
  const metadataRole = user.user_metadata?.role || user.app_metadata?.role;
  if (!profile && metadataRole === 'athlete') {
    profile = await createAthleteProfile(user, token);
  }
  const role = profile?.role || metadataRole;
  if (role !== 'athlete') {
    await logAppEvent({
      area: 'coach',
      eventType: 'non_athlete_blocked',
      severity: 'warning',
      userId: user.id,
      metadata: { role: role || 'unknown' }
    });
    return json(res, 403, { error: 'My Mindset Coach is private to athlete accounts.' });
  }

  const message = cleanMessage(body.message);
  if (!message) {
    return json(res, 400, { error: 'Message is required.' });
  }

  if (message.length > MAX_MESSAGE_LENGTH - 1) {
    return json(res, 400, { error: 'Message is too long. Keep it under 1,200 characters.' });
  }

  if (crisisPattern.test(message)) {
    const reply = crisisResponse();
    await saveCoachSession({
      userId: user.id,
      token,
      sessionId: body.sessionId,
      title: body.sessionTitle || message,
      messages: [...cleanMessages(body.history), { role: 'coach', text: reply }],
      safety: 'crisis'
    });
    await logAppEvent({
      area: 'coach',
      eventType: 'crisis_response',
      severity: 'critical',
      userId: user.id
    });
    return json(res, 200, { reply, safety: 'crisis' });
  }

  const moderation = await moderate(message, apiKey);
  if (moderation.categories?.['self-harm'] || moderation.categories?.['self-harm/intent']) {
    const reply = crisisResponse();
    await saveCoachSession({
      userId: user.id,
      token,
      sessionId: body.sessionId,
      title: body.sessionTitle || message,
      messages: [...cleanMessages(body.history), { role: 'coach', text: reply }],
      safety: 'crisis'
    });
    await logAppEvent({
      area: 'coach',
      eventType: 'moderation_crisis_response',
      severity: 'critical',
      userId: user.id
    });
    return json(res, 200, { reply, safety: 'crisis' });
  }
  if (shouldBlockModeration(moderation)) {
    const reply = blockedResponse();
    await saveCoachSession({
      userId: user.id,
      token,
      sessionId: body.sessionId,
      title: body.sessionTitle || message,
      messages: [...cleanMessages(body.history), { role: 'coach', text: reply }],
      safety: 'blocked'
    });
    await logAppEvent({
      area: 'coach',
      eventType: 'moderation_blocked',
      severity: 'warning',
      userId: user.id
    });
    return json(res, 200, { reply, safety: 'blocked' });
  }

  const usage = await reserveCoachMessage(token);
  if (!usage.allowed) {
    const limit = usage.messageLimit || DAILY_COACH_MESSAGE_LIMIT;
    await logAppEvent({
      area: 'coach',
      eventType: 'daily_limit_hit',
      severity: 'info',
      userId: user.id,
      metadata: { messageCount: usage.messageCount || limit, messageLimit: limit }
    });
    return json(res, 429, {
      error: limitResponse(limit),
      code: 'coach_daily_limit',
      messageCount: usage.messageCount || limit,
      messageLimit: limit
    });
  }

  const [athleteContext, curriculumContext, sportsContext] = await Promise.all([
    getAthleteContext(user.id, token, profile, body.athlete),
    getCurriculumContext(token, body.curriculum, user.id),
    getSportsContext(message)
  ]);

  if (!isCurriculumQuestion(message) && needsClarifyingQuestion(message, body.history)) {
    const reply = clarifyingResponse(message, athleteContext);
    await saveCoachSession({
      userId: user.id,
      token,
      sessionId: body.sessionId,
      title: body.sessionTitle || message,
      messages: [...cleanMessages(body.history), { role: 'coach', text: reply }],
      safety: 'ok'
    });
    return json(res, 200, {
      reply,
      safety: 'ok',
      mode: 'clarify',
      messageCount: usage.messageCount,
      messageLimit: usage.messageLimit
    });
  }

  const model = process.env.OPENAI_COACH_MODEL || 'gpt-4.1-mini';
  const memory = await getCoachMemory(user.id, token);
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: buildInput({
        message,
        history: body.history,
        athlete: athleteContext,
        memory,
        curriculum: curriculumContext,
        sportsContext
      }),
      max_output_tokens: 450
    })
  });

  if (!response.ok) {
    await logAppEvent({
      area: 'coach',
      eventType: 'model_request_failed',
      severity: 'error',
      userId: user.id,
      metadata: { status: response.status, model }
    });
    return json(res, 502, { error: 'Coach model request failed.' });
  }

  const data = await response.json();
  const reply = displayCoachText(extractOutputText(data));
  if (!reply) {
    await logAppEvent({
      area: 'coach',
      eventType: 'empty_model_response',
      severity: 'error',
      userId: user.id,
      metadata: { model }
    });
    return json(res, 502, { error: 'Coach model returned an empty response.' });
  }

  const savedMessages = [...cleanMessages(body.history), { role: 'coach', text: reply }];
  await saveCoachSession({
    userId: user.id,
    token,
    sessionId: body.sessionId,
    title: body.sessionTitle || message,
    messages: savedMessages,
    safety: 'ok'
  });
  await updateCoachMemory({
    apiKey,
    model,
    userId: user.id,
    token,
    previousMemory: memory,
    athleteMessage: message,
    coachMessage: reply,
    safety: 'ok'
  });

  return json(res, 200, {
    reply,
    safety: 'ok',
    model,
    messageCount: usage.messageCount,
    messageLimit: usage.messageLimit
  });
}
