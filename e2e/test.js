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

  // enable only one question type
  await page.uncheck('#type-game-composer');
  await page.uncheck('#type-title-composer');
  await page.check('#type-title-game');

  // set number of questions to 5
  await page.selectOption('#count', '5');
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

  await page.waitForSelector('#next-btn');
  await page.click('#next-btn');

  // skip remaining questions
  for (let i = 0; i < 4; i++) {
    await page.waitForSelector('#prompt');
    await page.click('#submit-btn');
    await page.waitForSelector('#next-btn');
    await page.click('#next-btn');
  }

  await page.waitForSelector('#final-score');
  const finalScore = await page.textContent('#final-score');
  if (!/^Score: [1-5]\/5$/.test(finalScore)) {
    throw new Error(`Unexpected final score: ${finalScore}`);
  }

  const summaryCount = await page.locator('#summary-list li').count();
  if (summaryCount < 1) {
    throw new Error('Summary not generated');
  }

  await browser.close();
})();
