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

// Detección basada en regex para términos críticos conocidos.
// Esto garantiza alto recall incluso si el modelo omite algunos patrones.
const extractRegexCandidates = (text: string): Omit<InclusiveChange, "id">[] => {
  const patterns: { pattern: RegExp; inclusive: string }[] = [
    { pattern: /los\s+ciudadanos/gi, inclusive: "la ciudadanía" },
    { pattern: /los\s+habitantes/gi, inclusive: "la población" },
    { pattern: /los\s+presidentes\s+municipales/gi, inclusive: "las presidencias municipales" },
    { pattern: /los\s+funcionarios/gi, inclusive: "el funcionariado" },
    { pattern: /los\s+interesados/gi, inclusive: "las personas interesadas" },
    { pattern: /los\s+propietarios/gi, inclusive: "las personas propietarias" },
    { pattern: /los\s+administradores/gi, inclusive: "las personas administradoras" },
    { pattern: /los\s+gerentes/gi, inclusive: "las personas gerentes" },
    { pattern: /los\s+encargados/gi, inclusive: "las personas encargadas" },
    { pattern: /los\s+responsables/gi, inclusive: "las personas responsables" },
    { pattern: /los\s+verificadores/gi, inclusive: "las personas verificadoras" },
    { pattern: /los\s+infractores/gi, inclusive: "las personas infractoras" },
  ];

  const results: Omit<InclusiveChange, "id">[] = [];
  const seen = new Set<string>();
  const lowerText = text.toLowerCase();

  for (const { pattern, inclusive } of patterns) {
    pattern.lastIndex = 0;
    const matches = lowerText.match(pattern);
    if (!matches) continue;
    for (const m of matches) {
      const original = m.trim();
      const key = original.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ original, inclusive });
    }
  }

  return results;
};

