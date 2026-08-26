const ansiPattern = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g

export function stripAnsi(value: string): string {
  return value.replace(ansiPattern, "")
}

export function cleanText(value: string): string {
  return stripAnsi(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim()
}

export function truncate(value: string, maxLength: number): string {
  const text = cleanText(value)
  if (text.length <= maxLength) return text
  if (maxLength <= 1) return text.slice(0, maxLength)
  return `${text.slice(0, maxLength - 1).trimEnd()}…`
}
