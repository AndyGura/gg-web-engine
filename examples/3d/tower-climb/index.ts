import { ScreenManager } from '@gg-web-engine/core';
import { TitleScreen } from './title.screen';

// One manager for the whole app: title → game (loading in between) → pause / win / game over.
// It adds a full-viewport container to the page; every screen pushed to it gets its own layer.
const screens = new ScreenManager({
  // The game replaces the title screen (clearHistory): if its loading fails there is nothing left
  // to show, so the title comes back with the error instead of an empty page.
  onEnterError: error => {
    console.error(error);
    return new TitleScreen(`Could not start the game: ${error instanceof Error ? error.message : error}`);
  },
});
screens.push(new TitleScreen());
