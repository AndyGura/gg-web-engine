export class GgConsoleUI {
  private output: string =
    `
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

List of available commands: `.replace(/ /g, '&nbsp;') + `<span style="color:yellow">ls_commands</span>`;

  private commandHistory: string[] = [];
  private currentCommandIndex = 0; // for repeating command using up/down arrow keys

  elements: {
    main: HTMLDivElement;
    input: HTMLInputElement;
    output: HTMLDivElement;
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
  <div id='gg-console-header' style='padding: 0.2rem 0.2rem 0;cursor:move;display:flex;justify-content:space-between;'>
    <span>CONSOLE</span>
    <a id='gg-console-close-icon' style='display:block;padding:0.3rem;margin:-0.3rem;cursor:pointer;'>X</a>
  </div>
  <div id='gg-console-output' style='flex-grow:1;background:#232323;color:white;font-family:monospace;overflow-y:auto;overflow-wrap:anywhere;padding:0.2rem;'></div>
  <input id='gg-console-input' style='background:#000000;border:none;outline:none;color:white;font-family:monospace;'/>`;
    main.style.position = 'absolute';
    main.style.zIndex = '1000';
    main.style.backgroundColor = '#343434';
    main.style.width = '640px';
    main.style.height = '480px';
    main.style.display = 'flex';
    main.style.flexDirection = 'column';
    main.style.alignItems = 'stretch';
    main.style.padding = '0.1rem';
    main.style.rowGap = '3px';
    main.style.fontFamily = 'monospace';
    main.style.fontWeight = 'bold';
    main.style.color = 'white';
    document.body.append(main);
    this.elements = {
      main,
      input: document.getElementById('gg-console-input')! as HTMLInputElement,
      output: document.getElementById('gg-console-output')! as HTMLDivElement,
    };
    document.getElementById('gg-console-close-icon')!.onmousedown = () => this.destroyUI();
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
    this.elements.input.oninput = event => {
      let value = this.elements?.input.value || '';
      // backspace
      if (value.length > 0 && (event as InputEvent).data === null) {
        value = value.substring(0, value.length - 1);
      }
      if (value.trim() === '') {
        return;
      }
      let autocompletion = (window as any).ggstatic.availableCommands.find((c: any) => c[0].startsWith(value));
      if (autocompletion) {
        this.elements!.input.value = autocompletion[0];
        this.elements!.input.setSelectionRange(value.length, this.elements!.input.value.length);
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
    this.stdout('\n' + (await (window as any).ggstatic.console(command)));
    this.commandHistory.push(command);
    this.currentCommandIndex = this.commandHistory.length;
  }

  private stdout(s: string = ''): void {
    this.output += s;
    this.elements!.output.innerHTML = this.output.replace(/\n/g, '<br>');
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
      if (!this.elements) {
        closeDragElement();
        return;
      }
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
