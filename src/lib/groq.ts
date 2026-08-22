import Groq from 'groq-sdk';

export const CHAT_MODEL = 'llama-3.3-70b-versatile';
export const VISION_MODEL = 'llama-3.2-11b-vision-preview';

let _groq: Groq | null = null;

export function getGroq(): Groq {
  if (!_groq) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured');
    }
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}
