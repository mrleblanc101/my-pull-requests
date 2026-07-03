export default defineEventHandler(async () => {
  const octokit = useOctokit()
  // Fetch user from token
  const userResponse = await octokit.request('GET /user')
  const user: User = {
    name: userResponse.data.name ?? userResponse.data.login,
    username: userResponse.data.login,
    avatar: userResponse.data.avatar_url,
  }
  const hidePrivateRepos = process.env.HIDE_PRIVATE_REPOS === 'true'
  const excludeRepos = process.env.EXCLUDE_REPOS?.split(',').map(repo => repo.trim()).filter(Boolean) ?? []
  const excludeOrgs = process.env.EXCLUDE_ORGS?.split(',').map(org => org.trim()).filter(Boolean) ?? []
  const prCount = Number(process.env.PR_COUNT ?? 50)

  // Fetch pull requests from user
  const queryParts = [
    `is:pr`,
    '(is:open+OR+is:merged)',
    `author:"${user.username}"`,
    hidePrivateRepos ? 'is:public' : null,
    ...excludeRepos.map(repo => `-repo:${repo}`),
    ...excludeOrgs.map(org => `-org:${org}`),
  ].filter(Boolean)

  const { data } = await octokit.request('GET /search/issues', {
    q: queryParts.join('+'),
    per_page: prCount,
    page: 1,
    advanced_search: 'true',
  })

  console.log(data.items.length)

  const prs: PullRequest[] = []
  // For each PR, fetch the repository details
  for (const pr of data.items) {
    const [owner, name] = pr.repository_url.split('/').slice(-2)
    const repo = await fetchRepo(owner!, name!)

    prs.push({
      repo: `${owner}/${name}`,
      title: pr.title,
      url: pr.html_url,
      created_at: pr.created_at,
      state: pr.pull_request?.merged_at ? 'merged' : pr.draft ? 'draft' : pr.state as 'open' | 'closed',
      number: pr.number,
      type: repo.owner.type, // Add type information (User or Organization)
      stars: repo.stargazers_count,
    })
  }

  return {
    user,
    prs,
  } as Contributions
})
