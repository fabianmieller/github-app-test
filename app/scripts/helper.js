const { basename, dirname } = require('path');

/** @description Check the folder
 * @param {string} folderName The name of the folder
 * @param {Object.<string, *>} files The files object
 * @param {Object.<string, *>} options The options object
 * @return {boolean}
 */

exports.checkFolder = (folderName, files, { context }) => {
    if (folderName === '.') {
        // close pr with comment
        context.github.issues.createComment(
            context.issue({
                body: 'You are not allowed to create a pull request in this directory.',
            })
        );
        context.github.issues.edit(context.issue({ state: 'closed' }));
        return false;
    }

    for (const file of files) {
        // get folder name and check with saved folder name
        // only one folder for one pull request
        if (dirname(file.filename) !== folderName) {
            return false;
        }
    }

    return true;
};

/** @description Check the maintainer
 * @param {Object.<string, *>} manifestData The manifest data object
 * @param {Object.<string, *>} options The options object
 * @return {boolean}
 */

exports.checkMaintainer = checkExecuteDecorator('Maintainer', (manifest, { user }) => {
    if (manifest) {

        // merge base check owner
        if (manifest.maintainer !== user.login) {
            throw {
                title: 'Pull request not allowed',
                summary: 'You are not allowed to create a pull request for this plugin.',
                cancel: true,
            }
        }
    }

    return {
        title: 'Pull request allowed',
    }
});

/** @description Check the maintainer
 * @param {Object.<string, *>} ajv The manifest data object
 * @param {string} schema The schema name
 * @param {Object.<string, *>} content The json object
 * @return {boolean|Object.<string, *>} Returns true or error object
 */

exports.validateSchema = (ajv, schema, content) => {
    let valid = ajv.validate(schema, content);
    if (!valid) {
        app.log(ajv.errorsText());
        return errorResponse(ajv.errors);
    }
    return true;
};

/** @description Create a check on github
 * @param {Object.<string, *>} options The options object
 * @param {string} name The name of the check
 * @param {string} status The status of the check
 * @param {string} conclusion The conclusion for the check
 * @param {Object.<string, *>} output The output for the check
 * @return {Object.<string, *>} Return the checks object
 */

exports.createChecks = (
    { contextChecks, sha: head_sha, org: owner, repo },
    name,
    conclusion,
    output
) => {
    ouput.summary = output.summary || '';
    return contextChecks.create({
        owner,
        repo,
        name,
        head_sha,
        status: 'completed',
        conclusion,
        completed_at: new Date().toISOString(),
        output,
    });
};

function errorResponse(schemaErrors) {
    let errors = schemaErrors.map(error => {
        return {
            path: error.dataPath,
            message: error.message,
        };
    });
    return {
        status: 'failed',
        errors: errors,
    };
}

function checkExecuteDecorator(title, fn) {
    return (...args) => {
        try {
            return exports.createChecks(options, title, 'success', {
                title: fn(...args),
            })
        } catch ({title, summary, cancel}) {
            if(cancel) {
                throw {title, summary};
            }
            return exports.createChecks(options, title, 'action_required', {
                title: error.msg,
                summary: error.summary,
            })
        }
    };
}
