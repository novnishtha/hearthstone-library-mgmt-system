const { GoogleGenAI } = require('@google/genai');
const { AppError } = require('../middleware/errorHandler');

/**
 * Generate a concise library catalog description for a book using Gemini.
 */
async function generateBookDescription({ title, author, category, publishedYear }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AppError(
      'GEMINI_API_KEY is not configured in .env. Add your Gemini API key to use AI generation.',
      503
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const yearNote = publishedYear ? ` (${publishedYear})` : '';
  const prompt =
    `Write a concise, engaging 2-sentence library catalog description (under 400 characters, plain text, no markdown) ` +
    `for the book "${title}" by ${author}${yearNote} in the category "${category || 'General'}".`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  const text = (response.text || '').trim();
  if (!text) {
    throw new AppError('AI did not return a description. Please try again.', 502);
  }

  return text.slice(0, 500);
}

module.exports = { generateBookDescription };
