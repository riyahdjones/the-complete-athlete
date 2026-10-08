import { logAppEvent } from '../server/monitoring.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_MODERATION_URL = 'https://api.openai.com/v1/moderations';
const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
const allowedAudioMimeTypes = new Map([
  ['audio/webm', 'webm'],
  ['audio/mp4', 'mp4'],
  ['audio/mpeg', 'mp3'],
  ['audio/mp3', 'mp3'],
  ['audio/ogg', 'ogg'],
  ['audio/wav', 'wav'],
  ['audio/x-m4a', 'm4a']
]);
const MAX_MESSAGE_LENGTH = 1200;
const MAX_HISTORY_MESSAGES = 12;
const MAX_MEMORY_ITEMS = 8;
const MAX_CURRICULUM_PLANS = 18;
const MAX_CURRICULUM_STEPS = 10;
const DAILY_COACH_MESSAGE_LIMIT = 5;
const SPORTS_FETCH_TIMEOUT_MS = 3500;
const SPORTS_MAX_EVENTS_PER_LEAGUE = 6;
const SPORTS_MAX_NEWS_PER_LEAGUE = 5;
const SPORTS_MAX_SEARCH_PLAYERS = 4;
const SPORTS_MAX_SEARCH_ARTICLES = 5;
const SPORTS_TEAM_CACHE_TTL_MS = 1000 * 60 * 60 * 12;

const quickStartGuidance = {
  Confidence: 'Find when confidence drops and what the athlete starts believing in that moment.',
  Pressure: 'Explore what specifically feels at stake in the upcoming event. Do not ask what happened most recently.',
  Mistakes: 'Explore the actual mistake and the athlete’s immediate self-talk or next-play response.',
  Coaching: 'Explore what the coach said or did and how the athlete interpreted it.',
  Burnout: 'Explore duration and whether training load, pressure, results, or life outside the sport is draining them.',
  Focus: 'Identify the recurring thought or trigger that pulls attention away from the next play.',
  'Playing time': 'Explore what the athlete has been told about their role and what meaning they attach to it.',
  Motivation: 'Distinguish physical tiredness, discouragement, unclear purpose, and avoidance without accusing the athlete.',
  'Game day': 'This is future-facing. Explore what feels least settled about the upcoming competition and what “locked in” would look like.',
  Team: 'Explore the specific interaction and the outcome the athlete wants from handling it well.',
  Comparison: 'Explore who or what triggers comparison and what the athlete believes being behind means.',
  'After the game': 'Explore the moment, result, or self-judgment that is still sticking with the athlete.'
};

const quickStartFallbackQuestions = {
  Confidence: 'When do you notice your confidence slipping most—before the moment, after a mistake, or when you start comparing yourself?',
  Pressure: 'What part of tomorrow feels heaviest right now: the result, making a mistake, or what other people may think?',
  Mistakes: 'Take me to the mistake. What happened—and what did you start telling yourself right after it?',
  Coaching: 'What did your coach say or do, and what part of it is getting to you most?',
  Burnout: 'How long have you felt this drained, and is it the training, the pressure, or everything around the sport that feels heaviest?',
  Focus: 'When the overthinking starts, what thought keeps pulling you away from the next play?',
  'Playing time': 'What have you been told about your role, and what are you afraid your playing time says about you?',
  Motivation: 'Is the motivation missing because you are tired, discouraged by your progress, or disconnected from what you are working toward?',
  'Game day': 'What feels least settled about the game right now—your nerves, confidence, focus, or knowing what to expect?',
  Team: 'What happened with your teammate, and what outcome do you want from the way you handle it?',
  Comparison: 'Who or what are you comparing yourself to, and what does being “behind” mean to you right now?',
  'After the game': 'What part of the game is sticking with you most: one moment, the result, or how you felt about your performance?'
};

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
- Treat context in this order: current athlete message, current conversation, relevant long-term memory, then general knowledge. What the athlete says now always wins.
- Use only context that genuinely helps with the current issue. Never recite the athlete's profile, app activity, or memory to prove that you know it.
- Never invent a past conversation, struggle, result, goal, routine, injury, emotion, or commitment. If a remembered detail is uncertain, ask instead of implying certainty.
- Reference prior conversations sparingly and naturally. Never mention database fields, stored profiles, exact timestamps, or the mechanics of memory.
- Do not assume today's issue has the same cause as a previous issue. Ask what happened now; connect a prior pattern only after the athlete confirms the same pattern is present.
- A recurring pattern requires evidence from multiple distinct moments. Never label an athlete permanently from one event. Describe patterns as changeable behaviors, not identities.
- Prefer strategies the athlete has said worked before. Do not keep recommending a technique the athlete has said does not help.
- When sport and position are known, use a small amount of relevant sport language. Do not force terminology or turn every answer into a sport analogy.
- Use the app curriculum context when the athlete asks about the Daily Deposit, Today's Focus, or Performance Plans. Explain the idea in plain athlete language and help them apply it to their sport or day.
- When answering about a Performance Plan, mention the athlete's current plan day when available, such as "Day 1 of 7," and anchor the advice to that day's steps.
- If a Performance Plan is locked, explain that it unlocks after the prior plan is completed and the next day arrives. Do not give locked-plan steps as if they are available today.
- Do not claim the athlete completed a deposit, plan, goal, productivity item, or reflection unless the provided data says so.
- When the athlete asks about professional sports scores, schedules, standings, teams, player stats, rosters, injuries, trades, draft news, or headlines in MLB, MLS, NBA, or NFL, use the provided live sports encyclopedia context. If live sports context is not available or does not answer the question, say that you cannot verify that update from inside the app right now instead of guessing.
- For sports questions, answer directly inside the chat from the provided context. Do not send athletes to ESPN, MLB, NBA, NFL, MLS, another app, or another website.
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
- Default to discovery before advice. For a new personal coaching topic, ask one short, focused question and wait. Ask a second question on the next turn only when the root issue is still unclear; do not interrogate once the athlete has made the real pressure or meaning clear.
- The first question should establish the specific recent moment. When needed, the second should go one layer deeper into the athlete's thought, feeling, response, or desired change. Do not repeat the first question in different words or attach advice to a discovery question.
- Do not assume the problem or deliver a speech from one short message. Reflect only what the athlete actually said.
- Once the problem is clear, give one honest observation, one practical move, and one question or small action for today.
- Default to 2-3 short sentences and no more than 65 words. A discovery question should be one or two brief sentences and under 35 words.
- Only exceed 65 words when safety support or a factual sports answer truly requires it.
- Never start with "One clear truth" or use labels like "Reflection," "Action step," "Cue ideas," or "Do this right now."
- Do not use markdown formatting, asterisks, bold marks, headings, rigid formats, numbered lists, repeated slogans, hashtags, or clinical language.
- End after the useful point. Do not repeat the same idea in different words.
- Do not treat every message as a request for a solution. Curiosity is often the right first response.
- Coach the root issue, not only the athlete's opening statement. Use short questions to uncover what the result, mistake, role, criticism, pressure, or comparison means to them.
- Do not try to finish an entire coaching session in one reply. Once the real issue is clear, say so naturally, reframe it, offer one strategy, and give one immediate action.
- App features are tools, not promotions. Mention a goal, plan, journal, Game Day Mode, activity streak, or journey only when it directly improves the coaching moment.

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

