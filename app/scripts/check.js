const { checkExecuteDecorator, createChecks, ValidationError } = require('./helper');

const { dirname } = require('path');

/** @description Check the folder
 * @param {Object.<string, *>} options The options object
 * @param {string} folderName The name of the folder
 * @param {Object.<string, *>} files The files object
 * @return {boolean}
 */

exports.checkFolder = checkExecuteDecorator(
    'Folder',
    createChecks,
    (options, folderName, files) => {
        if (folderName === '.') {
            throw new ValidationError({
                title: 'Pull request not allowed',
                summary: 'You are not allowed to create a pull request in this directory.',
                cancel: true,
            });
        }

        for (const file of files) {
            // get folder name and check with saved folder name
            // only one folder for one pull request
            if (dirname(file.filename) !== folderName) {
                throw new ValidationError({
                    title: 'Pull request not allowed',
                    summary:
                        'You are not allowed to create a pull request in different folders at the same time.',
                    cancel: true,
                });
            }
        }

        return {
            title: 'Plugin folder is correct',
        };
    }
);

/** @description Check the maintainer
 * @param {Object.<string, *>} options The options object
 * @param {Object.<string, *>} manifestData The manifest data object
 * @return {Object.<string, *>} Return object for check
 */

exports.checkMaintainer = checkExecuteDecorator(
    'Maintainer',
    createChecks,
    ({ user }, manifest) => {
        if (manifest) {
            // merge base check owner
            if (manifest.maintainer !== user.login) {
                throw new ValidationError({
                    title: 'Pull request not allowed',
                    summary: 'You are not allowed to create a pull request for this plugin.',
                    cancel: true,
                });
            }
        }

        return {
            title: 'Pull request allowed',
        };
    }
);

/** @description Check Folder files
 * @param {Object.<string, *>} options The options object
 * @param {Object.<string, *>} fileContent The manifest file content
 * @param {Object.<string, *>} pluginFolderFiles The files from the plugins folder
 * @return {Object.<string, *>} Return object for check
 */

exports.checkFolderFiles = checkExecuteDecorator(
    'Files',
    createChecks,
    (options, { versions }, { data: pluginFolderFiles }) => {
        const readmeList = [],
            imageList = [];

        versions.forEach(v => {
            if (v.readme && readmeList.indexOf(v.image) === -1) {
                readmeList.push(v.readme);
            }
            if (v.image && imageList.indexOf(v.image) === -1) {
                imageList.push(v.image);
            }
        });

        // check changed files with fileList
        for (const { name } of pluginFolderFiles) {
            if (name === 'manifest.json') {
                continue;
            }

            if ((i = readmeList.indexOf(name)) !== -1) {
                readmeList.splice(i, 1);
                continue;
            }

            if ((i = imageList.indexOf(name)) !== -1) {
                imageList.splice(i, 1);
                continue;
            }
        }

        if (imageList.length !== 0 || readmeList.length !== 0) {
            throw new ValidationError({
                title: 'Undefined files found',
                summary: `${readmeList.concat(imageList).join(', ')}`,
            });
        } else {
            return {
                title: 'All files ok',
            };
        }
    }
);

// checkVersions
// version number and hash are protected
