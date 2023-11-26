// made from https://codepen.io/Chmood/pen/MaBZdM
export class SpeedometerTachometer {
    private container: HTMLElement;

    private currentRpm: number = 0;
    private currentSpeed: number = 0;

    constructor(containerId: string,
                private readonly maxRpm: number,
                private readonly rpmRedzone: number,
                private readonly maxSpeed: number) {
        this.container = document.getElementById(containerId);
        this.init();
    }

    private init() {
        this.createSpeedometerTachometer();
        this.updateNeedlePositions();
    }

    private createSpeedometerTachometer() {
        this.container.innerHTML = `
      <div class="hud-element circular meter--rpm meter--big-label">
        <!-- Add your RPM elements here -->
        <div class="needle" style="transform: translate3d(-50%, 0, 0) rotate(0deg);"></div>
        <div class="needle-axle"></div>
        <div class="label label-value">
          <div id="rpm-label">0</div>
          <span>RPM</span>
        </div>
        <div class="label label-unit">
          <span>x1000</span>
        </div>
      </div>
      
      <div class="hud-element circular meter--gear">
        <div>N</div>
      </div>
      
      <div class="hud-element circular meter--speed meter--big-label">
        <!-- Add your speedometer elements here -->
        <div class="needle-speed" style="transform: translate3d(-50%, 0, 0) rotate(0deg);"></div>
        <div class="needle-axle"></div>
        <div class="label label-value">
          <div id="speed-label">0</div>
          <span>Km/h</span>
        </div>
        <div class="label label-unit">
          <span>Speed</span>
          <div>Km/h</div>
        </div>
      </div>
    `;
    }

    private updateNeedlePositions() {
        const rpmNeedle = this.container.querySelector('.needle') as any;
        const speedNeedle = this.container.querySelector('.needle-speed') as any;

        rpmNeedle.style.transform = `translate3d(-50%, 0, 0) rotate(${this.getAngleForRpm()}deg)`;
        speedNeedle.style.transform = `translate3d(-50%, 0, 0) rotate(${this.getAngleForSpeed()}deg)`;

        const rpmValue = Math.round(this.currentRpm);
        const speedValue = Math.round(this.currentSpeed);

        this.container.querySelector('#rpm-label').textContent = rpmValue.toString();
        this.container.querySelector('#speed-label').textContent = speedValue.toString();
    }

    private getAngleForRpm(): number {
        return (this.currentRpm / this.maxRpm) * 300;
    }

    private getAngleForSpeed(): number {
        return (this.currentSpeed / this.maxSpeed) * 300;
    }

    public setCurrentRpm(rpm: number): void {
        this.currentRpm = rpm;
        this.updateNeedlePositions();
    }

    public setCurrentSpeed(speed: number): void {
        this.currentSpeed = speed;
        this.updateNeedlePositions();
    }
}