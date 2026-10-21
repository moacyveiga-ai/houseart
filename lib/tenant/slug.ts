// Slugs for tenants, members and artists. Pure.
export function slugify(text: string): string {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item'
}

/** Unique slug: tries `base`, then `base-2`, `base-3`… against `taken`. */
export async function uniqueSlug(base: string, taken: (slug: string) => Promise<boolean>): Promise<string> {
  const root = slugify(base)
  if (!(await taken(root))) return root
  for (let i = 2; i < 1000; i++) {
    const candidate = `${root}-${i}`
    if (!(await taken(candidate))) return candidate
  }
  return `${root}-${Date.now()}`
}
