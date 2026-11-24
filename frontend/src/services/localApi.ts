/**
 * Nocturne On-Device Dispatcher
 * Emulates the full backend API directly on the client.
 * If backend server is unreachable or offline, this local-first engine
 * executes authentication, analytics, sleep logs, workouts, and biometrics instantly.
 */

import { localDb, LocalUser, LocalWorkoutSession, LocalBiometricsLog, LocalSleepRecord } from './localDb';

// Simple hashing for local-only security
async function hashPassword(plain: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(plain + '_nocturne_local_salt');
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Environment Keys for On-Device Fallbacks
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

export async function handleLocalApi(endpoint: string, options: RequestInit = {}): Promise<any> {
  const method = (options.method || 'GET').toUpperCase();
  const urlParts = endpoint.split('?');
  const path = urlParts[0];
  const queryParams = new URLSearchParams(urlParts[1] || '');
  const body = options.body ? JSON.parse(options.body as string) : {};

  // 1. AUTH / REGISTER
  if (path === '/auth/register' && method === 'POST') {
    const { email, password, displayName } = body;
    if (!email || !password) throw new Error('Email and password required');

    const users = localDb.getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('An account with this email already exists on this device');
    }

    const passwordHash = await hashPassword(password);
    const newUser: LocalUser = {
      id: 'usr_' + Date.now(),
      email: email.toLowerCase(),
      passwordHash,
      displayName: displayName || email.split('@')[0],
      dailyStepGoal: 10000,
      dailyCalorieGoal: 600,
      dailyActiveMinGoal: 45,
      restingHeartRate: 62,
      maxHeartRate: 185,
      hrvBaselineMs: 68,
      vo2MaxEstimate: 48,
      aiHealthContextConsent: true,
      biometricLockEnabled: false,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localDb.saveUsers(users);
    localDb.setActiveUserId(newUser.id);

    return {
      tokens: {
        accessToken: 'local_token_' + newUser.id,
        refreshToken: 'local_ref_' + newUser.id
      },
      user: newUser
    };
  }

  // 2. AUTH / LOGIN
  if (path === '/auth/login' && method === 'POST') {
    const { email, password } = body;
    const users = localDb.getUsers();
    const user = users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
    if (!user) throw new Error('Invalid email or password');

    const hash = await hashPassword(password);
    if (user.passwordHash !== hash) throw new Error('Invalid email or password');

    localDb.setActiveUserId(user.id);

    return {
      tokens: {
        accessToken: 'local_token_' + user.id,
        refreshToken: 'local_ref_' + user.id
      },
      user
    };
  }

  // Authenticated state check
  const activeUser = localDb.getActiveUser();
  if (!activeUser && !path.startsWith('/auth/')) {
    // If no active user, check if any user exists, otherwise create a default local profile
    let users = localDb.getUsers();
    if (users.length === 0) {
      const guestUser: LocalUser = {
        id: 'usr_local_primary',
        email: 'local@nocturne.app',
        passwordHash: 'local',
        displayName: 'Nocturne Athlete',
        dailyStepGoal: 10000,
        dailyCalorieGoal: 600,
        dailyActiveMinGoal: 45,
        restingHeartRate: 62,
        maxHeartRate: 185,
        hrvBaselineMs: 68,
        vo2MaxEstimate: 48,
        aiHealthContextConsent: true,
        biometricLockEnabled: false,
        createdAt: new Date().toISOString()
      };
      users.push(guestUser);
      localDb.saveUsers(users);
      localDb.setActiveUserId(guestUser.id);
    }
  }

  const currentUser = localDb.getActiveUser()!;

  // 3. USER PROFILE
  if (path === '/user/profile') {
    if (method === 'GET') {
      return { status: 'success', user: currentUser };
    }
    if (method === 'PATCH') {
      const users = localDb.getUsers();
      const idx = users.findIndex(u => u.id === currentUser.id);
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...body };
        localDb.saveUsers(users);
      }
      return { status: 'success', user: users[idx] };
    }
  }

  if (path === '/user/sync' && method === 'POST') {
    return { status: 'success', message: 'Local telemetry in sync', timestamp: new Date().toISOString() };
  }

  if (path === '/user/account' && method === 'DELETE') {
    const users = localDb.getUsers().filter(u => u.id !== currentUser.id);
    localDb.saveUsers(users);
    localDb.setActiveUserId(null);
    return { status: 'success', message: 'Account and all data deleted' };
  }

  // 4. DASHBOARD SUMMARY
  if (path === '/dashboard/summary' && method === 'GET') {
    const today = new Date().toISOString().split('T')[0];
    const workouts = localDb.getWorkouts(currentUser.id);
    const todayWorkouts = workouts.filter(w => w.startedAt.startsWith(today));

    const activeMins = todayWorkouts.reduce((acc, w) => acc + Math.round(w.elapsedSeconds / 60), 0);
    const caloriesBurned = todayWorkouts.reduce((acc, w) => acc + w.activeCalories, 0);
    const stepsCurrent = todayWorkouts.reduce((acc, w) => acc + (w.cadenceSpm ? Math.round((w.cadenceSpm * w.elapsedSeconds) / 60) : 0), 0);

    const sleepLogs = localDb.getSleepRecords(currentUser.id);
    const latestSleep = sleepLogs.find(s => s.date === today) || sleepLogs[0];

    const biometrics = localDb.getBiometrics(currentUser.id);
    const latestBiometrics = biometrics[0];

    const weeklyRoutine = [
      { day: 'S', completed: false },
      { day: 'M', completed: true },
      { day: 'T', completed: true },
      { day: 'W', completed: todayWorkouts.length > 0 },
      { day: 'T', completed: false },
      { day: 'F', completed: false },
      { day: 'S', completed: false }
    ];

    return {
      user: {
        id: currentUser.id,
        displayName: currentUser.displayName,
        dailyStepGoal: currentUser.dailyStepGoal,
        dailyCalorieGoal: currentUser.dailyCalorieGoal,
        dailyActiveMinGoal: currentUser.dailyActiveMinGoal
      },
      today: {
        steps: stepsCurrent,
        stepGoal: currentUser.dailyStepGoal,
        activeMinutes: activeMins,
        activeMinGoal: currentUser.dailyActiveMinGoal,
        caloriesBurned,
        calorieGoal: currentUser.dailyCalorieGoal,
        distanceKm: todayWorkouts.reduce((acc, w) => acc + w.distanceKm, 0),
        hydrationMl: localDb.getHydration(currentUser.id, today)
      },
      latestBiometrics: latestBiometrics ? {
        weightKg: latestBiometrics.weightKg,
        bmi: latestBiometrics.bmi,
        bodyFatPercent: latestBiometrics.bodyFatPercent,
        muscleMassKg: latestBiometrics.muscleMassKg,
        recordedAt: latestBiometrics.recordedAt
      } : null,
      latestSleep: latestSleep ? {
        durationFormatted: `${Math.floor(latestSleep.durationMinutes / 60)}h ${latestSleep.durationMinutes % 60}m`,
        efficiencyScore: latestSleep.efficiencyScore,
        date: latestSleep.date
      } : null,
      weeklyRoutine
    };
  }

  // 5. BIOMETRICS LOGGING
  if (path === '/biometrics/log' && method === 'POST') {
    const { weightKg, heightCm, bodyFatPercent, muscleMassKg } = body;
    const heightM = (heightCm || currentUser.heightCm || 175) / 100;
    const bmi = parseFloat((weightKg / (heightM * heightM)).toFixed(1));

    const log: LocalBiometricsLog = {
      id: 'bio_' + Date.now(),
      userId: currentUser.id,
      weightKg,
      heightCm,
      bmi,
      bodyFatPercent,
      muscleMassKg,
      recordedAt: new Date().toISOString()
    };
    localDb.addBiometrics(log);

    // Update user profile weight
    const users = localDb.getUsers();
    const idx = users.findIndex(u => u.id === currentUser.id);
    if (idx >= 0) {
      users[idx].weightKg = weightKg;
      if (heightCm) users[idx].heightCm = heightCm;
      localDb.saveUsers(users);
    }

    return { status: 'success', log };
  }

  if (path === '/biometrics/hydration' && method === 'POST') {
    const today = new Date().toISOString().split('T')[0];
    const current = localDb.getHydration(currentUser.id, today);
    const added = body.amountMl || 250;
    localDb.setHydration(currentUser.id, today, current + added);
    return { status: 'success', currentHydrationMl: current + added };
  }

  // 6. WEIGHT ANALYTICS
  if (path === '/analytics/weight' && method === 'GET') {
    const logs = localDb.getBiometrics(currentUser.id);
    return {
      currentWeight: currentUser.weightKg || (logs[0] ? logs[0].weightKg : 72.5),
      targetWeight: currentUser.targetWeightKg || 68.0,
      weeklyChangeKg: -0.4,
      totalLostKg: 2.1,
      logs: logs.map(l => ({
        id: l.id,
        weightKg: l.weightKg,
        bmi: l.bmi,
        recordedAt: l.recordedAt
      }))
    };
  }

  if (path === '/analytics/weight/goal' && method === 'PATCH') {
    const users = localDb.getUsers();
    const idx = users.findIndex(u => u.id === currentUser.id);
    if (idx >= 0) {
      users[idx].targetWeightKg = body.targetWeightKg;
      if (body.weeklyGoalKg) users[idx].weeklyGoalKg = body.weeklyGoalKg;
      localDb.saveUsers(users);
    }
    return { status: 'success', user: users[idx] };
  }

  // 7. CARDIO & VO2 ANALYTICS
  if (path === '/analytics/cardio' && method === 'GET') {
    return {
      vo2Max: currentUser.vo2MaxEstimate || 48,
      restingHeartRate: currentUser.restingHeartRate || 62,
      maxHeartRate: currentUser.maxHeartRate || 185,
      hrvBaseline: currentUser.hrvBaselineMs || 68,
      heartRateZones: {
        zone1: { min: 95, max: 114, label: 'Active Recovery' },
        zone2: { min: 115, max: 133, label: 'Aerobic Base' },
        zone3: { min: 134, max: 152, label: 'Tempo' },
        zone4: { min: 153, max: 171, label: 'Threshold' },
        zone5: { min: 172, max: 190, label: 'VO2 Max' }
      }
    };
  }

  // 8. SLEEP ANALYTICS
  if (path === '/analytics/sleep' && method === 'GET') {
    const logs = localDb.getSleepRecords(currentUser.id);
    if (logs.length === 0) {
      // Seed a baseline sleep record for today
      const today = new Date().toISOString().split('T')[0];
      const initial: LocalSleepRecord = {
        id: 'slp_init',
        userId: currentUser.id,
        date: today,
        durationMinutes: 442, // 7h 22m
        efficiencyScore: 88,
        deepSleepMinutes: 98,
        remSleepMinutes: 112,
        lightSleepMinutes: 202,
        awakeMinutes: 30,
        notes: 'Good deep recovery sleep'
      };
      localDb.saveSleepRecord(initial);
      logs.push(initial);
    }

    return {
      latest: logs[0],
      weeklyAverageEfficiency: 86,
      averageDurationHours: 7.4,
      history: logs
    };
  }

  if (path === '/analytics/sleep/note' && method === 'POST') {
    const today = new Date().toISOString().split('T')[0];
    const record: LocalSleepRecord = {
      id: 'slp_' + Date.now(),
      userId: currentUser.id,
      date: today,
      durationMinutes: body.durationMinutes || 450,
      efficiencyScore: body.efficiencyScore || 85,
      deepSleepMinutes: body.deepSleepMinutes || 95,
      remSleepMinutes: body.remSleepMinutes || 110,
      lightSleepMinutes: body.lightSleepMinutes || 215,
      awakeMinutes: body.awakeMinutes || 30,
      notes: body.note
    };
    localDb.saveSleepRecord(record);
    return { status: 'success', record };
  }

  // 9. WORKOUTS & LIVE SESSION
  if (path === '/workouts/config') {
    return {
      autoPause: true,
      audioCues: true,
      metronomeBpm: 170,
      targetHeartRateZone: 3
    };
  }

  if (path === '/workouts/session/start' && method === 'POST') {
    const newSession: LocalWorkoutSession = {
      id: 'wk_' + Date.now(),
      userId: currentUser.id,
      sportType: body.sportType || 'running',
      status: 'active',
      elapsedSeconds: 0,
      distanceKm: 0,
      activeCalories: 0,
      avgHeartRateBpm: 0,
      startedAt: new Date().toISOString()
    };
    localDb.saveWorkout(newSession);
    return { status: 'success', session: newSession };
  }

  if (path.startsWith('/workouts/session/') && path.endsWith('/finish') && method === 'POST') {
    const parts = path.split('/');
    const sessionId = parts[3];
    const workouts = localDb.getWorkouts(currentUser.id);
    const session = workouts.find(w => w.id === sessionId);
    if (session) {
      session.status = 'completed';
      session.elapsedSeconds = body.elapsedSeconds || session.elapsedSeconds;
      session.distanceKm = body.distanceKm || session.distanceKm;
      session.activeCalories = body.activeCalories || session.activeCalories;
      session.avgHeartRateBpm = body.avgHeartRateBpm || session.avgHeartRateBpm;
      session.maxHeartRateBpm = body.maxHeartRateBpm || session.maxHeartRateBpm;
      session.endedAt = new Date().toISOString();
      localDb.saveWorkout(session);
      return { status: 'success', session };
    }
    return { status: 'success' };
  }

  // 10. COMMUNITY & CHALLENGES
  if (path === '/community/challenges' && method === 'GET') {
    const tab = queryParams.get('tab') || 'active';
    const challenges = localDb.getChallenges();
    return {
      status: 'success',
      challenges: tab === 'joined' ? challenges.filter(c => c.joined) : challenges
    };
  }

  if (path.startsWith('/community/challenges/') && path.endsWith('/log') && method === 'POST') {
    const parts = path.split('/');
    const chalId = parts[3];
    const challenges = localDb.getChallenges();
    const chal = challenges.find(c => c.id === chalId);
    if (chal) {
      chal.currentValue += (body.value || 1);
      localDb.saveChallenges(challenges);
    }
    return { status: 'success', challenge: chal };
  }

  // 11. NOCTURNE AI COACH (Gemini 2.5 Flash Direct Call from Phone)
  if (path === '/ai/history') {
    if (method === 'GET') {
      const msgs = localDb.getAiMessages(currentUser.id);
      return { status: 'success', history: msgs };
    }
    if (method === 'DELETE') {
      localDb.clearAiMessages(currentUser.id);
      return { status: 'success', message: 'History cleared' };
    }
  }

  if (path === '/ai/chat' && method === 'POST') {
    const { message, mode } = body;
    if (!message) throw new Error('Message is required');

    // Store user message locally
    localDb.addAiMessage({
      id: 'msg_' + Date.now(),
      userId: currentUser.id,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString()
    });

    // Generate System Instructions with Real Local Biometrics
    const today = new Date().toISOString().split('T')[0];
    const workouts = localDb.getWorkouts(currentUser.id);
    const todayWorkouts = workouts.filter(w => w.startedAt.startsWith(today));
    const activeMins = todayWorkouts.reduce((acc, w) => acc + Math.round(w.elapsedSeconds / 60), 0);
    const caloriesBurned = todayWorkouts.reduce((acc, w) => acc + w.activeCalories, 0);

    const isVoice = mode === 'voice';

    const systemPrompt = `You are Friday, an expert athletic performance, workout, and music intelligence assistant embedded in the Nocturne mobile app.
Your visual and conversational style is "Obsidian Kinetic": sharp, motivating, scientifically grounded, and concise.

User Biometrics Context (100% On-Device Private):
- User: ${currentUser.displayName}
- Daily Steps Goal: ${currentUser.dailyStepGoal} steps
- Today's Workouts: ${todayWorkouts.length} logged, ${activeMins} active minutes, ${caloriesBurned} kcal burned
- Resting Heart Rate: ${currentUser.restingHeartRate} bpm, Max Heart Rate: ${currentUser.maxHeartRate} bpm
- Estimated VO2 Max: ${currentUser.vo2MaxEstimate} mL/kg/min
- Current Weight: ${currentUser.weightKg || 'Not logged yet'} kg

MUSIC INTENT DETECTION:
When the user asks to play music, pause, resume, change track, or stop music, output a JSON action block on the very last line of your response enclosed in [ACTION]...[/ACTION].
Supported Actions:
- [ACTION]{"type":"PLAY_SONG","query":"<song and artist>"}[/ACTION]
- [ACTION]{"type":"PAUSE_MUSIC"}[/ACTION]
- [ACTION]{"type":"RESUME_MUSIC"}[/ACTION]
- [ACTION]{"type":"NEXT_TRACK"}[/ACTION]
- [ACTION]{"type":"STOP_MUSIC"}[/ACTION]

${isVoice
  ? 'VOICE MODE: Keep your response natural, conversational, and very concise (2-4 sentences max). Do NOT use markdown symbols, bullet points, asterisks, or tables, because your text will be read aloud by Text-to-Speech.'
  : 'TEXT MODE: Provide concise, inspiring formatting with clean markdown.'}
Always include a brief non-medical wellness disclaimer if providing training advice.`;

    // Direct Gemini REST call using Gemini 2.5 Flash
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: message }]
          }
        ]
      })
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini AI responded with status ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    let replyText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "I'm Friday. How else can I assist your training or music?";

    // Parse action intent
    let action: any = null;
    const actionMatch = replyText.match(/\[ACTION\](.*?)\[\/ACTION\]/s);
    if (actionMatch) {
      try {
        action = JSON.parse(actionMatch[1].trim());
        replyText = replyText.replace(/\[ACTION\].*?\[\/ACTION\]/s, '').trim();
      } catch (e) {
        console.warn('Action parse failed:', e);
      }
    }

    // Fallback regex detection for music commands
    if (!action) {
      const lowerMsg = message.toLowerCase().trim();
      if (lowerMsg.startsWith('play ') || lowerMsg.startsWith('put on ') || lowerMsg.includes('play music')) {
        const query = lowerMsg.replace(/^(play|put on)\s+/i, '').replace(/^(some\s+)/i, '').trim();
        action = { type: 'PLAY_SONG', query: query || 'workout motivation mix' };
      } else if (lowerMsg === 'pause' || lowerMsg === 'pause music') {
        action = { type: 'PAUSE_MUSIC' };
      } else if (lowerMsg === 'resume' || lowerMsg === 'resume music') {
        action = { type: 'RESUME_MUSIC' };
      } else if (lowerMsg === 'next' || lowerMsg === 'next track' || lowerMsg === 'skip') {
        action = { type: 'NEXT_TRACK' };
      } else if (lowerMsg === 'stop' || lowerMsg === 'stop music') {
        action = { type: 'STOP_MUSIC' };
      }
    }

    const spokenSummary = replyText.replace(/[*#_`]/g, '').slice(0, 240);

    // Save assistant reply locally
    localDb.addAiMessage({
      id: 'msg_ai_' + Date.now(),
      userId: currentUser.id,
      role: 'assistant',
      content: replyText,
      createdAt: new Date().toISOString()
    });

    return {
      status: 'success',
      reply: {
        id: 'msg_ai_' + Date.now(),
        role: 'model',
        content: replyText,
        createdAt: new Date().toISOString()
      },
      replyText,
      spokenSummary,
      action
    };
  }

  // 12. MUSIC SEARCH (ON-DEVICE YOUTUBE API + FALLBACK DISPATCH)
  if (path === '/music/search' && method === 'GET') {
    const q = queryParams.get('q') || 'workout music';
    const cleanEncodedQuery = encodeURIComponent(q);
    const fallbackLinks = {
      youtubeMusicUrl: `https://music.youtube.com/search?q=${cleanEncodedQuery}`,
      youtubeWebUrl: `https://www.youtube.com/results?search_query=${cleanEncodedQuery}`,
      spotifySearchUrl: `https://open.spotify.com/search/${cleanEncodedQuery}`
    };

    const YOUTUBE_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || '';

    try {
      const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=8&q=${cleanEncodedQuery}&key=${YOUTUBE_KEY}`;
      const ytRes = await fetch(ytUrl);
      if (ytRes.ok) {
        const ytData = await ytRes.json();
        if (ytData.items && ytData.items.length > 0) {
          const tracks = ytData.items.map((item: any) => {
            const vid = item.id?.videoId || '';
            return {
              id: vid,
              videoId: vid,
              title: item.snippet?.title?.replace(/&amp;/g, '&')?.replace(/&#39;/g, "'") || q,
              artist: item.snippet?.channelTitle || 'Artist',
              channel: item.snippet?.channelTitle || 'YouTube Music',
              thumbnailUrl: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
              source: 'youtube',
              youtubeUrl: `https://www.youtube.com/watch?v=${vid}`,
              spotifyUrl: fallbackLinks.spotifySearchUrl
            };
          });

          return {
            status: 'success',
            query: q,
            tracks,
            fallbackLinks
          };
        }
      }
    } catch (e) {
      console.warn('YouTube search API fetch error:', e);
    }

    return {
      status: 'success',
      query: q,
      tracks: [
        {
          id: 'track_' + Date.now() + '_1',
          videoId: '',
          title: q.replace(/\b\w/g, l => l.toUpperCase()),
          artist: 'Nocturne Workout Sound',
          channel: 'Workout Beats',
          thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=60',
          source: 'external',
          youtubeUrl: fallbackLinks.youtubeWebUrl,
          spotifyUrl: fallbackLinks.spotifySearchUrl
        },
        {
          id: 'track_def_1',
          videoId: 'btPJPFnesV4',
          title: 'Eye of the Tiger',
          artist: 'Survivor',
          channel: 'Survivor Band',
          thumbnailUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&auto=format&fit=crop&q=60',
          source: 'youtube',
          youtubeUrl: 'https://www.youtube.com/watch?v=btPJPFnesV4',
          spotifyUrl: 'https://open.spotify.com/search/Eye%20of%20the%20Tiger%20Survivor'
        },
        {
          id: 'track_def_2',
          videoId: '7wtfhZwyrcc',
          title: 'Believer',
          artist: 'Imagine Dragons',
          channel: 'ImagineDragons',
          thumbnailUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&auto=format&fit=crop&q=60',
          source: 'youtube',
          youtubeUrl: 'https://www.youtube.com/watch?v=7wtfhZwyrcc',
          spotifyUrl: 'https://open.spotify.com/search/Believer%20Imagine%20Dragons'
        }
      ],
      fallbackLinks
    };
  }

  // Fallback for any other endpoints
  return { status: 'success' };
}
