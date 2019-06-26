const { basename, dirname } = require('path');

/** @description Check the folder
 * @param {string} folderName The name of the folder
 * @param {Object.<string, *>} files The files object
 * @param {Object.<string, *>} options The options object
 * @return {Boolean}
 */

exports.checkFolder = (folderName, files, {app, context}) => {

    if(folderName === '.') {
        // close pr with comment
        context.github.issues.createComment(context.issue({body: 'You are not allowed to create a pull request in this directory.'}))
        context.github.issues.edit(context.issue({state: 'closed'}))
        return false;
    }

    for (const file of files.data) {
        // get folder name and check with saved folder name
        // only one folder for one pull request
        app.log(`Filename: ${basename(file.filename)}`);
        app.log(`Foldername: ${dirname(file.filename)}`);

        if(dirname(file.filename) !== folderName) {
            return false;
        }
    }

    return true;

}

/** @description Check the maintainer
 * @param {Object.<string, *>} manifestData The manifest data object
 * @return {Boolean}
 */

exports.checkMaintainer = ({data: {content: dataContent}}) => {

    const content = JSON.parse(
        Buffer.from(dataContent, 'base64').toString()
    );

    // merge base check owner
    return content.maintainer === user.login;
}

/** @description Create a check on github
 * @param {Object.<string, *>} options The options object
 * @param {string} name The name of the check
 * @param {string} status The status of the check
 * @param {string} conclusion The conclusion for the check
 * @param {Object.<string, *>} output The output for the check
 * @return {Object.<string, *>}
 */

exports.createChecks = ({checks, pr, owner, repo}, name, status, conclusion, output) => {
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
