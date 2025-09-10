import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseProvider, createMediaSelector } from '../public/app/media-select.mjs';

test('chooseProvider respects ?provider override: apple', () => {
  const orig = global.location;
  global.location = { search: '?provider=apple' };
  try {
    const media = { youtube: { id: 'x' } };
    assert.equal(chooseProvider(media), 'apple');
  } finally {
    global.location = orig;
  }
});

test('chooseProvider respects ?provider override: youtube', () => {
  const orig = global.location;
  global.location = { search: '?provider=youtube' };
  try {
    const media = { apple: { previewUrl: '...' } };
    assert.equal(chooseProvider(media), 'youtube');
  } finally {
    global.location = orig;
  }
});

test('chooseProvider: auto prefers apple when available', () => {
  const orig = global.location;
  global.location = { search: '' };
  try {
    const media = { apple: { previewUrl: '...' }, youtube: { id: 'y' } };
    assert.equal(chooseProvider(media), 'apple');
  } finally {
    global.location = orig;
  }
});

test('chooseProvider: auto falls back to youtube', () => {
  const orig = global.location;
  global.location = { search: '' };
  try {
    const media = { youtube: { id: 'y' } };
    assert.equal(chooseProvider(media), 'youtube');
  } finally {
    global.location = orig;
  }
});

test('createMediaSelector.pickFor returns provider+media', () => {
  const sel = createMediaSelector();
  const ret = sel.pickFor({ media: { youtube: { id: 'y' } } });
  assert.equal(ret.provider === 'apple' || ret.provider === 'youtube', true);
  assert.ok(ret.media);
});
