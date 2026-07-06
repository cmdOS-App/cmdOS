export const buildUrl = (template: string, prompt: string): string => {
  const encoded = encodeURIComponent(prompt);

  return template
    .replace(/\{query\s*\}/gi, encoded)
    .replace(/\[query\s*\]/gi, encoded)
    .replace(/\{content\s*\}/gi, encoded)
    .replace(/\{prompt\s*\}/gi, encoded);
};
