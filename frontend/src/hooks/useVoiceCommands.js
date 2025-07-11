import { useState, useEffect, useRef } from 'react';

// Definiciones de comandos y sus valores
const COMMAND_MAP = {
  // Herramientas
  "borrar": 'eraser',
  "seleccionar": 'select',
  "texto": 'text',
  "lápiz": 'pencil',
  "lapiz": 'pencil', // Por si acaso
  "rotulador": 'marker',
  // Figuras
  "cuadrado": 'square',
  "círculo": 'circle',
  "circulo": 'circle', // Por si acaso
  "triángulo": 'triangle',
  "triangulo": 'triangle', // Por si acaso
  "rombo": 'diamond',
  "estrella": 'star',
  "pentágono": 'pentagon',
  "pentagono": 'pentagon', // Por si acaso
  "flecha derecha": 'arrowRight',
  "flecha izquierda": 'arrowLeft',
  "línea": 'line',
  "linea": 'line', // Por si acaso
};

// Mapeo de colores a valores hexadecimales
const COLOR_MAP = {
  "negro": '#000000',
  "blanco": '#FFFFFF',
  "rojo": '#FF0000',
  "verde": '#00FF00',
  "azul": '#0000FF',
  "amarillo": '#FFFF00',
  "magenta": '#FF00FF',
  "cian": '#00FFFF',
  "naranja": '#FFA500',
};

// Tamaños de fuente reconocibles
const FONT_SIZE_MAP = {
  "doce": 12, "catorce": 14, "dieciséis": 16, "dieciseis": 16,
  "dieciocho": 18, "veinticuatro": 24, "treinta y dos": 32, "treintados": 32,
  "cuarenta y ocho": 48, "cuarentayocho": 48,
};


export function useVoiceCommands(onCommandRecognized) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Verificar si el navegador soporta SpeechRecognition
    if (!('webkitSpeechRecognition' in window)) {
      console.warn("Speech Recognition no soportado en este navegador.");
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    
    // MODIFICADO: Este es el único cambio para que la escucha no se detenga.
    recognition.continuous = true;
    
    recognition.interimResults = false; // Solo dar resultados finales
    recognition.lang = 'es-ES'; // Idioma español

    recognition.onresult = (event) => {
      // Para el modo continuo, es mejor obtener siempre el último resultado.
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.toLowerCase().trim();
      
      console.log("[VoiceCommand] Transcripción:", transcript);
      
      // Procesar el comando
      let command = null;
      let param = null;

      // Intentar reconocer herramientas
      for (const key in COMMAND_MAP) {
        if (transcript.includes(key)) {
          command = 'tool';
          param = COMMAND_MAP[key];
          break;
        }
      }

      // Si no es una herramienta, intentar reconocer color
      if (!command) {
        for (const key in COLOR_MAP) {
          if (transcript.includes(`color ${key}`)) {
            command = 'color';
            param = COLOR_MAP[key];
            break;
          }
        }
      }

      // Si no es color, intentar reconocer tamaño de fuente
      if (!command) {
        for (const key in FONT_SIZE_MAP) {
          if (transcript.includes(`tamaño ${key}`)) {
            command = 'fontSize';
            param = FONT_SIZE_MAP[key];
            break;
          }
        }
      }
      // También si dice solo el número (ej. "tamaño 24")
      if (!command) {
        const match = transcript.match(/tamaño (\d+)/);
        if (match && match[1]) {
          const num = Number(match[1]);
          // Comprobamos si el número existe como valor en nuestro mapa
          if (Object.values(FONT_SIZE_MAP).includes(num)) {
             command = 'fontSize';
             param = num;
          }
        }
      }


      if (command && onCommandRecognized) {
        onCommandRecognized({ type: command, value: param });
      } else {
        console.warn("[VoiceCommand] Comando no reconocido:", transcript);
      }
    };

    recognition.onend = () => {
      // En modo continuo, onend solo se llama si se detiene manualmente o por error.
      // Así que simplemente actualizamos el estado.
      setIsListening(false);
      console.log("[VoiceCommand] Dejó de escuchar.");
    };

    recognition.onerror = (event) => {
      console.error("[VoiceCommand] Error de reconocimiento:", event.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onCommandRecognized]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      recognitionRef.current.start();
      console.log("[VoiceCommand] Empezó a escuchar...");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      console.log("[VoiceCommand] Deteniendo escucha...");
    }
  };

  return { isListening, startListening, stopListening };
}