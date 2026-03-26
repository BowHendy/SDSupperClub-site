/** Path to a Netlify Function on the same origin (works on Netlify and `netlify dev`). */
export function netlifyFunctionUrl(name: string): string {
  return `/.netlify/functions/${name}`;
}
