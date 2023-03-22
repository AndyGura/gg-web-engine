import { GgStatic } from '../gg-static';

export class GgConsoleUI {
  private static _instance: GgConsoleUI | null;
  static get instance(): GgConsoleUI {
    if (!this._instance) {
      this._instance = new GgConsoleUI();
    }
    return this._instance;
  }

  private constructor() {}

  private output: string = `
                  ▄████   ▄████     █     █░▓█████  ▄▄▄▄   
                 ██▒ ▀█▒ ██▒ ▀█▒   ▓█░ █ ░█░▓█   ▀ ▓█████▄ 
                ▒██░▄▄▄░▒██░▄▄▄░   ▒█░ █ ░█ ▒███   ▒██▒ ▄██
                ░▓█  ██▓░▓█  ██▓   ░█░ █ ░█ ▒▓█  ▄ ▒██░█▀  
                ░▒▓███▀▒░▒▓███▀▒   ░░██▒██▓ ░▒████▒░▓█  ▀█▓
                 ░▒   ▒  ░▒   ▒    ░ ▓░▒ ▒  ░░ ▒░ ░░▒▓███▀▒
                  ░   ░   ░   ░      ▒ ░ ░   ░ ░  ░▒░▒   ░ 
                ░ ░   ░ ░ ░   ░      ░   ░     ░    ░    ░ 
                      ░       ░        ░       ░  ░ ░      
                                                         ░ 
             >>> https://github.com/AndyGura/gg-web-engine <<<
Welcome to GG web engine UI console. 
Enter command in input below.

List of available commands: commandslist 
`;

  private commandHistory: string[] = [];
  private currentCommandIndex = 0; // for repeating command using up/down arrow keys

  elements: {
    main: HTMLDivElement;
    input: HTMLInputElement;
    output: HTMLTextAreaElement;
  } | null = null;

  public get isUIShown(): boolean {
    return !!this.elements;
  }

  public createUI() {
    if (this.elements) {
      return;
    }
    const main: HTMLDivElement = document.createElement('div');
    main.innerHTML = `
  <div id="gg-console-header" style="padding: 10px; cursor: move; z-index: 10; background-color: #054a81; border: 1px solid white; font-size: large;">GG web engine UI console</div>
  <textarea id="gg-console-output" disabled style="resize: none; flex-grow: 1; background: #555555; border: 1px solid white; color: white; font-family: monospace;" ></textarea>
  <input id="gg-console-input" style="background: #555555; border: 1px solid white; color: white; font-family: monospace;"/>`;
    main.style.position = 'absolute';
    main.style.zIndex = '1000';
    main.style.backgroundColor = '#222222';
    main.style.border = '1px solid white';
    main.style.width = '640px';
    main.style.height = '480px';
    main.style.display = 'flex';
    main.style.flexDirection = 'column';
    main.style.alignItems = 'stretch';
    main.style.padding = '3px';
    main.style.rowGap = '3px';
    main.style.fontFamily = 'monospace';
    main.style.color = 'white';
    document.body.append(main);
    this.elements = {
      main,
      input: document.getElementById('gg-console-input')! as HTMLInputElement,
      output: document.getElementById('gg-console-output')! as HTMLTextAreaElement,
    };
    this.elements.input.onkeydown = event => {
      if (event?.keyCode === 13) {
        event.preventDefault();
        this.onInput().then();
      } else if (event?.keyCode === 38) {
        event.preventDefault();
        this.onUsePreviousCommand();
      } else if (event?.keyCode === 40) {
        event.preventDefault();
        this.onUseNextCommand();
      }
    };
    this.stdout();
    this.setupDragging();
    setTimeout(() => this.elements!.input.focus(), 20);
  }

  public destroyUI() {
    if (!this.elements) {
      return;
    }
    document.body.removeChild(this.elements.main);
    this.elements = null;
  }

  onUsePreviousCommand() {
    if (this.commandHistory.length === 0) {
      return;
    }
    this.currentCommandIndex--;
    if (this.currentCommandIndex < 0) {
      this.currentCommandIndex += this.commandHistory.length;
    }
    this.elements!.input.value = this.commandHistory[this.currentCommandIndex % this.commandHistory.length];
  }

  onUseNextCommand() {
    if (this.commandHistory.length === 0) {
      return;
    }
    this.currentCommandIndex++;
    this.elements!.input.value = this.commandHistory[this.currentCommandIndex % this.commandHistory.length];
  }

  async onInput() {
    const command = this.elements!.input.value;
    this.elements!.input.value = '';
    this.stdout('\n> ' + command);
    this.stdout('\n' + (await GgStatic.instance.console(command)));
    this.commandHistory.push(command);
    this.currentCommandIndex = this.commandHistory.length;
  }

  private stdout(s: string = ''): void {
    this.output += s;
    this.elements!.output.value = this.output;
    this.elements!.output.scrollTop = this.elements!.output.scrollHeight;
  }

  setupDragging() {
    let x = 0,
      y = 0;
    const dragMouseDown = (e: MouseEvent) => {
      e = e || window.event;
      e.preventDefault();
      // get the mouse cursor position at startup:
      x = e.clientX;
      y = e.clientY;
      document.onmouseup = closeDragElement;
      // call a function whenever the cursor moves:
      document.onmousemove = elementDrag;
    };

    const elementDrag = (e: MouseEvent) => {
      e.preventDefault();
      // calculate the new cursor position:
      const curX = x - e.clientX;
      const curY = y - e.clientY;
      x = e.clientX;
      y = e.clientY;
      // set the element's new position:
      this.elements!.main.style.left = this.elements!.main.offsetLeft - curX + 'px';
      this.elements!.main.style.top = this.elements!.main.offsetTop - curY + 'px';
    };

    const closeDragElement = () => {
      // stop moving when mouse button is released:
      document.onmouseup = null;
      document.onmousemove = null;
    };
    document.getElementById('gg-console-header')!.onmousedown = dragMouseDown;
  }
}
