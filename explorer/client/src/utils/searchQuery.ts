export type SearchQuery = string | undefined

/**
 * Parse the current query string out of the browser location
 *
 * @param location The location value to use, not hardcoded so we can inject
 * mock values for testing
 */
export function searchQuery(location: Location = window.location): SearchQuery {
  const searchParams = new URL(location.toString()).searchParams
  const search = searchParams.get('search')

  if (search) {
    return search
  }

  return
}
