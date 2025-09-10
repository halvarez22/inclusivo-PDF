# 🤖 Agente IA Inclusivo PDF

Una aplicación web que utiliza inteligencia artificial para analizar documentos PDF y sugerir alternativas de lenguaje más inclusivo.

## ✨ Características

- 📄 **Análisis de PDF**: Extrae texto de documentos PDF automáticamente
- 🤖 **IA Dual**: Sistema de fallback entre Gemini y Groq para máxima confiabilidad
- 👁️ **Comparación Visual**: Vista lado a lado con highlights de cambios sugeridos
- ✏️ **Edición en Tiempo Real**: Modifica el texto procesado directamente en la interfaz
- 💾 **Descarga**: Exporta el documento modificado como archivo de texto
- 🎨 **Diseño Moderno**: Interfaz responsive y profesional
- 🔄 **Sincronización**: Navegación sincronizada entre versiones original y modificada

## 🚀 Tecnologías

- **Frontend**: React 19 + TypeScript + Vite
- **IA**: Google Gemini + Groq (Llama 3.1)
- **PDF**: PDF.js para extracción de texto
- **Estilos**: Tailwind CSS
- **Despliegue**: Vercel

## 🛠️ Instalación Local

### Prerrequisitos
- Node.js 18+ 
- Cuentas de API para Gemini y/o Groq

### Pasos

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/halvarez22/inclusivo-PDF.git
   cd inclusivo-PDF
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   Crear archivo `.env.local`:
   ```env
   VITE_GEMINI_API_KEY=tu_api_key_de_gemini
   VITE_GROQ_API_KEY=tu_api_key_de_groq
   ```

4. **Ejecutar en desarrollo**
   ```bash
   npm run dev
   ```

5. **Abrir en el navegador**
   ```
   http://localhost:5173
   ```

## 🌐 Despliegue en Vercel

1. **Conectar repositorio** en [Vercel](https://vercel.com)
2. **Configurar variables de entorno**:
   - `VITE_GEMINI_API_KEY`
   - `VITE_GROQ_API_KEY`
3. **Desplegar automáticamente** desde GitHub

## 📖 Uso

1. **Subir PDF**: Arrastra o selecciona un documento PDF
2. **Análisis Automático**: La IA analiza el texto y sugiere cambios inclusivos
3. **Revisar Cambios**: Compara el original con la versión modificada
4. **Editar**: Haz ajustes manuales al texto procesado
5. **Descargar**: Exporta el resultado final

## 🔧 Configuración de APIs

### Google Gemini
1. Ve a [Google AI Studio](https://ai.google.dev/)
2. Crea una nueva API key
3. Agrega la key a las variables de entorno

### Groq (Opcional)
1. Ve a [Groq Console](https://console.groq.com/)
2. Crea una API key
3. Agrega la key a las variables de entorno

## 📝 Ejemplos de Uso

La aplicación identifica y sugiere cambios para:
- **Lenguaje de género**: "Los estudiantes" → "Las personas estudiantes"
- **Inclusión**: "Todos los hombres" → "Todas las personas"
- **Accesibilidad**: Términos más inclusivos y accesibles

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

© 2025 PAI-B. Todos los derechos reservados.

## 🆘 Soporte

Para soporte técnico o preguntas, contacta al equipo de desarrollo.
