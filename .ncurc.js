// customizes the behavior of `ncu -u` to exclude path-to-regexp due to two versions being included https://github.com/raineorshine/npm-check-updates
module.exports = {
  target: (name, semver) => {
    const isAlias = name === 'path-to-regexp' && parseInt(semver[0].major) === 0
    return isAlias ? 'patch' : 'latest'
  }
}
