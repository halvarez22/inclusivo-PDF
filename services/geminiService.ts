import { GoogleGenAI, Type } from "@google/genai";
import Groq from "groq-sdk";
import type { InclusiveChange } from '../types';

// Configuración de APIs
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;

const gemini = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;
const groq = groqApiKey ? new Groq({ 
  apiKey: groqApiKey, 
  dangerouslyAllowBrowser: true 
}) : null;

const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      original: {
        type: Type.STRING,
        description: "La frase original exacta del texto que no es inclusiva."
      },
      inclusive: {
        type: Type.STRING,
        description: "La versión reescrita y más inclusiva de la frase."
      },
    },
    required: ["original", "inclusive"],
  },
};

// Función para procesar sugerencias con Gemini
const getSuggestionsWithGemini = async (text: string): Promise<Omit<InclusiveChange, 'id'>[]> => {
  if (!gemini) {
    throw new Error("API de Gemini no configurada");
  }

  const prompt = `
    Analiza el siguiente texto e identifica todas las frases que podrían reescribirse utilizando un lenguaje más inclusivo.
    Tu objetivo es ser útil y constructivo, no cambiar radicalmente el significado original. Céntrate en el lenguaje de género, discapacidades y otras áreas comunes de mejora.
    Para cada frase que identifiques, proporciona la frase original y un reemplazo más inclusivo.
    Responde ÚNICAMENTE con un array de objetos JSON válido, donde cada objeto tenga dos claves: "original" e "inclusive".
    Si no se necesitan cambios o el texto ya es inclusivo, devuelve un array vacío [].

    TEXTO A ANALIZAR:
    ---
    ${text}
    ---
  `;

  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    },
  });
  
  const jsonString = response.text;
  const suggestions = JSON.parse(jsonString);

  if (!Array.isArray(suggestions)) {
      throw new Error("La API de Gemini no devolvió un array válido.");
  }
  
  return suggestions.filter(s => s.original && s.inclusive && s.original.trim() !== '' && s.inclusive.trim() !== '');
};

// Función para procesar sugerencias con Groq
const getSuggestionsWithGroq = async (text: string): Promise<Omit<InclusiveChange, 'id'>[]> => {
  if (!groq) {
    throw new Error("API de Groq no configurada");
  }

  const prompt = `
    Analiza el siguiente texto e identifica todas las frases que podrían reescribirse utilizando un lenguaje más inclusivo.
    Tu objetivo es ser útil y constructivo, no cambiar radicalmente el significado original. Céntrate en el lenguaje de género, discapacidades y otras áreas comunes de mejora.
    Para cada frase que identifiques, proporciona la frase original y un reemplazo más inclusivo.
    Responde ÚNICAMENTE con un array de objetos JSON válido, donde cada objeto tenga dos claves: "original" e "inclusive".
    Si no se necesitan cambios o el texto ya es inclusivo, devuelve un array vacío [].

    TEXTO A ANALIZAR:
    ---
    ${text}
    ---
  `;

  const response = await groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    model: "llama-3.1-8b-instant",
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No se recibió respuesta de Groq");
  }

  // Intentar parsear como JSON array directamente
  let suggestions;
  try {
    suggestions = JSON.parse(content);
  } catch {
    // Si no es JSON válido, intentar extraer el array del texto
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      suggestions = JSON.parse(arrayMatch[0]);
    } else {
      throw new Error("No se pudo parsear la respuesta de Groq como JSON");
    }
  }

  // Asegurar que sea un array
  if (!Array.isArray(suggestions)) {
    suggestions = [];
  }

  if (!Array.isArray(suggestions)) {
    throw new Error("La API de Groq no devolvió un array válido.");
  }

  return suggestions.filter(s => s.original && s.inclusive && s.original.trim() !== '' && s.inclusive.trim() !== '');
};

// Función principal con sistema de fallback
export const getInclusiveSuggestions = async (text: string): Promise<Omit<InclusiveChange, 'id'>[]> => {
  const errors: string[] = [];

  // Intentar primero con Gemini
  if (gemini) {
    try {
      console.log("🤖 Intentando con Gemini...");
      const suggestions = await getSuggestionsWithGemini(text);
      console.log("✅ Sugerencias obtenidas con Gemini");
      return suggestions;
    } catch (error) {
      let errorMsg = "Error desconocido con Gemini";
      if (error instanceof Error) {
        errorMsg = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // Manejar errores de API de Gemini
        const apiError = error as any;
        if (apiError.error?.message) {
          errorMsg = `API Error: ${apiError.error.message}`;
        } else if (apiError.message) {
          errorMsg = apiError.message;
        }
      }
      console.warn("❌ Error con Gemini:", errorMsg);
      errors.push(`Gemini: ${errorMsg}`);
    }
  } else {
    console.warn("⚠️ Gemini no configurado");
  }

  // Si Gemini falla, intentar con Groq
  if (groq) {
    try {
      console.log("🚀 Intentando con Groq...");
      const suggestions = await getSuggestionsWithGroq(text);
      console.log("✅ Sugerencias obtenidas con Groq");
      return suggestions;
    } catch (error) {
      let errorMsg = "Error desconocido con Groq";
      if (error instanceof Error) {
        errorMsg = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // Manejar errores de API de Groq
        const apiError = error as any;
        if (apiError.error?.message) {
          errorMsg = `API Error: ${apiError.error.message}`;
        } else if (apiError.message) {
          errorMsg = apiError.message;
        }
      }
      console.warn("❌ Error con Groq:", errorMsg);
      errors.push(`Groq: ${errorMsg}`);
    }
  } else {
    console.warn("⚠️ Groq no configurado");
  }

  // Si ambas APIs fallan
  const friendlyMessage = "Las APIs de IA están temporalmente no disponibles. Por favor, intenta de nuevo en unos minutos.";
  console.error("💥 Ambas APIs fallaron:", errors);
  throw new Error(friendlyMessage);
};