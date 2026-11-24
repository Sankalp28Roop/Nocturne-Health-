import { Router, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router = Router();

const chatMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  mode: z.enum(['text', 'voice']).optional().default('text')
});

// GET /api/v1/ai/history - Retrieve conversation history
router.get('/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const messages = await prisma.aiChatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: 50
    });

    return res.json({
      status: 'success',
      history: messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString()
      }))
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/v1/ai/history - Clear conversation history
router.delete('/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    await prisma.aiChatMessage.deleteMany({
      where: { userId }
    });

    return res.json({
      status: 'success',
      message: 'AI Coach conversation history cleared'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/ai/chat - Prompt Nocturne AI Coach (Text or Live Voice Mode)
router.post('/chat', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const parseResult = chatMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid chat request', details: parseResult.error.format() });
    }

    const { message, mode } = parseResult.data;

    // 1. Enforce per-user daily rate limit (50 messages / 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const userMessageCount = await prisma.aiChatMessage.count({
      where: {
        userId,
        role: 'user',
        createdAt: { gte: twentyFourHoursAgo }
      }
    });

    if (userMessageCount >= 50) {
      return res.status(429).json({
        error: 'Daily AI Coach message limit reached (50/day). Please try again tomorrow.'
      });
    }

    // 2. Fetch User & determine if health context consent is granted
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        cardioCalibration: true,
        workoutConfigs: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let healthContextPrompt = 'User has disabled health context sharing. Provide general fitness and wellness advice only without assuming specific metrics.';

    if (user.aiHealthContextConsent) {
      // Gather REAL database metrics only
      const latestWeight = await prisma.biometricsLog.findFirst({
        where: { userId },
        orderBy: { recordedAt: 'desc' }
      });

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentWorkouts = await prisma.workoutSession.findMany({
        where: {
          userId,
          status: 'completed',
          startedAt: { gte: sevenDaysAgo }
        },
        orderBy: { startedAt: 'desc' },
        take: 7
      });

      const latestSleep = await prisma.sleepRecord.findFirst({
        where: { userId },
        orderBy: { date: 'desc' }
      });

      const totalDistMeters = recentWorkouts.reduce((acc, w) => acc + w.distanceMeters, 0);
      const totalActiveMin = recentWorkouts.reduce((acc, w) => acc + Math.round(w.elapsedSeconds / 60), 0);

      healthContextPrompt = `
AUTHENTICATED USER METRICS (STRICT DATABASE DATA):
- Name: ${user.displayName}
- Biometrics: Height: ${user.heightCm ? user.heightCm + ' cm' : 'Not recorded'}, Weight: ${latestWeight?.weightKg ? latestWeight.weightKg + ' kg' : user.weightKg ? user.weightKg + ' kg' : 'Not recorded'}, BMI: ${latestWeight?.bmi ? latestWeight.bmi : 'Not computed'}
- Weight Goal: ${user.goalWeightKg ? user.goalWeightKg + ' kg' : 'Not set'}
- Movement Goals: Steps Goal: ${user.goalSteps ?? 'Not set'}, Active Minutes Goal: ${user.goalActiveMinutes ?? 'Not set'} min
- Past 7 Days Activity: ${recentWorkouts.length} completed workouts, ${(totalDistMeters / 1000).toFixed(2)} km total distance, ${totalActiveMin} active minutes
- Latest Sleep: ${latestSleep ? `${(latestSleep.durationMinutes / 60).toFixed(1)} hrs (Score: ${latestSleep.sleepScore ?? 'N/A'}, Readiness: ${latestSleep.readinessScore ?? 'N/A'})` : 'No sleep logged'}
- Heart Rate Calibration: ${user.cardioCalibration ? `Max HR: ${user.cardioCalibration.maxHr} bpm, Resting HR: ${user.cardioCalibration.restingHr} bpm, VO2 Max: ${user.cardioCalibration.vo2Max ?? 'Not calibrated'}` : 'Not calibrated'}
`;
    }

    const voiceGuidelines = mode === 'voice' 
      ? `
VOICE MODE ACTIVE (CRITICAL SPOKEN INSTRUCTIONS):
- You are speaking aloud directly to the user in a live two-way voice call.
- Reply in 2 to 4 short, punchy, conversational sentences.
- DO NOT use markdown formatting, markdown tables, asterisks (*), hashtags (#), or bullet points (-) — speak naturally like a real-time human coach (e.g. Gemini Live / Assistant).
- Use conversational pauses, natural contractions, and encouraging direct address.
`
      : `
TEXT MODE ACTIVE:
- Format with clean bullet points, bold key terms, and tabular metrics where helpful.
- Keep responses under 150 words unless specifically asked for a detailed workout breakdown.
`;

    const systemInstruction = `
You are Friday, an intelligent, motivational, and precise health, workout, and music voice assistant built into the Nocturne mobile app.
Your persona is Friday: sharp, inspiring, responsive, science-backed, and concise.

Core Rules:
1. Palette & Tone: Obsidian Kinetic ethos — sleek, encouraging, science-backed, and concise. Avoid fluff.
2. ZERO FAKE DATA RULE: Reference ONLY the provided user metrics. If a metric (e.g. sleep, VO2 Max, weight) is listed as 'Not recorded' or 'Not calibrated', explicitly state that you don't have that data yet and gently invite the user to log it in Nocturne. NEVER invent or fabricate numbers.
3. Medical Disclaimer: Always adhere to wellness coaching boundaries. You are not a medical professional. If discussing injuries, chest pain, or severe symptoms, advise consulting a physician.
4. MUSIC INTENT DETECTION:
When the user asks to play music, pause, resume, change track, or stop music, you MUST output a JSON action block on the very last line of your response enclosed in [ACTION]...[/ACTION].
Supported Actions:
- [ACTION]{"type":"PLAY_SONG","query":"<song and artist>"}[/ACTION] (e.g. for "play Eye of the Tiger", "play some techno", "put on workout beats")
- [ACTION]{"type":"PAUSE_MUSIC"}[/ACTION]
- [ACTION]{"type":"RESUME_MUSIC"}[/ACTION]
- [ACTION]{"type":"NEXT_TRACK"}[/ACTION]
- [ACTION]{"type":"STOP_MUSIC"}[/ACTION]
5. MEAL LOG INTENT DETECTION:
When the user tells you about food or drink they consumed (e.g. "I ate 2 rotis and dal", "logged 500 kcal salad for lunch", "had an apple and whey protein shake"), estimate the nutrition and output a LOG_MEAL action block:
- [ACTION]{"type":"LOG_MEAL","description":"<food summary>","mealType":"breakfast"|"lunch"|"dinner"|"snack","calories":<int>,"proteinG":<float>,"carbsG":<float>,"fatsG":<float>}[/ACTION]
If the user mentions food, you should also acknowledge it warmly and give feedback on how it fits their recovery or fitness goal.
If no music or meal intent is requested, do NOT include any [ACTION] block.

${voiceGuidelines}

${healthContextPrompt}
`;

    // 3. Save incoming user message
    await prisma.aiChatMessage.create({
      data: {
        userId,
        role: 'user',
        content: message
      }
    });

    // 4. Load recent message history for context (up to 10 previous messages)
    const recentHistory = await prisma.aiChatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    recentHistory.reverse();

    // 5. Generate Response via Google GenAI SDK (gemini-2.5-flash)
    const apiKey = process.env.GEMINI_API_KEY;
    let replyContent = '';

    if (!apiKey) {
      if (mode === 'voice') {
        replyContent = `Hello ${user.displayName}! I am your Nocturne Voice Coach. To activate live Gemini intelligence, please set your GEMINI_API_KEY in the backend.`;
      } else {
        replyContent = `Hello ${user.displayName}! I am your Nocturne AI Coach. To activate live Gemini intelligence, please configure your \`GEMINI_API_KEY\` in \`backend/.env\`. In the meantime, your logged workouts and biometrics are securely synchronized in your Obsidian Kinetic vault!`;
      }
    } else {
      const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
      const contents = recentHistory.map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
          maxOutputTokens: mode === 'voice' ? 180 : 500
        }
      });

      replyContent = response.text || (mode === 'voice' ? 'I am Friday. Ready for your session!' : 'I am Friday. Ready to help you analyze your training and recovery!');
    }

    // Parse structured music intent action if returned
    let action: any = null;
    const actionMatch = replyContent.match(/\[ACTION\](.*?)\[\/ACTION\]/s);
    if (actionMatch) {
      try {
        action = JSON.parse(actionMatch[1].trim());
        // Strip [ACTION] block from user-facing text
        replyContent = replyContent.replace(/\[ACTION\].*?\[\/ACTION\]/s, '').trim();
      } catch (e) {
        console.warn('Failed to parse music intent JSON:', actionMatch[1]);
      }
    }

    // Fallback regex detection for common direct music commands
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

    // If action is LOG_MEAL, save it directly to database for the user!
    if (action && action.type === 'LOG_MEAL') {
      try {
        await prisma.mealLog.create({
          data: {
            userId,
            description: action.description || message,
            mealType: action.mealType || 'snack',
            caloriesKcal: Number(action.calories) || 300,
            proteinG: Number(action.proteinG) || 10,
            carbsG: Number(action.carbsG) || 30,
            fatsG: Number(action.fatsG) || 8,
            loggedAt: new Date()
          }
        });
      } catch (err) {
        console.warn('Failed to auto-persist AI logged meal:', err);
      }
    }

    // Clean spoken summary (strip asterisks, hashtags, backticks if any slipped through)
    const spokenSummary = replyContent
      .replace(/[*#`_~[\]]/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    // 6. Save AI reply in database
    const savedReply = await prisma.aiChatMessage.create({
      data: {
        userId,
        role: 'model',
        content: replyContent
      }
    });

    return res.json({
      status: 'success',
      reply: {
        id: savedReply.id,
        role: savedReply.role,
        content: savedReply.content,
        createdAt: savedReply.createdAt.toISOString()
      },
      spokenSummary,
      action
    });
  } catch (error: any) {
    console.error('AI Coach Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to communicate with AI Coach' });
  }
});

export default router;
