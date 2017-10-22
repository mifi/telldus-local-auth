'use strict';

const assert = require('assert');

const { URLSearchParams } = require('url');

const meow = require('meow');
const chalk = require('chalk');
const fetch = require('node-fetch');
const opn = require('opn');

const cli = meow(`
  Usage
    $ telldus-local-auth <IP of device> <app name>

  Options
    --port  Port to connect to (default 80)

  Examples
    $ telldus-local-auth 192.168.1.100 homebridge-telldus
`);

const ipAddress = cli.input[0];
const appName = cli.input[1];
const colonPort = cli.flags.port ? `:${cli.flags.port}` : '';

if (!appName || !ipAddress) cli.showHelp();

const baseUrl = `http://${ipAddress}${colonPort}/api`;

async function getRequestToken() {
  const response = await fetch(`${baseUrl}/token`, {
    method: 'PUT',
    body: new URLSearchParams({ app: appName }),
  });

  assert(response.status, 200);

  return response.json();
}

async function exchangeRequestToken(requestToken) {
  const response = await fetch(`${baseUrl}/token?token=${requestToken}`);
  assert(response.status, 200);
  const body = await response.json();

  if (body.error) return undefined;
  return body.token;
}

async function pollForToken(requestToken) {
  for (;;) {
    const accessToken = await exchangeRequestToken(requestToken); // eslint-disable-line no-await-in-loop,max-len
    if (accessToken) return accessToken;
    await new Promise(r => setTimeout(r, 2000)); // eslint-disable-line no-await-in-loop
  }
}

async function run() {
  const response = await getRequestToken();
  const requestToken = response.token;
  const url = response.authUrl;

  opn(url, { wait: false });
  console.log(`Go to ${url}`);
  console.log('Login to your Telldus Live account');
  console.log(`${chalk.red('Important!')} Select ${chalk.yellow('1 year')} and ${chalk.yellow('Auto renew access')}`);
  console.log(`Then press ${chalk.yellow('Authorize')} and come back here when done`);

  const accessToken = await pollForToken(requestToken);
  console.log(`YOUR TOKEN: ${chalk.inverse(accessToken)}`);
  console.log('');
  console.log(`Put it in homebridge ${chalk.inverse('config.json')}, like this:\n`);
  console.log('"local": {');
  console.log(`  "ip_address": "${ipAddress}",`);
  console.log(`  "access_token": "${accessToken}"`);
  console.log('},');
}

run().catch(console.error);
