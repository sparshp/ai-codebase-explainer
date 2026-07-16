/** Returns an error message, or null if the URL looks like a public GitHub repo. */
export function validateGitHubRepoUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return 'Enter a GitHub repository URL'

  const ok =
    /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?(?:\.git)?\/?$/i.test(trimmed)

  if (!ok) {
    return 'Only public GitHub repository URLs are supported (e.g. https://github.com/owner/repo)'
  }
  return null
}
