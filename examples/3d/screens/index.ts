import { GgStatic, ScreenManager } from '@gg-web-engine/core';
import { MenuScreen } from './menu.screen';

// A debugging aid for the demo only: nothing below depends on it.
GgStatic.instance.devConsoleEnabled = true;

// One manager for the app. It adds a full-viewport container to the page; every screen pushed to
// it gets a layer of its own in there.
const screens = new ScreenManager({
  // The game replaces the menu (clearHistory): if its loading fails there is nothing left to show,
  // so the menu comes back with the error instead of an empty page.
  onEnterError: error => {
    console.error(error);
    return new MenuScreen(`Could not start the game: ${error instanceof Error ? error.message : error}`);
  },
});
screens.push(new MenuScreen());
