import Phaser from 'phaser';
import { PHASE_TWO_CONFIG } from './phaseConfig';

const WALL_WIDTH = 24;
const PLAYER_RADIUS = 14;
const FLY_RADIUS = 10;
const FLY_COLLISION_RADIUS = 18;
const GRAVITY = 820;
const SWING_GRAVITY_MULTIPLIER = 1.4;
const SWING_STEERING_ACCELERATION = 260;
const WATER_RISE_SPEED = 42;
const MAX_ATTACH_DISTANCE = 460;
const REEL_SPEED = 150;
const MIN_ROPE_LENGTH = 72;
const ANCHOR_SELECT_RADIUS = 42;
const PLATFORM_JUMP_SPEED = 390;
const PLATFORM_MOVE_SPEED = 220;
const WORLD_HEIGHT_MULTIPLIER = 4;
const WORLD_CHUNK_HEIGHT = 1.2;

type AnchorPoint = {
  x: number;
  y: number;
  marker: Phaser.GameObjects.Arc;
};

type Platform = {
  left: number;
  right: number;
  top: number;
  graphic: Phaser.GameObjects.Rectangle;
};

type Spike = {
  x: number;
  y: number;
  graphic: Phaser.GameObjects.Triangle;
};

type Fly = {
  x: number;
  y: number;
  graphic: Phaser.GameObjects.Arc;
};

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Arc;
  private rope!: Phaser.GameObjects.Graphics;
  private water!: Phaser.GameObjects.Rectangle;
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private gameOverOverlay!: Phaser.GameObjects.Container;
  private gameOverText!: Phaser.GameObjects.Text;
  private phaseWarning!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'left' | 'right', Phaser.Input.Keyboard.Key>;
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private escapeKey!: Phaser.Input.Keyboard.Key;
  private anchorPoints: AnchorPoint[] = [];
  private platforms: Platform[] = [];
  private flies: Fly[] = [];
  private spikes: Spike[] = [];
  private wallSegments: Phaser.GameObjects.Rectangle[] = [];
  private anchor: AnchorPoint | null = null;
  private ropeLength = 0;
  private isReeling = false;
  private isGrounded = false;
  private velocityX = 0;
  private velocityY = 0;
  private waterY = 0;
  private worldHeight = 0;
  private generatedTop = 0;
  private elapsedGameTime = 0;
  private warningRemaining = 0;
  private nextSpikeY: number | null = null;
  private score = 0;
  private spikesActive = false;
  private gameOver = false;
  private paused = false;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height } = this.scale;
    const worldHeight = height * WORLD_HEIGHT_MULTIPLIER;
    const startingY = height * 3.5;
    this.worldHeight = worldHeight;
    this.score = 0;
    this.velocityX = 0;
    this.velocityY = 0;
    this.anchor = null;
    this.isReeling = false;
    this.isGrounded = false;
    this.anchorPoints = [];
    this.platforms = [];
    this.flies = [];
    this.spikes = [];
    this.wallSegments = [];
    this.elapsedGameTime = 0;
    this.warningRemaining = 0;
    this.nextSpikeY = null;
    this.spikesActive = false;
    this.waterY = worldHeight;
    this.gameOver = false;
    this.paused = false;

    this.wallSegments.push(
      this.add.rectangle(WALL_WIDTH / 2, worldHeight / 2, WALL_WIDTH, worldHeight, 0x475569),
      this.add.rectangle(
        width - WALL_WIDTH / 2,
        worldHeight / 2,
        WALL_WIDTH,
        worldHeight,
        0x475569,
      ),
    );

    this.add
      .text(width / 2, 18, 'ПАУК', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);

    this.statusText = this.add
      .text(width / 2, 54, 'Зажми точку — тянись; клик мимо — отпусти. A/D — раскачка/ходьба, ПРОБЕЛ — прыжок, Esc/P — пауза.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);

    this.scoreText = this.add.text(24, 24, 'Мухи: 0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '21px',
      color: '#ffffff',
    }).setScrollFactor(0);
    this.timerText = this.add.text(width - 24, 24, 'Время: 00:00', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '21px',
      color: '#ffffff',
    }).setOrigin(1, 0).setScrollFactor(0);
    this.phaseWarning = this.add
      .text(width / 2, height * 0.2, PHASE_TWO_CONFIG.warningText, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '26px',
        color: '#ffffff',
        backgroundColor: '#991b1b',
        padding: { x: 18, y: 12 },
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0);

    this.createPlatforms(width, height, startingY);
    this.createAnchorPoints(width, height, startingY);
    this.createStartingFlies(width, height, startingY);
    this.generatedTop = Math.min(...this.anchorPoints.map((point) => point.y));

    this.water = this.add.rectangle(width / 2, worldHeight, width, 0, 0x0ea5e9, 0.8);
    this.rope = this.add.graphics();
    this.player = this.add.circle(width * 0.3, startingY, PLAYER_RADIUS, 0xf8fafc);

    const startingAnchor = this.anchorPoints[0];
    if (!startingAnchor) {
      throw new Error('At least one spider anchor point is required.');
    }
    this.attachTo(startingAnchor);

    this.input.on('pointerdown', this.handlePointerDown, this);
    this.cameras.main.scrollY = startingY - height * 0.68;
    this.createOverlays(width, height);

    if (!this.input.keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }
    this.input.keyboard.on('keydown-R', this.restart, this);
    this.input.keyboard.on('keydown-SPACE', this.jumpFromPlatform, this);
    this.pauseKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.escapeKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<'left' | 'right', Phaser.Input.Keyboard.Key>;
  }

  update(_time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.pauseKey) ||
      Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      this.togglePause();
    }
    if (this.gameOver || this.paused) return;

    const seconds = Math.min(delta / 1000, 0.05);
    this.elapsedGameTime += seconds;
    this.updateTimer();
    this.updatePhaseWarning(seconds);
    this.waterY -= WATER_RISE_SPEED * seconds;
    this.ensureWorldAhead();
    this.ensureSpikesAhead();
    this.updateWater();
    this.updateSpider(seconds);
    this.updateCamera(seconds);
    this.checkFly();
    this.checkSpikeCollision();
    this.removeSubmergedObjects();

    if (!this.gameOver && this.player.y + PLAYER_RADIUS >= this.waterY) {
      this.endGame();
    }

    this.rope.clear();
    if (this.anchor) {
      this.rope.lineStyle(3, 0xe2e8f0, 1);
      this.rope.lineBetween(this.anchor.x, this.anchor.y, this.player.x, this.player.y);
    }
  }

  private createAnchorPoints(width: number, height: number, startingY: number): void {
    const layout = [
      { x: 0.22, rise: 0.3 },
      { x: 0.42, rise: 0.55 },
      { x: 0.66, rise: 0.8 },
      { x: 0.84, rise: 1.05 },
      { x: 0.65, rise: 1.3 },
      { x: 0.38, rise: 1.55 },
      { x: 0.15, rise: 1.8 },
      { x: 0.34, rise: 2.05 },
      { x: 0.62, rise: 2.3 },
      { x: 0.84, rise: 2.55 },
      { x: 0.61, rise: 2.8 },
      { x: 0.35, rise: 3.05 },
    ];

    this.anchorPoints = layout.map(({ x, rise }) => {
      const pointX = width * x;
      const pointY = startingY - height * rise;
      const marker = this.add.circle(pointX, pointY, 9, 0x38bdf8).setStrokeStyle(3, 0xe0f2fe);
      return { x: pointX, y: pointY, marker };
    });
  }

  private createStartingFlies(width: number, height: number, startingY: number): void {
    const layout = [
      { x: 0.72, rise: 0.15 },
      { x: 0.28, rise: 0.65 },
      { x: 0.72, rise: 1.15 },
      { x: 0.28, rise: 1.65 },
      { x: 0.72, rise: 2.15 },
      { x: 0.28, rise: 2.65 },
      { x: 0.72, rise: 3.15 },
    ];

    for (const position of layout) {
      this.addFly(width * position.x, startingY - height * position.rise);
    }
  }

  private addFly(x: number, y: number): void {
    const graphic = this.add.circle(x, y, FLY_RADIUS, 0xfacc15);
    this.flies.push({ x, y, graphic });
  }

  private updateTimer(): void {
    const totalSeconds = Math.floor(this.elapsedGameTime);
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    this.timerText.setText(`Время: ${minutes}:${seconds}`);
  }

  private createPlatforms(width: number, height: number, startingY: number): void {
    const platformSpecs = [
      { x: width * 0.32, y: startingY - height * 0.75, width: 190 },
      { x: width * 0.72, y: startingY - height * 1.8, width: 210 },
      { x: width * 0.36, y: startingY - height * 2.75, width: 190 },
    ];

    this.platforms = platformSpecs.map((platform) => {
      const graphic = this.add.rectangle(
        platform.x,
        platform.y,
        platform.width,
        18,
        0x94a3b8,
      );
      return {
        left: platform.x - platform.width / 2,
        right: platform.x + platform.width / 2,
        top: platform.y - 9,
        graphic,
      };
    });
  }

  private createOverlays(width: number, height: number): void {
    const pauseBackground = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x020617,
      0.78,
    );
    const pauseText = this.add
      .text(width / 2, height / 2, 'ПАУЗА\nНажми Esc или P, чтобы продолжить', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '30px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 12,
      })
      .setOrigin(0.5);
    this.pauseOverlay = this.add
      .container(0, 0, [pauseBackground, pauseText])
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    const gameOverBackground = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x020617,
      0.82,
    );
    this.gameOverText = this.add
      .text(width / 2, height / 2 - 70, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5);
    const restartButton = this.add
      .rectangle(width / 2, height / 2 + 45, 250, 58, 0x0284c7);
    const restartLabel = this.add
      .text(width / 2, height / 2 + 45, 'Начать сначала', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.gameOverOverlay = this.add
      .container(0, 0, [gameOverBackground, this.gameOverText, restartButton, restartLabel])
      .setScrollFactor(0)
      .setDepth(101)
      .setVisible(false);
  }

  private togglePause(): void {
    if (this.gameOver) return;
    this.paused = !this.paused;
    this.pauseOverlay.setVisible(this.paused);
    if (this.paused) this.isReeling = false;
  }

  private ensureWorldAhead(): void {
    const generationThreshold = this.cameras.main.scrollY - this.scale.height;
    while (this.generatedTop > generationThreshold) {
      this.generateUpperChunk();
    }
  }

  private generateUpperChunk(): void {
    const { width, height } = this.scale;
    const chunkHeight = height * WORLD_CHUNK_HEIGHT;
    const previousTop = this.generatedTop;
    const nextTop = previousTop - chunkHeight;

    this.wallSegments.push(
      this.add.rectangle(
        WALL_WIDTH / 2,
        (previousTop + nextTop) / 2,
        WALL_WIDTH,
        chunkHeight + 2,
        0x475569,
      ),
      this.add.rectangle(
        width - WALL_WIDTH / 2,
        (previousTop + nextTop) / 2,
        WALL_WIDTH,
        chunkHeight + 2,
        0x475569,
      ),
    );

    const xPositions = [0.38, 0.62, 0.84, 0.62, 0.38];
    const rises = [0.12, 0.3, 0.48, 0.66, 0.84];
    for (let index = 0; index < rises.length; index += 1) {
      const x = width * xPositions[index]!;
      const y = previousTop - chunkHeight * rises[index]!;
      const marker = this.add.circle(x, y, 9, 0x38bdf8).setStrokeStyle(3, 0xe0f2fe);
      this.anchorPoints.push({ x, y, marker });
    }

    this.addFly(width * 0.28, previousTop - chunkHeight * 0.36);
    this.addFly(width * 0.72, previousTop - chunkHeight * 0.82);

    const platformX = width * (this.platforms.length % 2 === 0 ? 0.32 : 0.7);
    const platformY = previousTop - chunkHeight * 0.72;
    const platformWidth = 190;
    const graphic = this.add.rectangle(platformX, platformY, platformWidth, 18, 0x94a3b8);
    this.platforms.push({
      left: platformX - platformWidth / 2,
      right: platformX + platformWidth / 2,
      top: platformY - 9,
      graphic,
    });

    this.generatedTop = nextTop;
  }

  private removeSubmergedObjects(): void {
    this.anchorPoints = this.anchorPoints.filter((point) => {
      if (point.y < this.waterY || point === this.anchor) return true;
      point.marker.destroy();
      return false;
    });

    this.platforms = this.platforms.filter((platform) => {
      if (platform.top < this.waterY) return true;
      platform.graphic.destroy();
      return false;
    });

    this.wallSegments = this.wallSegments.filter((wall) => {
      if (wall.getBounds().top < this.waterY) return true;
      wall.destroy();
      return false;
    });

    this.spikes = this.spikes.filter((spike) => {
      if (spike.y < this.waterY) return true;
      spike.graphic.destroy();
      return false;
    });

    this.flies = this.flies.filter((fly) => {
      if (fly.y < this.waterY) return true;
      fly.graphic.destroy();
      return false;
    });
  }

  private ensureSpikesAhead(): void {
    if (this.score < PHASE_TWO_CONFIG.fliesToStart) return;

    if (!this.spikesActive) {
      this.spikesActive = true;
      this.nextSpikeY = this.player.y - this.scale.height * PHASE_TWO_CONFIG.firstSpikeLeadScreens;
      this.phaseWarning.setAlpha(1);
      this.warningRemaining =
        PHASE_TWO_CONFIG.warningHoldSeconds + PHASE_TWO_CONFIG.warningFadeSeconds;
    }

    const spawnLimit =
      this.player.y - this.scale.height * PHASE_TWO_CONFIG.spikeSpawnAheadScreens;
    while (this.nextSpikeY !== null && this.nextSpikeY > spawnLimit) {
      this.spawnSpikeCluster(this.nextSpikeY);
      this.nextSpikeY -= PHASE_TWO_CONFIG.spikeSpawnInterval;
    }
  }

  private updatePhaseWarning(seconds: number): void {
    if (this.warningRemaining <= 0) return;
    this.warningRemaining = Math.max(0, this.warningRemaining - seconds);
    const alpha = Math.min(1, this.warningRemaining / PHASE_TWO_CONFIG.warningFadeSeconds);
    this.phaseWarning.setAlpha(alpha);
  }

  private spawnSpikeCluster(y: number): void {
    const { width } = this.scale;
    const clusterX = Phaser.Math.Between(
      width * PHASE_TWO_CONFIG.clusterMinX,
      width * PHASE_TWO_CONFIG.clusterMaxX,
    );

    for (const offsetX of PHASE_TWO_CONFIG.spikeOffsetsX) {
      const x = Phaser.Math.Clamp(
        clusterX + offsetX,
        WALL_WIDTH + PHASE_TWO_CONFIG.spikeHitRadius,
        width - WALL_WIDTH - PHASE_TWO_CONFIG.spikeHitRadius,
      );
      const graphic = this.add.triangle(
        x,
        y,
        0,
        PHASE_TWO_CONFIG.spikeHeight,
        PHASE_TWO_CONFIG.spikeWidth / 2,
        0,
        PHASE_TWO_CONFIG.spikeWidth,
        PHASE_TWO_CONFIG.spikeHeight,
        PHASE_TWO_CONFIG.spikeColor,
      ).setStrokeStyle(2, PHASE_TWO_CONFIG.spikeStrokeColor);
      this.spikes.push({ x, y: y + 10, graphic });
    }
  }

  private checkSpikeCollision(): void {
    const hit = this.spikes.some(
      (spike) =>
        Phaser.Math.Distance.Between(this.player.x, this.player.y, spike.x, spike.y) <=
        PHASE_TWO_CONFIG.spikeHitRadius,
    );
    if (hit) this.endGame(PHASE_TWO_CONFIG.collisionMessage);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.gameOver) {
      const buttonCenterY = this.scale.height / 2 + 45;
      const clickedRestart =
        Math.abs(pointer.x - this.scale.width / 2) <= 125 &&
        Math.abs(pointer.y - buttonCenterY) <= 29;
      if (clickedRestart) this.restart();
      return;
    }
    if (this.paused) return;

    const nearestAnchor = this.findAnchor(pointer.worldX, pointer.worldY);
    if (nearestAnchor) {
      const distanceToAnchor = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        nearestAnchor.x,
        nearestAnchor.y,
      );
      if (distanceToAnchor > MAX_ATTACH_DISTANCE) {
        this.statusText.setText('Подлети ближе к голубой точке, чтобы зацепиться.');
        return;
      }

      this.attachTo(nearestAnchor);
      this.isReeling = true;
      this.statusText.setText('Паутина подтягивает! Нажми ПРОБЕЛ, чтобы остановить подтягивание и раскачиваться.');
      return;
    }

    if (this.anchor) {
      this.releaseThread();
    } else {
      this.statusText.setText('Нажми на голубую точку рядом с пауком, чтобы зацепиться.');
    }
  }

  private findAnchor(x: number, y: number): AnchorPoint | null {
    let nearest: AnchorPoint | null = null;
    let nearestDistance = ANCHOR_SELECT_RADIUS;

    for (const point of this.anchorPoints) {
      const distance = Phaser.Math.Distance.Between(x, y, point.x, point.y);
      if (distance <= nearestDistance) {
        nearest = point;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  private attachTo(point: AnchorPoint): void {
    if (this.anchor) this.anchor.marker.setFillStyle(0x38bdf8);
    this.anchor = point;
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      point.x,
      point.y,
    );
    this.ropeLength = Math.max(distance, 1);
    point.marker.setFillStyle(0xf8fafc);
  }

  private releaseThread(): void {
    if (!this.anchor || this.gameOver) return;
    this.anchor.marker.setFillStyle(0x38bdf8);
    this.anchor = null;
    this.isReeling = false;
    this.statusText.setText('Нить отпущена! Лети к следующей точке или нажми ПРОБЕЛ на платформе.');
  }

  private stopReeling(): void {
    if (!this.anchor) return;
    this.isReeling = false;
  }

  private jumpFromPlatform(): void {
    if (this.gameOver || this.paused) return;
    if (this.anchor) {
      this.stopReeling();
      this.statusText.setText('Подтягивание остановлено — раскачивайся и кликай в пустоту, чтобы отпустить нить.');
      return;
    }
    if (!this.isGrounded) return;

    this.isGrounded = false;
    this.velocityY = -PLATFORM_JUMP_SPEED;
    this.statusText.setText('Прыгни к голубой точке и нажми на неё, чтобы зацепиться.');
  }

  private updateSpider(seconds: number): void {
    const { width } = this.scale;
    const previousY = this.player.y;
    const wasGrounded = this.isGrounded;
    this.isGrounded = false;
    if (!this.anchor && wasGrounded) {
      const movingRight = this.cursors.right.isDown || this.wasd.right.isDown;
      const movingLeft = this.cursors.left.isDown || this.wasd.left.isDown;
      this.velocityX = Number(movingRight) * PLATFORM_MOVE_SPEED -
        Number(movingLeft) * PLATFORM_MOVE_SPEED;
    } else if (this.anchor) {
      const steeringRight = this.cursors.right.isDown || this.wasd.right.isDown;
      const steeringLeft = this.cursors.left.isDown || this.wasd.left.isDown;
      const direction = Number(steeringRight) - Number(steeringLeft);
      this.velocityX += direction * SWING_STEERING_ACCELERATION * seconds;
    }
    const gravityMultiplier = this.anchor ? SWING_GRAVITY_MULTIPLIER : 1;
    this.velocityY += GRAVITY * gravityMultiplier * seconds;
    this.player.x += this.velocityX * seconds;
    this.player.y += this.velocityY * seconds;

    if (this.anchor) {
      if (this.isReeling) {
        this.ropeLength = Math.max(
          MIN_ROPE_LENGTH,
          this.ropeLength - REEL_SPEED * seconds,
        );
      }

      const dx = this.player.x - this.anchor.x;
      const dy = this.player.y - this.anchor.y;
      const distance = Math.max(Math.hypot(dx, dy), 1);
      const normalX = dx / distance;
      const normalY = dy / distance;

      this.player.setPosition(
        this.anchor.x + normalX * this.ropeLength,
        this.anchor.y + normalY * this.ropeLength,
      );

      const radialVelocity = this.velocityX * normalX + this.velocityY * normalY;
      this.velocityX -= radialVelocity * normalX;
      this.velocityY -= radialVelocity * normalY;
      this.resolveRopePlatformCollision(previousY);
    } else {
      this.keepSpiderInBounds(width);
      this.landOnPlatform(previousY);
    }
  }

  private resolveRopePlatformCollision(previousY: number): void {
    if (this.velocityY >= 0 || !this.anchor) return;

    const previousTop = previousY - PLAYER_RADIUS;
    const currentTop = this.player.y - PLAYER_RADIUS;

    for (const platform of this.platforms) {
      const overlapsHorizontally =
        this.player.x >= platform.left - PLAYER_RADIUS &&
        this.player.x <= platform.right + PLAYER_RADIUS;
      const platformBottom = platform.top + 18;
      const crossedUnderside =
        previousTop >= platformBottom && currentTop <= platformBottom;
      if (!overlapsHorizontally || !crossedUnderside) continue;

      this.player.y = platformBottom + PLAYER_RADIUS;
      this.ropeLength = Phaser.Math.Distance.Between(
        this.anchor.x,
        this.anchor.y,
        this.player.x,
        this.player.y,
      );
      this.velocityY = Math.abs(this.velocityY) * 0.5;
      this.isReeling = false;
      this.statusText.setText('Платформа остановила подтягивание. Качайся или отпусти нить.');
      return;
    }
  }

  private keepSpiderInBounds(width: number): void {
    const leftEdge = WALL_WIDTH + PLAYER_RADIUS;
    const rightEdge = width - WALL_WIDTH - PLAYER_RADIUS;
    if (this.player.x < leftEdge) {
      this.player.x = leftEdge;
      this.velocityX = Math.abs(this.velocityX) * 0.65;
    } else if (this.player.x > rightEdge) {
      this.player.x = rightEdge;
      this.velocityX = -Math.abs(this.velocityX) * 0.65;
    }

  }

  private updateCamera(seconds: number): void {
    const camera = this.cameras.main;
    const targetY = this.player.y - this.scale.height * 0.68;
    camera.scrollY += (targetY - camera.scrollY) * Math.min(1, seconds * 5);
  }

  private landOnPlatform(previousY: number): void {
    const previousBottom = previousY + PLAYER_RADIUS;
    const currentBottom = this.player.y + PLAYER_RADIUS;
    const previousTop = previousY - PLAYER_RADIUS;
    const currentTop = this.player.y - PLAYER_RADIUS;

    for (const platform of this.platforms) {
      const overlapsHorizontally =
        this.player.x >= platform.left - PLAYER_RADIUS &&
        this.player.x <= platform.right + PLAYER_RADIUS;
      if (!overlapsHorizontally) continue;

      if (
        this.velocityY >= 0 &&
        previousBottom <= platform.top &&
        currentBottom >= platform.top
      ) {
        this.player.y = platform.top - PLAYER_RADIUS;
        this.velocityY = 0;
        this.velocityX *= 0.8;
        this.isGrounded = true;
        return;
      }

      const platformBottom = platform.top + 18;
      if (
        this.velocityY < 0 &&
        previousTop >= platformBottom &&
        currentTop <= platformBottom
      ) {
        this.player.y = platformBottom + PLAYER_RADIUS;
        this.velocityY = Math.abs(this.velocityY) * 0.5;
        return;
      }
    }
  }

  private updateWater(): void {
    const { width } = this.scale;
    this.water.setSize(width, this.worldHeight - this.waterY);
    this.water.setPosition(width / 2, (this.worldHeight + this.waterY) / 2);
  }

  private checkFly(): void {
    this.flies = this.flies.filter((fly) => {
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        fly.x,
        fly.y,
      );
      if (distance > PLAYER_RADIUS + FLY_COLLISION_RADIUS) return true;

      fly.graphic.destroy();
      this.score += 1;
      this.scoreText.setText(`Мухи: ${this.score}`);
      return false;
    });
  }

  private endGame(message = 'Вода поймала паука!'): void {
    this.gameOver = true;
    this.paused = false;
    this.isReeling = false;
    if (this.anchor) this.anchor.marker.setFillStyle(0x38bdf8);
    this.anchor = null;
    this.pauseOverlay.setVisible(false);
    this.gameOverText.setText(`${message}\nСъедено мух: ${this.score}`);
    this.gameOverOverlay.setVisible(true);
  }

  private restart(): void {
    this.scene.restart();
  }
}
