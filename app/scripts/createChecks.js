/** @description Create a check on github
 * @param {Object.<string, *>} checks The github checks object
 * @param {Object.<string, *>} pr The pull request object
 * @param {string} owner The name of the owner
 * @param {string} repo The name of the repository
 * @param {string} name The name of the check
 * @param {string} status The status of the check
 * @param {string} conclusion The output for the check
 * @param {Object.<string, *>} output The output for the check
 * @return {Object.<string, *>}
 */

exports.createChecks = (checks, pr, owner, repo, name, status, conclusion, output) => {
    return checks.create({
        owner,
        repo,
        name,
        head_sha: pr.head.sha,
        status,
        conclusion,
        completed_at: new Date().toISOString(),
        output
    });
}