// Función para procesar sugerencias con Gemini
const getSuggestionsWithGemini = async (text: string): Promise<Omit<InclusiveChange, 'id'>[]> => {
  if (!gemini) {
    throw new Error("API de Gemini no configurada");
  }

  const prompt = `
Eres un editor experto en comunicación inclusiva, accesible y no discriminatoria, especializado en lenguaje administrativo, institucional, legal y técnico.

TU OBJETIVO PRINCIPAL:
Analizar exhaustivamente el texto proporcionado e identificar TODAS las palabras, frases o expresiones que puedan reescribirse utilizando lenguaje inclusivo, manteniendo el significado original, la precisión técnica, el registro formal y la validez jurídica del texto.

================================================================================
ESTRATEGIAS DE INCLUSIVIDAD (POR ORDEN DE PRIORIDAD)
================================================================================

1. SUSTANTIVOS COLECTIVOS O ABSTRACTOS (PRIORIDAD 1 - Más elegante en textos formales):
   - Los ciudadanos → La ciudadanía
   - Los alumnos → El alumnado / El estudiantado
   - Los trabajadores → El personal / La plantilla laboral / La fuerza laboral
   - Los funcionarios → El funcionariado / La función pública
   - Los habitantes → La población / Los habitantes (ya es inclusivo si se refiere a personas)
   - Los directores → La dirección / Las direcciones
   - Los coordinadores → La coordinación
   - Los presidentes municipales → Las presidencias municipales
   - El hombre (genérico) → La humanidad / Las personas / El ser humano
   - Los guanajuatenses → La población de Guanajuato
   - Los empleados → El personal / La plantilla

2. EXPLICITAR "PERSONAS" + ADJETIVO/PARTICIPIO EN FEMENINO (PRIORIDAD 2 - Más explícito):
   - Los interesados → Las personas interesadas
   - Los afectados → Las personas afectadas
   - Los responsables → Las personas responsables
   - Los representados → Las personas representadas
   - Los usuarios → Las personas usuarias
   - Los beneficiarios → Las personas beneficiarias
   - Los solicitantes → Las personas solicitantes
   - Los propietarios → Las personas propietarias
   - Los representantes → Las personas representantes
   - Los trabajadores → Las personas trabajadoras
   - Los funcionarios → Las personas funcionarias
   - Los directores → Las personas directoras
   - Los coordinadores → Las personas coordinadoras
   - Los habitantes → Las personas habitantes

3. DETECCIÓN DE PATRONES GRAMATICALES EXCLUYENTES:
   
   A) PRONOMBRES INDEFINIDOS EN MASCULINO:
      - "cada uno" → "cada persona"
      - "todos" → "todas las personas" / "la totalidad" / "el total"
      - "algunos" → "algunas personas"
      - "cualquiera" → "cualquier persona"
      - "nadie" → "ninguna persona"
      - "uno" (genérico) → "una persona"
      - "quien" → "la persona que"
   
   B) EXPRESIONES CON "HOMBRE":
      - "hombre de negocios" → "persona empresaria"
      - "el hombre de la calle" → "la persona común"
      - "hombre al agua" → "persona al agua"
   
   C) CONCORDANCIAS COMPLEJAS (REVISAR FRASE COMPLETA):
      - Ej: "Los trabajadores mexicanos deberán" → "Las personas trabajadoras mexicanas deberán"
      - Ej: "Los funcionarios públicos están" → "Las personas funcionarias públicas están"

4. LENGUAJE CAPACITISTA (Discriminación por discapacidad):
   - Discapacitado → Persona con discapacidad
   - Minusválido → Persona con discapacidad
   - Inválido → Persona con discapacidad
   - Normal → Común / habitual / sin discapacidad
   - Sano → Sin enfermedad / en buen estado de salud
   - Enfermo mental → Persona con enfermedad mental / persona con padecimiento mental
   - Retrasado mental → Persona con discapacidad intelectual
   - Autista (como sustantivo) → Persona con autismo / persona autista
   - Ciego/Sordo (como sustantivo) → Persona ciega / persona sorda
   - Víctima de → Persona que ha sufrido / persona afectada por
   - Sufre de → Tiene / vive con
   - Postrado en cama → Persona en cama / persona con movilidad reducida
   - Demente → Persona con demencia
   - Mudo → Persona muda / persona con dificultad del habla
   - Lisiado → Persona con discapacidad física

5. EDADISMO (Discriminación por edad):
   - Los viejos/ancianos → Las personas mayores / las personas adultas mayores
   - Tercera edad → Personas mayores / personas adultas mayores
   - Los jóvenes → Las personas jóvenes / la juventud
   - Los niños → La niñez / las infancias / las personas menores de edad
   - Los adolescentes → Las personas adolescentes
   - De la tercera → Persona mayor

6. OTROS SESGOS:
   
   A) SOCIOECONÓMICOS:
      - Los pobres → Las personas en situación de pobreza
      - Los ricos → Las personas con mayores recursos económicos
      - Indigente → Persona sin hogar / persona en situación de calle
      - Analfabeto → Persona que no sabe leer y escribir
   
   B) RACIALES/ÉTNICOS:
      - Los negros → Las personas negras / la población afrodescendiente
      - Los indios → Los pueblos originarios / las personas indígenas
      - Los gitanos → El pueblo gitano / las personas gitanas

================================================================================
INSTRUCCIONES ESPECÍFICAS DE APLICACIÓN
================================================================================

1. PRIORIDAD DE DETECCIÓN (Aplicar en este orden):
   - PRIMERO: Buscar sustantivos colectivos disponibles (ciudadanía, alumnado, personal)
   - SEGUNDO: Usar "Personas + adjetivo/participio" cuando no haya colectivo adecuado
   - TERCERO: Desdoblamiento (las y los) solo si es estrictamente necesario para claridad

2. CONCORDANCIA GRAMATICAL OBLIGATORIA:
   - Revisar TODA la frase donde aparezca el término a cambiar
   - Asegurar que artículos, adjetivos y participios concuerden con el nuevo sustantivo
   - Verificar género y número en toda la oración
   - Ejemplo correcto: "Los trabajadores mexicanos" → "Las personas trabajadoras mexicanas"
   - Ejemplo incorrecto: "Los trabajadores mexicanos" → "Las personas trabajadores mexicanos"

3. ANÁLISIS DE CONTEXTO (Considerar antes de cambiar):
   - ¿Es un texto legal/administrativo? → Priorizar precisión técnica y validez jurídica
   - ¿Es un texto educativo? → Priorizar claridad pedagógica
   - ¿Es un texto publicitario? → Priorizar naturalidad y fluidez
   - ¿El término ya es inclusivo por contexto? → NO CAMBIAR
   - ¿El cambio altera el significado técnico/legal? → Buscar alternativa equivalente

4. QUÉ NO CAMBIAR (FALSOS POSITIVOS - Evitar estos errores):
   
   A) SUSTANTIVOS EPICENOS (un solo género gramatical para ambos sexos):
      - "La persona" (ya es inclusivo)
      - "La víctima"
      - "El testigo"
      - "El/la intérprete"
      - "La autoridad"
      - "El/la agente"
      - "La pareja"
   
   B) SUSTANTIVOS COLECTIVOS YA INCLUSIVOS:
      - "La ciudadanía"
      - "El alumnado"
      - "El personal"
      - "La plantilla"
      - "El funcionariado"
      - "La población"
      - "La humanidad"
   
   C) NOMBRES PROPIOS Y TÍTULOS ESPECÍFICOS:
      - "El Rey" (cuando se refiere a un cargo específico con nombre propio)
      - "El Presidente" (cuando es un cargo específico: "el Presidente de la República")
      - Nombres de leyes, decretos, instituciones oficiales
      - Nombres propios de persona
   
   D) CITAS TEXTUALES:
      - No modificar citas literales de leyes, sentencias, documentos históricos
      - No modificar nombres de cargos cuando son parte de una denominación oficial
   
   E) TÉRMINOS TÉCNICOS ESPECÍFICOS:
      - "Hombre" en contextos científicos/históricos específicos
      - Términos que pierdan significado técnico al cambiarse

5. ESCAPADO DE CARACTERES ESPECIALES:
   - Escapar correctamente comillas dobles: \" → \\\"
   - Escapar saltos de línea: nueva línea → \\n
   - Escapar barras invertidas: \\ → \\\\
   - Asegurar que el JSON sea válido y parseable

================================================================================
FORMATO DE RESPUESTA (ESTRICTO)
================================================================================

- Responde ÚNICAMENTE con un array de objetos JSON válido.
- NO uses bloques de código markdown (sin \`\`\`json).
- NO incluyas texto explicativo antes o después del JSON.
- NO agregues comentarios, notas o explicaciones.
- Cada objeto debe tener exactamente DOS claves: "original" e "inclusive".
- Si no se necesitan cambios, devuelve un array vacío: []
- Si el texto ya es inclusivo, devuelve: []

ESTRUCTURA REQUERIDA:
[
  {"original": "texto original exacto", "inclusive": "texto inclusivo sugerido"},
  {"original": "otro texto", "inclusive": "otra sugerencia"}
]

EJEMPLOS DE SALIDA VÁLIDA:
[
  {"original": "los ciudadanos", "inclusive": "la ciudadanía"},
  {"original": "los interesados", "inclusive": "las personas interesadas"},
  {"original": "discapacitado", "inclusive": "persona con discapacidad"},
  {"original": "los trabajadores mexicanos", "inclusive": "las personas trabajadoras mexicanas"},
  {"original": "los habitantes del Estado", "inclusive": "la población del Estado"}
]

================================================================================
TEXTO A ANALIZAR
================================================================================

${text}
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

// Función para procesar sugerencias con Groq (Llama 3.1 8B)
const getSuggestionsWithGroq = async (text: string): Promise<Omit<InclusiveChange, 'id'>[]> => {
  if (!groq) {
    throw new Error("API de Groq no configurada");
  }

  const prompt = `
Eres un detector de lenguaje no inclusivo en documentos legales en español.

TU ÚNICA TAREA:
Buscar en el texto frases EXACTAS que cumplan ESTE patrón:
  "los" + [sustantivo/adjetivo en masculino plural] que se refiera a grupos de PERSONAS.

TÉRMINOS QUE DEBES BUSCAR ACTIVAMENTE (solo si aparecen en el texto):
- "los ciudadanos" → "la ciudadanía"
- "los habitantes" → "la población" o "las personas habitantes"
- "los presidentes municipales" → "las presidencias municipales"
- "los funcionarios" → "el funcionariado"
- "los interesados" → "las personas interesadas"
- "los propietarios" → "las personas propietarias"
- "los administradores" → "las personas administradoras"
- "los gerentes" → "las personas gerentes"
- "los encargados" → "las personas encargadas"
- "los responsables" → "las personas responsables"
- "los verificadores" → "las personas verificadoras"
- "los infractores" → "las personas infractoras"

REGLAS ESTRICTAS:
1. SOLO detecta frases que aparezcan LITERALMENTE en el texto.
2. NO inventes ejemplos ni uses frases que solo aparezcan en este prompt.
3. NO cambies frases que ya son inclusivas o neutras: "los testigos", "la víctima", "las personas", "los particulares", "los seres humanos".
4. NO hagas correcciones gramaticales generales (como tiempos verbales); SOLO cambios para lenguaje inclusivo.

FORMATO DE RESPUESTA:
Devuelve exclusivamente un array JSON:
[
  {"original": "frase exacta del texto", "inclusive": "sugerencia inclusiva"},
  {"original": "otra frase", "inclusive": "otra sugerencia"}
]
Si no hay nada que cambiar, responde: []

TEXTO:
---
${text}
---
`;

  const response = await groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: prompt
      },
    ],
    model: "llama-3.1-8b-instant",
    temperature: 0.35,
    top_p: 0.9,
    max_tokens: 2048,
    stop: ["```", "```json", "\n\n"],
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

  // Filtro post-LLM:
  // - Campos presentes y no vacíos
  // - original !== inclusive (ignorando mayúsculas y espacios)
  // - original aparece literalmente en el texto analizado
  const lowerText = text.toLowerCase();
  const blacklist = [
    "seres humanos",
    "particulares",
    "agravios",
    "agravio",
    "ayuntamientos",
    "mismo sabed",
    "testigos",
    "víctima",
    "testigos",
    "víctima",
    "consejos municipales",
    "programas municipales",
    "participantes",
  ];

  const normalize = (s: string) =>
    s
      .replace(/\s+/g, " ")
      .replace(/[.,;:!?]/g, "")
      .trim();

  return suggestions.filter((s: any) => {
    if (!s || typeof s.original !== "string" || typeof s.inclusive !== "string") return false;
    const orig = normalize(s.original);
    const incl = normalize(s.inclusive);
    const origLower = orig.toLowerCase();
    if (!orig || !incl) return false;
    if (origLower === incl.toLowerCase()) return false;
    // Debe empezar por "los " (masculino plural genérico)
    if (!origLower.startsWith("los ")) return false;
    // No aceptar términos conocidos como neutros o fuera de scope
    if (blacklist.some(term => origLower.includes(term))) return false;
    // Debe existir literalmente en el texto
    if (!lowerText.includes(origLower)) return false;
    return true;
  });
};

// Función principal con sistema de fallback
export const getInclusiveSuggestions = async (text: string): Promise<Omit<InclusiveChange, 'id'>[]> => {
  const errors: string[] = [];
  const estimateTokens = (s: string) => Math.ceil(s.length / 4);
  const maxTokens = 4000;
  // Ajustes pensados para Llama 3.1 8B (Groq)
  const maxChunkChars = 2500;
  const overlapChars = 300;
  const splitIntoChunks = (s: string, maxLen: number, overlap: number) => {
    const chunks: string[] = [];
    let i = 0;
    while (i < s.length) {
      const end = Math.min(i + maxLen, s.length);
      chunks.push(s.slice(i, end));
      if (end >= s.length) break;
      i = Math.max(0, end - overlap);
    }
    return chunks;
  };
  const processWithFallback = async (s: string): Promise<Omit<InclusiveChange, 'id'>[]> => {
    const localErrors: string[] = [];
    if (groq) {
      try {
        console.log("🚀 Intentando con Groq...");
        const suggestions = await getSuggestionsWithGroq(s);
        console.log("✅ Sugerencias obtenidas con Groq");
        return suggestions;
      } catch (error) {
        let errorMsg = "Error desconocido con Groq";
        if (error instanceof Error) {
          errorMsg = error.message;
        } else if (typeof error === 'object' && error !== null) {
          const apiError = error as any;
          if (apiError.error?.message) {
            errorMsg = `API Error: ${apiError.error.message}`;
          } else if (apiError.message) {
            errorMsg = apiError.message;
          }
        }
        console.warn("❌ Error con Groq:", errorMsg);
        localErrors.push(`Groq: ${errorMsg}`);
      }
    } else {
      console.warn("⚠️ Groq no configurado");
    }
    errors.push(...localErrors);
    return [];
  };

  const tokens = estimateTokens(text);
  if (tokens <= maxTokens) {
    const single = await processWithFallback(text);
    if (single.length > 0) {
      // Fusionar sugerencias del modelo con candidatos detectados por regex (alta prioridad)
      const regexCandidates = extractRegexCandidates(text);
      const seen = new Set<string>();
      const merged: Omit<InclusiveChange, "id">[] = [];

      const normalizeKey = (s: string) =>
        s
          .replace(/\s+/g, " ")
          .replace(/[.,;:!?]/g, "")
          .trim()
          .toLowerCase();

      for (const s of [...single, ...regexCandidates]) {
        const normOriginal = s.original.replace(/\s+/g, " ").trim();
        const key = normalizeKey(normOriginal);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push({
          original: normOriginal,
          inclusive: s.inclusive.replace(/\s+/g, " ").trim(),
        });
      }

      // Filtro semántico adicional: evitar cambios que agregan demasiadas palabras
      const filtered = merged.filter(c => {
        const oWords = c.original.trim().split(/\s+/).length;
        const iWords = c.inclusive.trim().split(/\s+/).length;
        return iWords <= oWords + 2;
      });

      return filtered;
    }
  } else {
    console.log("✂️ Texto grande, aplicando chunking");
    const chunks = splitIntoChunks(text, maxChunkChars, overlapChars);
    const aggregated: Omit<InclusiveChange, 'id'>[] = [];
    for (const c of chunks) {
      const part = await processWithFallback(c);
      if (part.length > 0) {
        aggregated.push(...part);
      }
    }
    if (aggregated.length > 0) {
      // Añadir candidatos regex sobre el texto completo
      const regexCandidates = extractRegexCandidates(text);
      const all = [...aggregated, ...regexCandidates];
      const seen = new Set<string>();
      const dedup: Omit<InclusiveChange, 'id'>[] = [];

      const normalizeKey = (s: string) =>
        s
          .replace(/\s+/g, " ")
          .replace(/[.,;:!?]/g, "")
          .trim()
          .toLowerCase();

      for (const s of all) {
        const normOriginal = s.original.replace(/\s+/g, " ").trim();
        const key = normalizeKey(normOriginal);
        if (seen.has(key)) continue;
        seen.add(key);
        dedup.push({
          original: normOriginal,
          inclusive: s.inclusive.replace(/\s+/g, " ").trim(),
        });
      }

      const filtered = dedup.filter(c => {
        const oWords = c.original.trim().split(/\s+/).length;
        const iWords = c.inclusive.trim().split(/\s+/).length;
        return iWords <= oWords + 2;
      });

      return filtered;
    }
  }

  // Si ambas APIs fallan
  const friendlyMessage = "Las APIs de IA están temporalmente no disponibles. Por favor, intenta de nuevo en unos minutos.";
  console.error("💥 Ambas APIs fallaron:", errors);
  throw new Error(`${friendlyMessage} Detalle: ${errors.join(" | ")}`);
};
