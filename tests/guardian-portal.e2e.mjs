import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.GUARDIAN_E2E_BASE_URL || 'http://127.0.0.1:4173/mission-control/';
const timeout = 20_000;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 }
});
const page = await context.newPage();
page.setDefaultTimeout(timeout);

const assertBodyDoesNotContain = async (value) => {
  const bodyText = await page.locator('body').innerText();
  assert.equal(
    bodyText.includes(value),
    false,
    `Guardian page unexpectedly exposed denylisted value: ${value}`
  );
};

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: /Guardian Access/i }).click();
  await page.getByRole('heading', { name: 'Guardian Portal' }).waitFor();

  // A validly formatted but incorrect code must fail with one generic message.
  await page.getByLabel('Class Code').fill('G27FTEST');
  await page.getByLabel('Guardian Code').fill('ABCDEFGH-JKLM-NPQR-STUX');
  await page.getByRole('button', { name: 'Open Progress Dashboard' }).click();
  await page.getByText(
    'The class code or Guardian code is incorrect, unavailable, or temporarily locked.'
  ).waitFor();

  await assertBodyDoesNotContain('lookup_key');
  await assertBodyDoesNotContain('secret_hash');
  await assertBodyDoesNotContain('Student not found');

  // Valid login opens the one-student read-only dashboard.
  await page.getByLabel('Guardian Code').fill('ABCDEFGH-JKLM-NPQR-STUV');
  await page.getByRole('button', { name: 'Open Progress Dashboard' }).click();

  await page.getByRole('heading', { name: 'Nova', exact: true }).waitFor();
  await page.getByText('Guardian Validation Class', { exact: true }).waitFor();
  await page.getByText('Current Points', { exact: true }).waitFor();
  await page.getByText('73', { exact: true }).waitFor();
  await page.getByText('Guardian Browser Validation Task', { exact: true }).waitFor();
  await page.getByText('Great improvement. Keep building on this progress.', { exact: true }).waitFor();
  await page.getByText('Consistency Star', { exact: true }).waitFor();
  await page.getByText('Points added', { exact: true }).waitFor();
  await page.getByText('No rank or class leaderboard is shown.', { exact: true }).waitFor();

  const storedToken = await page.evaluate(() =>
    window.sessionStorage.getItem('mission_control_guardian_session_token')
  );
  assert.match(storedToken || '', /^[0-9a-f]{64}$/);

  await assertBodyDoesNotContain('FORBIDDEN OTHER STUDENT 27F');
  await assertBodyDoesNotContain('PRIVATE BROWSER FIXTURE SUBMISSION MUST NOT LEAK');
  await assertBodyDoesNotContain('PRIVATE BADGE REASON MUST NOT LEAK');
  await assertBodyDoesNotContain('PRIVATE TEACHER REASON MUST NOT LEAK');
  await assertBodyDoesNotContain('PRIVATE METADATA MUST NOT LEAK');
  await assertBodyDoesNotContain('7319');
  await assertBodyDoesNotContain('8462');

  // Reloading the same tab must restore the session through server validation.
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Nova', exact: true }).waitFor();
  await page.getByText('Guardian Browser Validation Task', { exact: true }).waitFor();

  // Explicit logout must clear the tab-scoped token and return to login.
  await page.getByRole('button', { name: 'Sign Out' }).click();
  await page.getByRole('heading', { name: 'Guardian Portal' }).waitFor();

  const tokenAfterLogout = await page.evaluate(() =>
    window.sessionStorage.getItem('mission_control_guardian_session_token')
  );
  assert.equal(tokenAfterLogout, null);

  console.log('Guardian Chromium end-to-end validation passed.');
} catch (error) {
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({
    path: 'artifacts/guardian-e2e-failure.png',
    fullPage: true
  });
  throw error;
} finally {
  await context.close();
  await browser.close();
}
