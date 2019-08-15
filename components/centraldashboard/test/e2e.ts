import 'jasmine';

import {Credentials, JWT} from 'google-auth-library';
import {launch} from 'puppeteer';

const ORIGINAL_TIMEOUT = jasmine.DEFAULT_TIMEOUT_INTERVAL;
const {CLIENT_ID, KF_HOST, SERVICE_ACCOUNT_KEY, SERVICE_ACCOUNT_EMAIL} =
    process.env;
if (!KF_HOST) {
  console.log('KF_HOST environment variable must be set');
  process.exit(1);
}

function getAuth(iapHost: string): Promise<Credentials> {
  const client = new JWT({
    keyFile: SERVICE_ACCOUNT_KEY,
    additionalClaims: {target_audience: CLIENT_ID}
  });
  return client.authorize();
}

function waitFor(seconds: number): Promise<void> {
  return new Promise((r) => setTimeout(r, seconds * 1000));
}

describe('Kubeflow Dashboard Tests', () => {
  beforeEach(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;
  });

  afterEach(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = ORIGINAL_TIMEOUT;
  });

  it('Should allow the user to register on first access', async () => {
    const browser = await launch();
    const credentials = await getAuth(KF_HOST);
    const page = await browser.newPage();
    page.setExtraHTTPHeaders({Authorization: `Bearer ${credentials.id_token}`});
    console.log(`Connecting to ${KF_HOST}`);
    await page.goto(KF_HOST);

    const startRegistration = await page.waitForFunction(
        () => document.querySelector('body > main-page')
                  .shadowRoot.querySelector('registration-page')
                  .shadowRoot.querySelector('paper-button'));
    await startRegistration.asElement().click();
    await waitFor(3);

    console.log('Finishing Registration');
    const finishRegistration = await page.waitForFunction(
        () =>
            document.querySelector('body > main-page')
                .shadowRoot.querySelector('registration-page')
                .shadowRoot.querySelector(
                    '#MainCard > neon-animated-pages > neon-animatable.iron-selected > div.actions > paper-button:nth-child(1)'));
    await finishRegistration.asElement().click();
    await waitFor(5);

    console.log('Validating Namespace');
    const namespace = await page.waitForFunction(() => {
      const paperItem =
          document.querySelector('body > main-page')
              .shadowRoot.querySelector('#NamespaceSelector')
              .shadowRoot.querySelector(
                  'paper-menu-button > paper-listbox > paper-item');
      return paperItem ? paperItem.textContent : false;
    });
    const namespaceTextContent: string = await namespace.jsonValue();
    expect(namespaceTextContent.trim())
        .toBe(SERVICE_ACCOUNT_EMAIL.split('@')[0]);
  });
});