function crisisResponse(language = 'en') {
  if (language === 'es') {
    return 'Tu seguridad importa más que el rendimiento en este momento. Díselo de inmediato a un adulto de confianza: tu padre, madre, tutor, entrenador, consejero escolar u otro adulto cercano. Si crees que podrías hacerte daño o dañar a otra persona, llama ahora a los servicios de emergencia. En Estados Unidos o Canadá, llama o envía un mensaje de texto al 988. Aléjate de cualquier cosa que pudiera hacerte daño, acércate a otra persona y di en voz alta: “Necesito ayuda ahora mismo.”';
  }
  return [
    'Your safety matters more than performance right now.',
    'Please tell a trusted adult immediately: a parent, guardian, coach, school counselor, or another adult near you. If you might hurt yourself or someone else, call emergency services now. In the U.S. or Canada, call or text 988 for crisis support.',
    'For this moment: move away from anything you could use to hurt yourself, get near another person, and say out loud, “I need help right now.”'
  ].join(' ');
}

function blockedResponse(language = 'en') {
  if (language === 'es') {
    return 'Puedo ayudarte a recuperarte y elegir una mejor respuesta, pero no puedo ayudar con daño, amenazas, contenido sexual ni nada inseguro. Habla con un adulto de confianza si alguien pudiera salir herido. Si se trata de presión competitiva, cuéntame el momento deportivo y la respuesta que quieres entrenar.';
  }
  return [
    'I can help you reset and choose a better response, but I cannot help with harm, threats, sexual content, or anything unsafe.',
    'Bring this to a trusted adult if someone could get hurt. If this is about competition pressure, tell me the sport moment and what response you want to train.'
  ].join(' ');
}

function limitResponse(limit, language = 'en') {
  if (language === 'es') {
    return `Ya usaste tus ${limit} mensajes con el coach de hoy. Vuelve mañana y continuaremos desde aquí. Por ahora, escribe el momento real, la respuesta que quieres entrenar y una acción que todavía puedes controlar hoy.`;
  }
  return [
    `You have used your ${limit} coach messages for today.`,
    'Come back tomorrow and we will keep working from here. For now, write down the real moment, the response you want to train, and one action you can still control today.'
  ].join(' ');
}

