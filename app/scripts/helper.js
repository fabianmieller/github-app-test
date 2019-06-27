/** @description Create a check on github
 * @param {Object.<string, *>} options The options object
 * @param {string} name The name of the check
 * @param {string} conclusion The conclusion for the check
 * @param {Object.<string, *>} output The output for the check
 * @return {Object.<string, *>} Return the checks object
 */

function createChecks(
    { contextChecks, sha: head_sha, org: owner, repo },
    name,
    conclusion,
    output
) {
    output.summary = output.summary || '';
    return contextChecks.create({
        owner,
        repo,
        name,
        head_sha,
        status: 'completed',
        conclusion,
        completed_at: new Date().toISOString(),
        output: {
            title: output.title,
            summary: output.summary,
        },
    });
};

exports.getManifest = async ({ context, org: owner, repo }, path) => {
    const manifest = await context.github.repos
        .getContents({
            owner,
            repo,
            path,
        })
        .catch(() => ({}));

    return Object.keys(manifest).length
        ? JSON.parse(Buffer.from(manifest.data.content, 'base64').toString())
        : undefined;
};

exports.getFolderFiles = async ({ context, org: owner, repo }, path) => {
    return await context.github.repos
        .getContents({
            owner,
            repo,
            path,
        })
        .catch(err => {
            return {};
        });
};

/** @description Validate manifestfile
 * @param {Object.<string, *>} options The options object
 * @param {Object.<string, *>} ajv The ajv instance
 * @param {string} schemaName The schema name
 * @param {Object.<string, *>} fileContent The manifest file content
 * @return {Object.<string, *>} Return object for check
 */

exports.validateManifest = checkExecuteDecorator(
    'Manifest',
    createChecks,
    (options, ajv, schemaName, fileContent) => {
        if (fileContent) {
            // validate manifest file
            if ((manifestResponse = validateSchema(ajv, schemaName, fileContent))) {
                return {
                    title: 'Manifest file is valid',
                };
            } else {
                throw new ValidationError({
                    title: manifestResponse.errors.length + ' Issues found',
                    summary: JSON.stringify(manifestResponse.errors, null, 2),
                });
            }
        } else {
            throw new ValidationError({
                title: 'manifest.json not found',
                cancel: true,
            });
        }
    }
);

/** @description Validate schema
 * @param {Object.<string, *>} ajv The manifest data object
 * @param {string} schema The schema name
 * @param {Object.<string, *>} content The json object
 * @return {boolean|Object.<string, *>} Returns true or error object
 */

function validateSchema (ajv, schema, content) {
    let valid = ajv.validate(schema, content);
    if (!valid) {
        return errorResponse(ajv.errors);
    }
    return true;
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

class ValidationError extends Error {
    constructor(obj) {
        super();
        this.title = obj.title;
        this.summary = obj.summary;
        this.cancel = obj.cancel;
    }
}

/** @description Create a check on github
 * @param {string} name The name of the check
 * @param {function} createChecks The createChecks function
 * @param {function} fn The main function
 * @return {Object.<string, *>} Return the checks object
 */

function checkExecuteDecorator(name, createChecks, fn) {
    return (options, ...args) => {
        try {
            return createChecks(options, name, 'success', fn(options, ...args));
        } catch (err) {
            if (!(err instanceof ValidationError)) {
                throw err;
            }
            if (err.cancel) {
                err.name = name;
                throw err;
            }
            return createChecks(options, name, 'action_required', err);
        }
    };
}

exports.createChecks = createChecks;
exports.ValidationError = ValidationError;
exports.checkExecuteDecorator = checkExecuteDecorator;
