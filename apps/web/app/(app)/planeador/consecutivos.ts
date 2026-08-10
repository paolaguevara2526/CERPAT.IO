// Contar documentos a partir de un rango de consecutivos.
//
// La cuenta es INCLUSIVA: de 100 a 105 hay 6 documentos, no 5. El 100 también se
// capturó. Restar a secas deja siempre uno menos, y ese error no se nota mirando
// la pantalla — solo cuando alguien cuadra los soportes contra el software.
//
// Los consecutivos rara vez son números limpios: vienen como CE-1045, FV 200 o
// 1045. Se toman los dígitos del final y se conserva lo demás como prefijo.
//
// Vive aparte porque lo usan la captura por lotes del auxiliar y el registro en
// software del asesor: dos pantallas contando lo mismo con reglas distintas es
// como aparecen diferencias que nadie sabe explicar.

/**
 * Cantidad de documentos entre dos consecutivos, ambos incluidos.
 * Devuelve '' cuando no se puede calcular: falta uno de los dos, no terminan en
 * dígitos, o el final es menor que el inicial. En ese caso se deja escribir a
 * mano en vez de mostrar un número inventado.
 */
export function contarConsecutivos(desde: string, hasta: string): string {
  const a = String(desde ?? '').match(/(\d+)\s*$/);
  const b = String(hasta ?? '').match(/(\d+)\s*$/);
  if (!a || !b) return '';
  const na = parseInt(a[1], 10);
  const nb = parseInt(b[1], 10);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return '';
  return nb >= na ? String(nb - na + 1) : '';
}