function needsClarifyingQuestion(message, history) {
  const words = message.split(/\s+/).filter(Boolean);
  const recentAthleteTurns = cleanMessages(history).filter((entry) => entry.role === 'athlete').length;
  if (isCasualCheckIn(message)) return false;
  if (recentAthleteTurns <= 1) return true;
  if (recentAthleteTurns >= 3) return false;
  const rootClues = /\b(i think|i feel|i felt|i tell myself|i told myself|i'm afraid|i am afraid|because|means that|worried that|scared that|i wish|i want to change|next time)\b/i;
  return words.length < 14 || !rootClues.test(message);
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
  return /\b(score|scores|scored|schedule|game|games|playoff|standings|rankings|record|injury report|injured|injury|trade|traded|draft|news|headline|today|tonight|last night|yesterday|tomorrow|latest|current|live|who won|winning|lost|beat|stats|stat|player|roster|contract|mvp|award|points|rebounds|assists|yards|touchdown|touchdowns|interception|interceptions|sacks|batting|home run|home runs|homer|rbi|era|ops|goals|saves)\b/i.test(lower);
}

function hasSportsKnowledgeIntent(message) {
  const lower = String(message ?? '').toLowerCase();
  const knowledgeTerms =
    /\b(nba|nfl|mlb|mls|espn|score|scores|schedule|standings|record|news|headline|trade|draft|injury|injured|stats|stat|player|team|roster|contract|mvp|award|points|rebounds|assists|yards|touchdown|touchdowns|interception|interceptions|sacks|batting|home run|home runs|homer|rbi|era|ops|goals|saves|who won|last night|yesterday|today|tonight|latest|current)\b/i;
  const playerLikeQuestion =
    /\b(how many|what did|what is|what are|who is|tell me about|give me|show me)\b/i.test(lower) &&
    /\b(points|stats|stat|news|team|play for|injury|injured|trade|contract|record|score|scored|goals|yards|home runs|rbi|assists|rebounds|touchdowns)\b/i.test(lower);

  return knowledgeTerms.test(lower) || playerLikeQuestion;
}

function messageMentionsAlias(message, aliases) {
  const normalizedMessage = normalizeSportsText(message);
  return asArray(aliases).some((alias) => {
    const normalizedAlias = normalizeSportsText(alias).trim();
    return normalizedAlias && normalizedMessage.includes(` ${normalizedAlias} `);
  });
}

function competitorAliases(competitor) {
  const team = competitor?.team || {};
  return [
    team.displayName,
    team.shortDisplayName,
    team.name,
    team.nickname,
    team.abbreviation,
    team.location
  ].filter(Boolean);
}

function eventMatchesMessageTeam(event, message) {
  const competition = asArray(event?.competitions)[0] || {};
  const competitors = asArray(competition.competitors);
  return competitors.some((competitor) => messageMentionsAlias(message, competitorAliases(competitor)));
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

function summarizeScoreboard(data, leagueLabel, message) {
  const allEvents = asArray(data?.events);
  const teamEvents = allEvents.filter((event) => eventMatchesMessageTeam(event, message));
  const events = (teamEvents.length ? teamEvents : allEvents).slice(0, SPORTS_MAX_EVENTS_PER_LEAGUE);
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

function leagueFromSearchContent(content) {
  const text = `${content?.description || ''} ${content?.subtitle || ''} ${content?.displayName || ''}`.toLowerCase();
  if (text.includes('nba')) return sportsLeagues.nba;
  if (text.includes('nfl')) return sportsLeagues.nfl;
  if (text.includes('mlb')) return sportsLeagues.mlb;
  if (text.includes('mls')) return sportsLeagues.mls;
  return null;
}

function athleteIdFromSearchContent(content) {
  const uid = String(content?.uid || '');
  const match = uid.match(/~a:(\d+)/);
  return match?.[1] || String(content?.id || '').replace(/\D/g, '');
}

function summarizeAthleteStats(statsData, leagueLabel) {
  const categories = asArray(statsData?.splits?.categories);
  const stats = categories.flatMap((category) => asArray(category.stats));
  const wantedNamesByLeague = {
    NBA: ['avgPoints', 'avgRebounds', 'avgAssists', 'points', 'rebounds', 'assists', 'fieldGoalPct', 'threePointPct', 'freeThrowPct', 'steals', 'blocks'],
    NFL: ['passingYards', 'passingTouchdowns', 'interceptions', 'rushingYards', 'rushingTouchdowns', 'receivingYards', 'receivingTouchdowns', 'totalTackles', 'sacks'],
    MLB: ['battingAverage', 'homeRuns', 'RBIs', 'ops', 'earnedRunAverage', 'strikeouts', 'wins', 'saves'],
    MLS: ['totalGoals', 'goalAssists', 'shotsTotal', 'shotsOnTarget', 'saves', 'goalsAgainst']
  };
  const wantedNames = wantedNamesByLeague[leagueLabel] || [];
  const selected = wantedNames
    .map((name) => stats.find((stat) => stat.name === name))
    .filter(Boolean);
  const fallback = selected.length ? selected : stats
    .filter((stat) => stat.abbreviation && stat.displayValue && Number(stat.value || 0) !== 0)
    .slice(0, 10);

  return fallback
    .slice(0, 10)
    .map((stat) => `${stat.abbreviation}: ${stat.displayValue}`)
    .join(', ');
}

async function summarizeSearchPlayer(content) {
  const league = leagueFromSearchContent(content);
  const athleteId = athleteIdFromSearchContent(content);
  const name = cleanMessage(content?.displayName || content?.name, 100);
  const subtitle = cleanMessage(content?.subtitle || content?.description, 120);
  if (!name) return '';

  let statLine = '';
  if (league && athleteId) {
    const statsUrl = `https://sports.core.api.espn.com/v2/sports/${league.sport}/leagues/${league.league}/athletes/${athleteId}/statistics?lang=en&region=us`;
    const statsData = await fetchJsonWithTimeout(statsUrl, SPORTS_FETCH_TIMEOUT_MS);
    statLine = summarizeAthleteStats(statsData, league.label);
  }

  return `Player result from ESPN: ${name}${subtitle ? ` (${subtitle})` : ''}${statLine ? `. Stats snapshot: ${statLine}` : ''}`;
}

function summarizeSearchArticle(content) {
  const headline = cleanMessage(content?.headline || content?.title || content?.displayName, 180);
  const description = cleanMessage(content?.description || content?.summary, 220);
  const source = cleanMessage(content?.source || content?.provider || 'ESPN', 40);
  if (!headline) return '';
  return `Article result from ${source}: ${headline}${description ? ` - ${description}` : ''}`;
}

function sportsSearchQuery(message) {
  const cleaned = String(message ?? '')
    .replace(/\b(give me|show me|tell me about|what are|what is|who is|can you|please|in the app|inside the app|latest|current|stats?|statistics|news|headlines?|score|scores|schedule|standings|record|injury|injured|trade|traded|draft|player|team|and|nba|nfl|mlb|mls)\b/gi, ' ')
    .replace(/[?.!,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleanMessage(cleaned || message, 140);
}

async function getSportsSearchContext(message) {
  if (!hasSportsKnowledgeIntent(message)) return '';

  const query = encodeURIComponent(sportsSearchQuery(message));
  const data = await fetchJsonWithTimeout(
    `https://site.web.api.espn.com/apis/search/v2?region=us&lang=en&limit=8&query=${query}`,
    SPORTS_FETCH_TIMEOUT_MS
  );
  const results = asArray(data?.results);
  const players = results.find((result) => result.type === 'player');
  const articles = results.find((result) => result.type === 'article');

  const playerLines = await Promise.all(
    asArray(players?.contents).slice(0, SPORTS_MAX_SEARCH_PLAYERS).map(summarizeSearchPlayer)
  );
  const articleLines = asArray(articles?.contents)
    .slice(0, SPORTS_MAX_SEARCH_ARTICLES)
    .map(summarizeSearchArticle);
  const lines = [...playerLines, ...articleLines].filter(Boolean);

  if (!lines.length) return '';
  return ['Sports encyclopedia search source: ESPN public search and stats data.', ...lines].join('\n');
}

async function getSportsContext(message) {
  if (!hasSportsKnowledgeIntent(message)) return '';

  const keys = hasSportsCurrentIntent(message) ? (await requestedSportsLeagues(message)).slice(0, 4) : [];
  const dates = sportsDateParams(message);
  const [searchContext, ...leagueSections] = await Promise.all([
    getSportsSearchContext(message),
    ...keys.map(async (key) => {
    const league = sportsLeagues[key];
    if (!league) return '';

    const baseUrl = `https://site.api.espn.com/apis/site/v2/sports/${league.sport}/${league.league}`;
    const scoreboardUrl = `${baseUrl}/scoreboard?dates=${dates.join(',')}`;
    const [scoreboard, news] = await Promise.all([
      fetchJsonWithTimeout(scoreboardUrl),
      fetchJsonWithTimeout(`${baseUrl}/news`)
    ]);
    const lines = [
      ...summarizeScoreboard(scoreboard, league.label, message),
      ...summarizeNews(news, league.label)
    ];

    return [`${league.label} live context source: ESPN public sports data.`, ...lines].join('\n');
    })
  ]);

  const context = [searchContext, ...leagueSections].filter(Boolean).join('\n\n');
  return context || 'Live sports lookup was requested, but no current sports data returned.';
}

function isCasualCheckIn(message) {
  return /^(yo+|hey+|hi+|hello+|sup|what'?s up|you there|are you there|u there|can you help|help me|coach|mindset coach)[\s?.!]*$/i.test(message);
}

function clarifyingResponse(message, athlete, history = [], language = 'en') {
  const athleteTurnCount = cleanMessages(history).filter((entry) => entry.role === 'athlete').length;
  if (language === 'es') {
    const lower = message.toLowerCase();
    const firstName = cleanMessage(athlete?.name, 60).split(/\s+/)[0];
    const namePhrase = firstName && firstName !== 'Athlete' && firstName !== 'Unknown' ? `, ${firstName}` : '';
    if (isCasualCheckIn(message)) return `Estoy aquí${namePhrase}. ¿Qué está pasando hoy?`;
    if (/^(necesito ayuda|ayúdame|puedes ayudarme|no sé qué hacer)[\s?.!]*$/i.test(message)) return `Estoy aquí${namePhrase}. ¿Qué está pasando ahora mismo?`;
    if (athleteTurnCount >= 2) {
      if (/coach|entrenador|feedback|correcci[oó]n/.test(lower)) return 'Cuando recibes esa corrección, ¿qué te dices por dentro y qué cambia en tu siguiente jugada?';
      if (/playing time|banca|titular|jugar|rol/.test(lower)) return 'Cuando piensas en tu rol, ¿qué temes que signifique sobre ti como atleta?';
      if (/teammate|equipo|compañer/.test(lower)) return '¿Qué parte te afecta más: lo que pasó, lo que crees que significa o no saber cómo responder?';
      return 'En ese momento, ¿qué notaste primero: tus pensamientos, tus emociones, tu cuerpo o tu enfoque?';
    }
    if (/coach|entrenador|feedback|correcci[oó]n/.test(lower)) return 'Estoy contigo. ¿Qué te dijo o hizo tu entrenador recientemente y cómo respondiste en ese momento?';
    if (/playing time|banca|titular|jugar|rol/.test(lower)) return 'Te escucho. ¿Qué te ha dicho tu entrenador sobre tu rol y qué parte de eso es la más difícil ahora?';
    if (/teammate|equipo|compañer/.test(lower)) return 'Estoy contigo. ¿Qué pasó recientemente con tu compañero o equipo y qué quieres manejar de otra manera?';
    return 'Estoy contigo. ¿Qué pasó?';
  }
  if (isCasualCheckIn(message)) {
    const firstName = cleanMessage(athlete?.name, 60).split(/\s+/)[0];
    const namePhrase = firstName && firstName !== 'Athlete' && firstName !== 'Unknown' ? `, ${firstName}` : '';
    return `I'm here${namePhrase}. What's going on today?`;
  }

  const lower = message.toLowerCase();
  const firstName = cleanMessage(athlete?.name, 60).split(/\s+/)[0];
  const namePhrase = firstName && firstName !== 'Athlete' && firstName !== 'Unknown' ? `, ${firstName}` : '';
  const sport = cleanMessage(athlete?.sport, 40);
  const sportPhrase = sport && sport !== 'Unknown' ? ` in ${sport}` : '';

  if (/^(i need help|need help|help me|can you help me|i don'?t know what to do)[\s?.!]*$/i.test(message)) {
    return `I'm here${namePhrase}. What's going on right now?`;
  }

  if (athleteTurnCount >= 2) {
    if (/\bcoach|feedback|correction\b/.test(lower)) {
      return 'When that correction comes, what do you tell yourself—and what changes on your very next play?';
    }
    if (/\bplaying time|bench|starter|starting|role\b/.test(lower)) {
      return 'When you think about your role, what are you afraid it says about you as an athlete?';
    }
    if (/\bteammate|team|locker room\b/.test(lower)) {
      return 'What is affecting you most: what happened, what you think it means, or not knowing how to respond?';
    }
    if (/\bconfidence|pressure|overthink|nervous|fear|mistake|messing up|slump|focus\b/.test(lower)) {
      return 'In that moment, what shows up first: your self-talk, your body language, or your focus leaving the next play?';
    }
    return 'What part of that moment is hardest for you internally, and what do you wish you could change?';
  }

  if (/\bcoach|feedback|correction\b/.test(lower)) {
    return "I'm with you. What did your coach say or do most recently, and how did you respond in that moment?";
  }
  if (/\bplaying time|bench|starter|starting\b/.test(lower)) {
    return "I hear you. What has your coach told you about your role, and what part of that is hardest for you right now?";
  }
  if (/\bteammate|team|locker room\b/.test(lower)) {
    return "I'm with you. What happened with your teammate or team most recently, and what do you want to handle differently?";
  }
  if (/\bconfidence|pressure|overthink|nervous|fear|mistake|messing up|slump\b/.test(lower) || athleteTurnCount > 0) {
    return 'I’m with you. What happened most recently?';
  }

  return `I'm with you. Is this mainly about confidence, pressure, a coach, teammates, playing time, focus${sportPhrase ? `, or something happening in ${sport}` : ', or something outside your sport'}?`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeJsonParse(value, fallback) {
  try {
    const normalized = String(value ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    return JSON.parse(normalized);
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

function historyBeforeCurrentMessage(history, message) {
  const cleaned = cleanMessages(history);
  const last = cleaned[cleaned.length - 1];
  if (last?.role === 'athlete' && last.text === cleanMessage(message, 1000)) return cleaned.slice(0, -1);
  return cleaned;
}

const contextStopWords = new Set([
  'about', 'after', 'again', 'also', 'and', 'athlete', 'because', 'before', 'coach', 'could', 'from',
  'have', 'help', 'into', 'just', 'like', 'more', 'need', 'really', 'that', 'their', 'them', 'then',
  'there', 'they', 'this', 'today', 'want', 'what', 'when', 'where', 'with', 'would', 'your'
]);

function contextTokens(value) {
  return new Set(String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 3 && !contextStopWords.has(token)));
}

function memoryItemText(item) {
  if (typeof item === 'string') return cleanMessage(item, 280);
  if (!item || typeof item !== 'object') return '';
  return cleanMessage(item.pattern || item.detail || item.strategy || item.cue || item.routine || item.commitment || item.text, 280);
}

function memoryEvidenceCount(item) {
  if (!item || typeof item !== 'object') return 1;
  return Math.max(1, Number(item.evidence_count || item.evidenceCount || 1));
}

function relevantMemoryItems(items, conversationText, limit = 3) {
  const queryTokens = contextTokens(conversationText);
  if (!queryTokens.size) return [];
  return asArray(items)
    .map((item) => {
      const text = memoryItemText(item);
      const searchable = item && typeof item === 'object' ? `${text} ${JSON.stringify(item.contexts || item.tags || [])}` : text;
      const tokens = contextTokens(searchable);
      const score = [...tokens].reduce((total, token) => total + (queryTokens.has(token) ? 1 : 0), 0);
      return { item, text, score };
    })
    .filter((entry) => entry.text && entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function buildMemoryContext(memory, message, history = [], athlete = {}) {
  if (!memory) return 'No relevant long-term coach memory is available.';
  const conversationText = [
    ...historyBeforeCurrentMessage(history, message).slice(-6).map((entry) => entry.text),
    message,
    athlete?.sport,
    athlete?.position
  ].join(' ');
  const lines = [];
  const summaryMatches = relevantMemoryItems([memory.summary], conversationText, 1);
  const patternMatches = relevantMemoryItems(memory.patterns, conversationText, 3);
  const growthMatches = relevantMemoryItems(memory.growth_markers, conversationText, 2);
  const workedMatches = relevantMemoryItems(memory.strategies_worked, conversationText, 3);
  const didNotWorkMatches = relevantMemoryItems(memory.strategies_not_worked, conversationText, 3);
  const cueMatches = relevantMemoryItems(memory.reset_cues, conversationText, 3);
  const routineMatches = relevantMemoryItems(memory.routines, conversationText, 2);
  const commitmentMatches = relevantMemoryItems(memory.commitments, conversationText, 2);
  const nextFocusMatches = relevantMemoryItems([memory.next_focus], conversationText, 1);

  if (summaryMatches.length) lines.push(`Relevant continuity: ${summaryMatches[0].text}`);
  patternMatches.forEach(({ item, text }) => {
    const evidence = memoryEvidenceCount(item);
    lines.push(`${evidence >= 2 ? 'Evidence-backed pattern' : 'Possible pattern—verify before connecting'} (${evidence} moment${evidence === 1 ? '' : 's'}): ${text}`);
  });
  if (growthMatches.length) lines.push(`Relevant growth: ${growthMatches.map((entry) => entry.text).join('; ')}`);
  if (workedMatches.length) lines.push(`Strategies the athlete said worked: ${workedMatches.map((entry) => entry.text).join('; ')}`);
  if (didNotWorkMatches.length) lines.push(`Strategies the athlete said did not help: ${didNotWorkMatches.map((entry) => entry.text).join('; ')}`);
  if (cueMatches.length) lines.push(`Established reset cues: ${cueMatches.map((entry) => entry.text).join('; ')}`);
  if (routineMatches.length) lines.push(`Relevant routines: ${routineMatches.map((entry) => entry.text).join('; ')}`);
  if (commitmentMatches.length) lines.push(`Relevant commitments: ${commitmentMatches.map((entry) => entry.text).join('; ')}`);
  if (nextFocusMatches.length) lines.push(`Relevant next focus: ${nextFocusMatches[0].text}`);

  return lines.length
    ? `${lines.join('\n')}\nUse only if it helps now. Verify possible patterns and never force a historical connection.`
    : 'No long-term memory was relevant enough to include for this message.';
}

function buildCurriculumContext(curriculum, message = '') {
  if (!curriculum) return 'No app curriculum loaded.';

  const queryTokens = contextTokens(message);
  const curriculumRequested = isCurriculumQuestion(message);

  const deposit = curriculum.dailyDeposit;
  const depositLines = deposit
    ? [
        'Today\'s Daily Deposit:',
        `Deposit message: ${deposit.body || 'None provided'}`,
        `Today's Focus: ${deposit.focusQuestion || 'None provided'}`,
        `Release date: ${deposit.releaseDate || 'Unknown'}`
      ]
    : ['Today\'s Daily Deposit: Not available.'];

  const plans = asArray(curriculum.performancePlans)
    .map((plan) => {
      const searchable = `${plan.title || ''} ${plan.seriesTitle || ''} ${plan.subject || ''}`;
      const score = [...contextTokens(searchable)].reduce((total, token) => total + (queryTokens.has(token) ? 1 : 0), 0);
      return { plan, score };
    })
    .filter(({ score }) => curriculumRequested || score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ plan }) => plan);
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

function buildInput({ message, history, athlete, memory, curriculum, sportsContext, entryContext, language = 'en' }) {
  const conversationText = [...historyBeforeCurrentMessage(history, message).slice(-6).map((entry) => entry.text), message].join(' ');
  const needsGoals = /\b(goal|starting|starter|role|playing time|motivat|progress|season|improv|dream)\b/i.test(conversationText);
  const needsWork = /\b(train|practice|discipline|motivat|routine|habit|work|streak|locked|activity)\b/i.test(conversationText);
  const needsGameDay = /\b(game|match|meet|race|tomorrow|pregame|pre-game|nervous|pressure|visuali[sz]|compete)\b/i.test(conversationText);
  const needsJourney = /\bjourney|confidence|focus|mindset|overthink|mental\b/i.test(conversationText);
  const goals = needsGoals ? asArray(athlete?.goals).filter(Boolean).slice(0, 5) : [];
  const standards = needsWork ? asArray(athlete?.standards).filter(Boolean).slice(0, 6) : [];
  const contextLines = [
    `First name: ${athlete?.name || 'Unknown'}`,
    `Sport: ${athlete?.sport || 'Unknown'}`,
    `Age: ${athlete?.age || 'Unknown'}`
  ];
  if (athlete?.position) contextLines.push(`Position: ${athlete.position}`);
  if (athlete?.teamLevel) contextLines.push(`Team level: ${athlete.teamLevel}`);
  if (athlete?.dreamGoal && needsGoals) contextLines.push(`Dream goal: ${athlete.dreamGoal}`);
  if (goals.length) contextLines.push(`Relevant goals: ${goals.join('; ')}`);
  if (standards.length) contextLines.push(`Relevant current activities: ${standards.join('; ')}`);
  if (needsWork && athlete?.lockedInDays != null) contextLines.push(`Current locked-in streak: ${athlete.lockedInDays} day(s)`);
  if (needsJourney && athlete?.journey) contextLines.push(`21-Day Journey: ${cleanMessage(JSON.stringify(athlete.journey), 500)}`);
  if (needsGameDay && athlete?.recentGameDay) contextLines.push(`Recent Game Day context: ${cleanMessage(JSON.stringify(athlete.recentGameDay), 600)}`);
  const context = contextLines.join('\n');
  const entryGuidance = entryContext?.source === 'quick_start' && quickStartGuidance[entryContext.category]
    ? `The athlete selected the “${entryContext.category}” quick start. ${quickStartGuidance[entryContext.category]} Ask one natural, specific question that moves this exact topic forward. Do not use a generic catch-all question, and do not give a full solution before hearing their answer.`
    : 'The athlete typed their own message. Follow the normal discovery and response rules.';

  const recentHistory = historyBeforeCurrentMessage(history, message).slice(-MAX_HISTORY_MESSAGES);
  const messages = recentHistory
    .map((entry) => ({
      role: entry.role === 'coach' ? 'assistant' : 'user',
      content: cleanMessage(entry.text, 900)
    }))
    .filter((entry) => entry.content);

  return [
    {
      role: 'developer',
      content: `${coachInstructions}\n\nLanguage requirement: ${language === 'es' ? 'Respond entirely in natural, age-appropriate Spanish. Keep the same concise coaching style. Do not mix in English unless the athlete asks.' : 'Respond in English.'}\n\nConversation entry guidance:\n${entryGuidance}\n\nSelectively retrieved athlete context:\n${context}\n\nRelevant app curriculum context:\n${buildCurriculumContext(curriculum, message)}\n\nCurrent sports context:\n${sportsContext || 'No live sports lookup was needed for this message.'}\n\nRelevant private coaching continuity:\n${buildMemoryContext(memory, message, history, athlete)}`
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
    `profiles?select=*&id=eq.${encodeURIComponent(userId)}`,
    token,
    { method: 'GET' }
  );
  return Array.isArray(data) ? data[0] : null;
}

async function getAthleteContext(userId, token, profile, fallbackAthlete = {}) {
  const [athleteProfileResult, goalsResult, standardsResult] = await Promise.all([
    supabaseRequest(
      `athlete_profiles?select=*&user_id=eq.${encodeURIComponent(userId)}`,
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
    position: athleteProfile?.position || fallbackAthlete.position || '',
    teamLevel: athleteProfile?.team_level || fallbackAthlete.teamLevel || '',
    dreamGoal: athleteProfile?.dream_goal || fallbackAthlete.dreamGoal || '',
    goals: goals.length ? goals : asArray(fallbackAthlete.goals),
    standards: standards.length ? standards : asArray(fallbackAthlete.standards),
    lockedInDays: Number(fallbackAthlete.lockedInDays) || 0,
    journey: fallbackAthlete.journey || null,
    recentGameDay: fallbackAthlete.recentGameDay || null
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

async function getCurriculumContext(token, fallbackCurriculum = {}, userId = '', language = 'en') {
  const fallback = normalizeFallbackCurriculum(fallbackCurriculum);
  const today = new Date().toISOString().slice(0, 10);
  const [depositResult, plansResult, planProgressResult] = await Promise.all([
    supabaseRequest(
      `daily_deposits?select=title,body,focus_question,title_es,body_es,focus_question_es,release_date,status&status=eq.posted&release_date=lte.${today}&order=release_date.desc&limit=1`,
      token,
      { method: 'GET' }
    ),
    supabaseRequest(
      `performance_plans?select=id,title,subject,steps,title_es,subject_es,steps_es,challenge_day_es,release_date,challenge_day,challenge_length&release_date=lte.${today}&order=release_date.asc&limit=${MAX_CURRICULUM_PLANS}`,
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
          title: cleanMessage(language === 'es' ? (deposit.title_es || deposit.title) : deposit.title, 140),
          body: cleanMessage(language === 'es' ? (deposit.body_es || deposit.body) : deposit.body, 900),
          focusQuestion: cleanMessage(language === 'es' ? (deposit.focus_question_es || deposit.focus_question) : deposit.focus_question, 240),
          releaseDate: deposit.release_date || ''
        }
      : fallback.dailyDeposit,
    performancePlans: plans.map((plan) => ({
      title: cleanMessage(language === 'es' ? (plan.title_es || plan.title) : plan.title, 140),
      seriesTitle: cleanMessage(seriesTitleFromSubject(language === 'es' ? (plan.subject_es || plan.subject) : plan.subject), 140),
      subject: cleanMessage(language === 'es' ? (plan.subject_es || plan.subject) : plan.subject, 700),
      steps: asArray(language === 'es' && plan.steps_es?.length ? plan.steps_es : plan.steps).map((step) => cleanMessage(step, 240)).filter(Boolean),
      releaseDate: plan.release_date || '',
      challengeDay: cleanMessage(language === 'es' ? (plan.challenge_day_es || plan.challenge_day) : plan.challenge_day, 80),
      challengeLength: Number(plan.challenge_length) || 0,
      currentDay: planCurrentDay(plan.release_date, plan.challenge_length),
      completedAt: progressByPlanId.get(String(plan.id)) || '',
      unlocked: true,
      unlockDate: ''
    })).concat(plans.length ? [] : fallback.performancePlans)
  };
}

function seriesTitleFromSubject(subject) {
  const match = String(subject ?? '').match(/(?:Series|Serie):\s*([^.!]+)[.!]?/i);
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
  let result = await supabaseRequest(
    `coach_memories?select=summary,patterns,growth_markers,next_focus,safety_flags,strategies_worked,strategies_not_worked,reset_cues,routines,commitments&athlete_user_id=eq.${encodeURIComponent(userId)}`,
    token,
    { method: 'GET' }
  );
  if (result.error) {
    result = await supabaseRequest(
      `coach_memories?select=summary,patterns,growth_markers,next_focus,safety_flags&athlete_user_id=eq.${encodeURIComponent(userId)}`,
      token,
      { method: 'GET' }
    );
  }
  return Array.isArray(result.data) ? result.data[0] : null;
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

async function updateCoachMemory({ apiKey, model, userId, token, previousMemory, conversationHistory = [], athleteMessage, coachMessage, safety }) {
  if (safety !== 'ok') return;

  const memoryPrompt = `
Update this private athlete coach memory after one new exchange.

Rules:
- Keep it concise and useful for future mental performance coaching.
- Preserve only meaningful long-term coaching details, not ordinary conversation filler.
- Track patterns, growth, recurring friction points, strategies that worked, strategies that did not work, reset cues, routines, commitments, and next focus.
- A pattern must be an object with keys pattern, evidence_count, and last_seen. Increase evidence_count only when the new athlete message provides another distinct example. Never promote a one-time event into a confirmed pattern.
- Store strategies as objects with strategy, contexts, and last_seen. Put one under strategies_worked only when the athlete explicitly says it helped. Put one under strategies_not_worked only when the athlete explicitly says it did not help.
- Store reset cues as objects with cue and contexts; routines as objects with routine and contexts; and commitments as objects with commitment, contexts, and status.
- Preserve exact athlete-created reset words or short cues when useful, but do not store full raw messages.
- Do not infer a position, goal, routine, result, emotion, or preference that the athlete did not state.
- Merge with useful previous memory instead of replacing it with only the newest exchange.
- Do not include medical diagnosis, protected traits, gossip, or unnecessary sensitive details.
- Do not store exact raw messages.
- Return only valid JSON with keys: summary, patterns, growth_markers, strategies_worked, strategies_not_worked, reset_cues, routines, commitments, next_focus, safety_flags.

Previous memory:
${JSON.stringify(previousMemory ?? {})}

Recent conversation context:
${JSON.stringify(historyBeforeCurrentMessage(conversationHistory, athleteMessage).slice(-6))}

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

  const memoryRecord = {
    athlete_user_id: userId,
    summary: cleanMessage(nextMemory.summary, 700),
    patterns: asArray(nextMemory.patterns).slice(0, MAX_MEMORY_ITEMS),
    growth_markers: asArray(nextMemory.growth_markers).slice(0, MAX_MEMORY_ITEMS),
    strategies_worked: asArray(nextMemory.strategies_worked).slice(0, MAX_MEMORY_ITEMS),
    strategies_not_worked: asArray(nextMemory.strategies_not_worked).slice(0, MAX_MEMORY_ITEMS),
    reset_cues: asArray(nextMemory.reset_cues).slice(0, MAX_MEMORY_ITEMS),
    routines: asArray(nextMemory.routines).slice(0, MAX_MEMORY_ITEMS),
    commitments: asArray(nextMemory.commitments).slice(0, MAX_MEMORY_ITEMS),
    next_focus: cleanMessage(nextMemory.next_focus, 280),
    safety_flags: asArray(nextMemory.safety_flags).slice(0, MAX_MEMORY_ITEMS),
    updated_at: new Date().toISOString()
  };
  const memoryWrite = await supabaseRequest('coach_memories?on_conflict=athlete_user_id', token, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(memoryRecord)
  });
  if (memoryWrite.error) {
    const { strategies_worked, strategies_not_worked, reset_cues, routines, commitments, ...legacyRecord } = memoryRecord;
    await supabaseRequest('coach_memories?on_conflict=athlete_user_id', token, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(legacyRecord)
    });
  }
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

async function transcribeVoiceTurn({ body, apiKey, user }) {
  const mimeType = String(body.mimeType || '').split(';')[0].toLowerCase();
  const extension = allowedAudioMimeTypes.get(mimeType);
  if (!extension) return { status: 400, payload: { error: 'This audio format is not supported.' } };

  let audio;
  try {
    audio = Buffer.from(String(body.audio || ''), 'base64');
  } catch {
    return { status: 400, payload: { error: 'The voice recording is invalid.' } };
  }
  if (!audio.length) return { status: 400, payload: { error: 'No voice recording was received.' } };
  if (audio.length > MAX_AUDIO_BYTES) {
    return { status: 413, payload: { error: 'Keep each voice turn under 45 seconds.' } };
  }

  const form = new FormData();
  form.append('file', new Blob([audio], { type: mimeType }), `coach-turn.${extension}`);
  form.append('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe');
  form.append('language', String(body.language || '').toLowerCase().startsWith('es') ? 'es' : 'en');
  form.append('response_format', 'json');

  const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  });
  if (!response.ok) {
    await logAppEvent({
      area: 'coach',
      eventType: 'voice_transcription_failed',
      severity: 'error',
      userId: user.id,
      metadata: { status: response.status, mimeType, bytes: audio.length }
    });
    return { status: 502, payload: { error: 'Voice recognition could not connect. Please try again.' } };
  }

  const payload = await response.json().catch(() => ({}));
  const text = String(payload.text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!text) {
    return { status: 422, payload: { error: 'I did not hear a clear message. Tap the microphone and try again.' } };
  }

  await logAppEvent({
    area: 'coach',
    eventType: 'voice_transcribed',
    severity: 'info',
    userId: user.id,
    metadata: { characters: text.length, bytes: audio.length }
  });
  return { status: 200, payload: { text } };
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

  if (body.action === 'transcribe') {
    const result = await transcribeVoiceTurn({ body, apiKey, user });
    return json(res, result.status, result.payload);
  }

  const message = cleanMessage(body.message);
  const entryCategory = cleanMessage(body.entryContext?.category, 40);
  const entryContext = body.entryContext?.source === 'quick_start' && quickStartGuidance[entryCategory]
    ? { source: 'quick_start', category: entryCategory }
    : null;
  const language = String(body.language || body.locale || profile?.preferred_language || user.user_metadata?.preferred_language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
  if (!message) {
    return json(res, 400, { error: 'Message is required.' });
  }

  if (message.length > MAX_MESSAGE_LENGTH - 1) {
    return json(res, 400, { error: 'Message is too long. Keep it under 1,200 characters.' });
  }

  if (crisisPattern.test(message)) {
    const reply = crisisResponse(language);
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
    const reply = crisisResponse(language);
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
    const reply = blockedResponse(language);
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
      error: limitResponse(limit, language),
      code: 'coach_daily_limit',
      messageCount: usage.messageCount || limit,
      messageLimit: limit
    });
  }

  const curriculumRelevant = isCurriculumQuestion(message);
  const model = process.env.OPENAI_COACH_MODEL || 'gpt-4.1-mini';
  const [athleteContext, curriculumContext, sportsContext, memory] = await Promise.all([
    getAthleteContext(user.id, token, profile, body.athlete),
    curriculumRelevant ? getCurriculumContext(token, body.curriculum, user.id, language) : Promise.resolve(null),
    getSportsContext(message),
    getCoachMemory(user.id, token)
  ]);

  const sportsKnowledgeQuestion = hasSportsKnowledgeIntent(message);

  if (!entryContext && !sportsKnowledgeQuestion && !isCurriculumQuestion(message) && needsClarifyingQuestion(message, body.history)) {
    const reply = clarifyingResponse(message, athleteContext, body.history, language);
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
        sportsContext,
        entryContext,
        language
      }),
      max_output_tokens: sportsKnowledgeQuestion ? 320 : entryContext ? 280 : 240
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
    const fallbackReply = entryContext ? quickStartFallbackQuestions[entryContext.category] : '';
    if (fallbackReply) {
      await saveCoachSession({
        userId: user.id,
        token,
        sessionId: body.sessionId,
        title: body.sessionTitle || message,
        messages: [...cleanMessages(body.history), { role: 'coach', text: fallbackReply }],
        safety: 'ok'
      });
      return json(res, 200, {
        reply: fallbackReply,
        safety: 'ok',
        mode: 'guided_fallback',
        messageCount: usage.messageCount,
        messageLimit: usage.messageLimit
      });
    }
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
    conversationHistory: body.history,
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
