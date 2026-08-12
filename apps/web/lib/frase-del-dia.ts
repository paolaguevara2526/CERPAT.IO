// La frase del día en el inicio del planeador.
//
// Dos decisiones que se ven en el código:
//
//  1. Es la MISMA para todo el equipo cada día. Si cada quien viera una
//     distinta no habría de qué hablar en la mañana; siendo la misma, se puede
//     comentar. Por eso el índice sale del día del año y no de un azar.
//  2. El día se calcula en la hora de Colombia, no en la del servidor. En
//     Railway el reloj va en UTC, así que a partir de las 7 p. m. la frase
//     habría cambiado antes de que terminara la jornada — el mismo desfase que
//     nos corrió las fechas de captura un día.
//
// Sobre el tono: hablan del oficio, no de "echarle ganas". Quien las lee lleva
// nueve horas cuadrando cifras y nota la diferencia entre que le hablen de su
// trabajo o le receten optimismo.

export const FRASES: string[] = [
  'Un número bien puesto hoy le ahorra una sanción a alguien mañana.',
  'La confianza de un cliente se construye con entregas puntuales, no con promesas.',
  'Revisar dos veces cuesta minutos; corregir después cuesta días.',
  'Cada conciliación que cierra es una preocupación menos para alguien.',
  'No estamos llenando formularios: estamos cuidando el patrimonio de una empresa.',
  'El detalle que nadie ve es el que sostiene el informe que todos leen.',
  'Preguntar a tiempo no es debilidad, es criterio.',
  'Lo urgente pasa; lo bien hecho queda.',
  'Detrás de cada NIT hay una familia que depende de que esto salga bien.',
  'A la cima no se llega de un salto: se llega un día hábil a la vez.',
  'Una novedad reportada a tiempo es un problema que no alcanzó a crecer.',
  'Quien revisa con cuidado también está haciendo el trabajo.',
  'El orden de hoy es la tranquilidad de fin de mes.',
  'Vale más una declaración presentada a tiempo que diez explicaciones después.',
  'Tu firma respalda cada cifra. Que valga lo que vale.',
  'Aprender algo nuevo hoy es trabajar más fácil mañana.',
  'El cliente no ve el proceso, pero sí siente el resultado.',
  'Un equipo que se avisa a tiempo llega junto.',
  'La calma también se planea: para eso existe el plan de trabajo.',
  'Hacer bien lo pequeño es el hábito que sostiene lo grande.',
  'Nadie recuerda quién terminó primero; sí quién lo hizo bien.',
  'Cerrar el mes no es apagar incendios: es haber prendido pocas fogatas.',
  'Un dato capturado con cuidado termina siendo una decisión acertada.',
  'Respetar la fecha límite es respetar el trabajo del que sigue.',
  'Hoy alguien duerme tranquilo porque tú revisaste ese anexo.',
  'Somos la diferencia entre cumplir y cumplir bien.',
  'Pedir ayuda temprano cuesta menos que arreglar tarde.',
  'La excelencia no es un esfuerzo extra: es la forma de hacer lo de siempre.',
  'Cada mes cerrado a tiempo es una montaña menos que cargar.',
  'Lo que se mide mejora; lo que se documenta perdura.',
  'La prisa se nota en los errores; el oficio, en que no los haya.',
  'Un archivo bien nombrado es un favor que te haces en diciembre.',
];

/** "YYYY-MM-DD" del día en Colombia, sin importar dónde corra esto. */
export function diaEnColombia(ahora: Date = new Date()): string {
  // en-CA da el formato ISO directo; el huso hace el trabajo de restar las horas.
  return ahora.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/** La frase que le toca a ese día. La misma para todo el equipo. */
export function fraseDelDia(ahora: Date = new Date(), frases: string[] = FRASES): string {
  if (frases.length === 0) return '';
  const [a, m, d] = diaEnColombia(ahora).split('-').map(Number);
  // Días transcurridos desde una fecha fija: avanza de a uno y no se reinicia
  // en enero, así que la frase del 31 de diciembre no se repite el 1 de enero.
  const dias = Math.floor(Date.UTC(a, m - 1, d) / 86400000);
  return frases[((dias % frases.length) + frases.length) % frases.length];
}
