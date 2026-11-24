import { Router, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router = Router();

const analyzeSchema = z.object({
  text: z.string().optional(),
  imageBase64: z.string().optional(),
  mimeType: z.string().optional().default('image/jpeg')
});

const logMealSchema = z.object({
  description: z.string().min(1),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).default('snack'),
  caloriesKcal: z.number().int().min(0),
  proteinG: z.number().min(0).default(0),
  carbsG: z.number().min(0).default(0),
  fatsG: z.number().min(0).default(0),
  imageUrl: z.string().optional(),
  loggedAt: z.string().datetime().optional()
});

// 1. POST /api/v1/nutrition/analyze - Multimodal / Text AI meal scanner via gemini-2.5-flash
router.post('/analyze', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = analyzeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid input', details: parseResult.error.format() });
    }

    const { text, imageBase64, mimeType } = parseResult.data;
    if (!text && !imageBase64) {
      return res.status(400).json({ error: 'Provide either meal text description or imageBase64' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'Gemini AI key not configured on backend. Please configure GEMINI_API_KEY in backend/.env to enable AI meal scanning.'
      });
    }

    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });

    const promptText = `
You are Friday, an expert nutritional scientist and diet AI for Nocturne Health & Fitness app.
Analyze the provided food meal (text or image) and provide accurate nutritional estimations.

STRICT INSTRUCTIONS:
1. Estimate:
   - items: array of individual detected items with quantity & estimated kcal
   - mealType: "breakfast" | "lunch" | "dinner" | "snack" (infer from food type or default to snack)
   - totalCalories: integer kcal
   - proteinG: float grams
   - carbsG: float grams
   - fatsG: float grams
   - summary: 1-2 concise, science-backed sentences about macro balance and micronutrient highlights.
2. Return strictly valid JSON with no markdown formatting, no backticks, no markdown fence.
Example format:
{
  "items": [{"name": "Roti", "quantity": "2 pieces", "calories": 160}, {"name": "Dal Tadka", "quantity": "1 bowl (150g)", "calories": 180}],
  "mealType": "lunch",
  "totalCalories": 340,
  "proteinG": 14.5,
  "carbsG": 55.0,
  "fatsG": 6.5,
  "summary": "Balanced Indian staple offering high complex carbohydrates and moderate plant-based lentil protein."
}
`;

    const parts: any[] = [{ text: promptText }];
    if (text) {
      parts.push({ text: `User meal description: "${text}"` });
    }
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: cleanBase64
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts }],
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    });

    const rawOutput = response.text || '{}';
    let parsedJson: any = {};
    try {
      parsedJson = JSON.parse(rawOutput.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Failed to parse nutrition estimation from AI model', raw: rawOutput });
    }

    return res.json({
      status: 'success',
      analysis: {
        items: parsedJson.items || [],
        mealType: parsedJson.mealType || 'snack',
        totalCalories: Number(parsedJson.totalCalories) || 0,
        proteinG: Number(parsedJson.proteinG) || 0,
        carbsG: Number(parsedJson.carbsG) || 0,
        fatsG: Number(parsedJson.fatsG) || 0,
        summary: parsedJson.summary || 'Nutritional breakdown computed.'
      }
    });
  } catch (error: any) {
    console.error('Nutrition analyze error:', error);
    return res.status(500).json({ error: error.message || 'Error analyzing nutrition' });
  }
});

// 2. POST /api/v1/nutrition/log - Save meal log
router.post('/log', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const parseResult = logMealSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid input', details: parseResult.error.format() });
    }

    const { description, mealType, caloriesKcal, proteinG, carbsG, fatsG, imageUrl, loggedAt } = parseResult.data;

    const meal = await prisma.mealLog.create({
      data: {
        userId,
        description,
        mealType,
        caloriesKcal,
        proteinG,
        carbsG,
        fatsG,
        imageUrl,
        loggedAt: loggedAt ? new Date(loggedAt) : new Date()
      }
    });

    return res.status(201).json({
      status: 'success',
      meal
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. GET /api/v1/nutrition/today - Get today's logs & summary against user goals
router.get('/today', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const dateParam = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const startOfDay = new Date(`${dateParam}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateParam}T23:59:59.999Z`);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { goalCalories: true, goalWeightKg: true, weightKg: true }
    });

    const meals = await prisma.mealLog.findMany({
      where: {
        userId,
        loggedAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      orderBy: { loggedAt: 'desc' }
    });

    const totalCalories = meals.reduce((sum, m) => sum + m.caloriesKcal, 0);
    const totalProteinG = Math.round(meals.reduce((sum, m) => sum + m.proteinG, 0) * 10) / 10;
    const totalCarbsG = Math.round(meals.reduce((sum, m) => sum + m.carbsG, 0) * 10) / 10;
    const totalFatsG = Math.round(meals.reduce((sum, m) => sum + m.fatsG, 0) * 10) / 10;

    const calorieTarget = user?.goalCalories || 2000;
    const remainingCalories = Math.max(0, calorieTarget - totalCalories);

    return res.json({
      status: 'success',
      date: dateParam,
      totals: {
        calories: totalCalories,
        targetCalories: calorieTarget,
        remainingCalories,
        proteinG: totalProteinG,
        carbsG: totalCarbsG,
        fatsG: totalFatsG,
        loggedMealCount: meals.length
      },
      meals
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 4. DELETE /api/v1/nutrition/:id - Remove meal
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    const existing = await prisma.mealLog.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Meal log not found or unauthorized' });
    }

    await prisma.mealLog.delete({ where: { id } });

    return res.json({ status: 'success', message: 'Meal log deleted' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
