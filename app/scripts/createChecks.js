/** @description Create a check on github
 * @param {Object.<string, *>} pr The pull request object
 * @param {string} name The name of the check
 * @param {string} status The status of the check
 * @param {string} conclusion The output for the check
 * @param {Object.<string, *>} output The output for the check
 * @return {Object.<string, *>}
 */

exports.createChecks = (ckecks, pr, name, status, conclusion, output) => {
    return checks.create({
        owner: org,
        repo: repo,
        name,
        head_sha: pr.head.sha,
        status,
        conclusion,
        completed_at: new Date().toISOString(),
        output
    });
}
