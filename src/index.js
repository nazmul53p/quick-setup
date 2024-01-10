#! /usr/bin/env node

import { execSync } from 'child_process';
import inquirer from 'inquirer';
import * as fs from 'node:fs/promises';

import chalk from 'chalk';
import dotenv from 'dotenv';
import fsExtra from 'fs-extra';
import ora from 'ora';
import semver from 'semver';
import shell from 'shelljs';
import {
  getDeployShFile,
  getDockerComposeFile,
  getDockerFile,
  getEcosystemConfigJsFile,
} from './const.js';

dotenv.config();
const RootDir = process.cwd();
// create file and write data to file
async function createAndWrite(filename, data) {
  try {
    // Write the data to the file
    await fs.writeFile(filename, data, 'utf8');
  } catch (err) {
    console.log('ERROR: ' + err);
  }
}

// Function to clone a repository and rename the cloned directory
async function renameDirectory(oldDirName, newDirName) {
  // Rename the cloned directory
  try {
    await fs.rename(oldDirName, newDirName);
  } catch (err) {
    console.log(err);
  }
}

async function deleteDirectory(directoryPath) {
  try {
    await fs.rm(directoryPath, { recursive: true, force: true });
    return `Directory deleted at ${directoryPath}`;
  } catch (err) {
    console.log(err);
    return err;
  }
}

async function copyFile(sourceFilePath, destinationFilePath) {
  try {
    await fs.copyFile(sourceFilePath, destinationFilePath);
    return; // Add return statement
  } catch (err) {
    console.log(err);
    return err;
  }
}

// Function to get version of a command
async function getVersion(command) {
  try {
    return execSync(`${command} --version`, { encoding: 'utf8' }).trim();
  } catch (error) {
    return null;
  }
}

// Function to check version
async function checkVersion(command, minVersion, installCommand, docLink) {
  const spinner = ora(`Checking ${command} version...`);
  spinner.start();
  let version = await getVersion(command);

  if (command === 'git') {
    await shellCommand('git --version');
    spinner.succeed(`${command} version is OK (${version})`);
  } else {
    if (version && semver.satisfies(version, `>=${minVersion}`)) {
      spinner.succeed(`${command} version is OK (${version})`);
    } else {
      spinner.fail(
        `${command} is not installed or version is too low (${version ||
          'N/A'})`
      );
      console.log(`To install or update, run: ${installCommand}`);
      console.log(`For more information, see: ${docLink}`);
    }
  }
}

// Function for shell command
async function shellCommand(command) {
  try {
    const isError = shell.exec(command).code !== 0;
    if (isError) {
      shell.echo(`Error: ${command} failed`);
      shell.exit(1);
    }
    return null; // Add a return statement here
  } catch (error) {
    return null;
  }
}

async function getUserInput() {
  const questions = [
    {
      type: 'input',
      name: 'projectName',
      message: 'Please enter project name:',
      default: 'my-app',
      validate: function(value) {
        if (value.length && !value.includes(' ')) {
          return true;
        } else {
          return 'Please enter project name.';
        }
      },
    },
  ];

  return await inquirer.prompt(questions);
}

async function checkVersions() {
  // Check Node.js, yarn and git versions
  await checkVersion(
    'node',
    '18.17.0',
    'Download and install from https://nodejs.org/',
    'https://nodejs.org/en/download/'
  );
  await checkVersion(
    'yarn',
    '1.22.10',
    'npm install yarn -g',
    'https://classic.yarnpkg.com/en/docs/install/'
  );

  await checkVersion(
    'git',
    '2.0.0',
    'https://docs.github.com/en/desktop/installing-and-authenticating-to-github-desktop/installing-github-desktop',
    'https://git-scm.com/book/en/v2/Getting-Started-Installing-Git'
  );
}

// async function updatePackageName(projectName) {
//   const __dirname = path.dirname(fileURLToPath(import.meta.url));
//   const packageJsonPath = `${process.cwd()}/package.json`;

//   // Read the package.json file
//   let data = await fs.readFile(packageJsonPath, 'utf8');

//   // Parse the JSON data
//   let packageJson;
//   try {
//     packageJson = JSON.parse(data);
//   } catch (err) {
//     console.log(err);
//     return;
//   }

//   // Update the name field
//   packageJson.name = projectName;

//   // Stringify the updated JSON data
//   let updatedData = JSON.stringify(packageJson, null, 2);

//   // Write the updated data back to the package.json file
//   try {
//     await fs.writeFile(packageJsonPath, updatedData, 'utf8');
//   } catch (err) {
//     console.log('ERROR: ' + err);
//   }
// }
async function replaceInFile(filename, searchValue, replaceValue) {
  try {
    const data = await fs.readFile(filename, 'utf8');
    const updatedData = data.replace(searchValue, replaceValue);
    await fs.writeFile(filename, updatedData, 'utf8');
  } catch (err) {
    console.log('ERROR: ' + err);
  }
}

async function common(projectName, spinner) {
  await deleteDirectory(`.git`);

  shellCommand(`npm pkg set name=${projectName}`);

  shellCommand('git init && npx husky-init && yarn install');

  await replaceInFile('./.husky/pre-commit', 'npm test', 'npx lint-staged');

  shellCommand(`npm pkg delete scripts.prepare`);

  await createAndWrite(
    'Dockerfile',
    getDockerFile(String(await getVersion('node')).replace('v', ''))
  );

  await createAndWrite('docker-compose.yml', getDockerComposeFile(projectName));

  await createAndWrite(
    'ecosystem.config.js',
    getEcosystemConfigJsFile(projectName)
  );

  await createAndWrite('deploy.sh', getDeployShFile(projectName));

  shellCommand("git add . && git commit -m 'Initial setup'");

  spinner.succeed(`Project setup successfully`);

  console.log(
    chalk.white(` 
    \n
    ***************************************************
    1. Go to project directory: cd ${projectName}
    cd ${projectName}

    2. Run project:
    yarn dev
    ***************************************************

    ******************* For Docker ********************
    docker-compose up -d
    ***************** For Production ******************
    1. Run deploy.sh file
    sh deploy.sh
    ****************** Happy Coding *******************
    \n\n
    `)
  );
}

async function setup(projectName, temple, type = '') {
  const spinner = ora(`Creating project ${projectName}...`);
  spinner.start();

  if (!shell.test('-d', projectName)) {
    shell.exec('git clone git@bitbucket.org:sslengineering/ssl-react.git');
    await renameDirectory(temple, projectName);
    shell.cd(projectName);
    await common(projectName, spinner);
  } else {
    if (type === '.') {
      shell.exec('git clone git@bitbucket.org:sslengineering/ssl-react.git');
      await fsExtra.copy(`${RootDir}/${temple}`, `${RootDir}`);
      await deleteDirectory(`${RootDir}/${temple}`);
      let getProjectName = RootDir.split('/');
      getProjectName = getProjectName[getProjectName.length - 1];
      await common(getProjectName, spinner);
    } else {
      spinner.fail(`Project directory already exists`);
    }
  }
}

async function action({ projectName }) {
  console.log(
    chalk.red(
      `
=========================================================================
Take few minutes to setup your project. Please do not close the terminal.
=========================================================================
     \n
    `
    )
  );
  await checkVersions();

  const temple = 'ssl-react';
  if (projectName === '.') {
    setup(projectName, temple, '.');
  } else {
    setup(projectName, temple);
  }
}

getUserInput().then(action);
