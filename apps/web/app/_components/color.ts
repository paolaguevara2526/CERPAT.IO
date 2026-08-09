// Transparencia sobre un color de estado.
//
// Los chips y las franjas de estado se pintaban concatenando el hex con su alfa
// (`${color}18` → "#cf443618"). Ese truco solo funciona con hex: al pasar los
// estados a variables de tema, "var(--peligro)18" es CSS inválido y el chip se
// quedaba sin fondo. `color-mix` hace lo mismo y funciona con cualquier color,
// incluidas las variables, así que los chips siguen al tema claro/oscuro.

export function tinte(color: string, porcentaje: number): string {
  return `color-mix(in srgb, ${color} ${porcentaje}%, transparent)`;
}
