// PROMPT.md is bundled as a plain string (webpack's `asset/source` rule in both webpack configs).
declare module '*.md' {
  const text: string;
  export default text;
}
