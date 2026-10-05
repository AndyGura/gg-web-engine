import { GgStatic, ScreenManager } from '@gg-web-engine/core';
import { MenuScreen } from './menu.screen';

// A debugging aid for the demo only: nothing below depends on it.
GgStatic.instance.devConsoleEnabled = true;

// One manager for the app. It adds a full-viewport container to the page; every screen pushed to
// it gets a layer of its own in there.
const screens = new ScreenManager();
screens.push(new MenuScreen());
