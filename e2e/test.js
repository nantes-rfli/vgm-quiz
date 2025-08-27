const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const datasetPath = path.join(__dirname, '..', 'public', 'build', 'dataset.json');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  const tracks = dataset.tracks || [];

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8080/');

  await page.waitForSelector('#start-btn:not([disabled])');
  await page.fill('#count', '1');
  await page.click('#start-btn');

  await page.waitForSelector('#prompt');
  const promptText = await page.textContent('#prompt');

  let expected;
  if (promptText.startsWith('Which game is the track')) {
    const title = /"(.+)"/.exec(promptText)[1];
    const track = tracks.find(t => t.title === title);
    expected = track.game;
  } else if (promptText.startsWith('Who composed the music for')) {
    const game = /"(.+)"/.exec(promptText)[1];
    const track = tracks.find(t => t.game === game);
    expected = track.composer;
  } else if (promptText.startsWith('Who composed the track')) {
    const title = /"(.+)"/.exec(promptText)[1];
    const track = tracks.find(t => t.title === title);
    expected = track.composer;
  } else {
    throw new Error(`Unknown prompt: ${promptText}`);
  }

  await page.fill('#answer', expected);
  await page.click('#submit-btn');

  const feedback = await page.textContent('#feedback');
  if (!/Correct!|正解/.test(feedback)) {
    throw new Error(`Unexpected feedback: ${feedback}`);
  }

  const scoreText = await page.textContent('#score-bar');
  if (!/^Score: 1\/\d+/.test(scoreText)) {
    throw new Error(`Unexpected score: ${scoreText}`);
  }

  await page.click('#next-btn');
  await page.click('#restart-btn');
  await page.click('#history-btn');
  await page.waitForSelector('#history-list li');
  const historyCount = await page.locator('#history-list li').count();
  if (historyCount < 1) {
    throw new Error('History not recorded');
  }

  await browser.close();
})();
