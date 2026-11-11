import Phaser from 'phaser';
import {
  PHASE_FOUR_CONFIG,
  PHASE_THREE_CONFIG,
  PHASE_TWO_CONFIG,
} from './phaseConfig';

const WALL_WIDTH = 24;
const PLAYER_RADIUS = 14;
const FLY_RADIUS = 10;
const FLY_COLLISION_RADIUS = 18;
const GRAVITY = 820;
const SWING_GRAVITY_MULTIPLIER = 1.4;
const SWING_STEERING_ACCELERATION = 260;
const WATER_RISE_SPEED = 60;
const MAX_ATTACH_DISTANCE = 460;
const REEL_SPEED = 150;
const MIN_ROPE_LENGTH = 72;
const ANCHOR_SELECT_RADIUS = 42;
const PLATFORM_JUMP_SPEED = 390;
const PLATFORM_MOVE_SPEED = 220;
const WORLD_HEIGHT_MULTIPLIER = 4;
const WORLD_CHUNK_HEIGHT = 1.2;
const LEADERBOARD_KEY = 'spider-game-leaderboard';
const LEADERBOARD_LIMIT = 10;
const LEADERBOARD_DISPLAY_LIMIT = 5;

type LeaderboardEntry = {
  name: string;
  score: number;
  date: string;
};

type AnchorPoint = {
  x: number;
  y: number;
  marker: Phaser.GameObjects.Arc;
  halo: Phaser.GameObjects.Arc;
};

type Platform = {
  left: number;
  right: number;
  top: number;
  graphic: Phaser.GameObjects.Rectangle;
  leaf: Phaser.GameObjects.Ellipse;
};

type Spike = {
  x: number;
  y: number;
  graphic: Phaser.GameObjects.Triangle;
  highlight: Phaser.GameObjects.Triangle;
};

type Fly = {
  x: number;
  y: number;
  graphic: Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
};

type Butterfly = {
  baseX: number;
  baseY: number;
  graphic: Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
  spawnedAt: number;
  phaseOffset: number;
};

type Ladybug = {
  baseX: number;
  baseY: number;
  graphic: Phaser.GameObjects.Arc | Phaser.GameObjects.Container | Phaser.GameObjects.Image;
  spawnedAt: number;
  phaseOffset: number;
};

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
  private rope!: Phaser.GameObjects.Graphics;
  private water!: Phaser.GameObjects.Graphics;
  private waterGlow!: Phaser.GameObjects.Ellipse;
  private shieldAura!: Phaser.GameObjects.Arc;
  private parallaxObjects: Array<{ object: Phaser.GameObjects.GameObject; worldY: number }> = [];
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private gameOverOverlay!: Phaser.GameObjects.Container;
  private menuOverlay!: Phaser.GameObjects.Container;
  private recordsOverlay!: Phaser.GameObjects.Container;
  private gameOverText!: Phaser.GameObjects.Text;
  private gameOverLeaderboardText!: Phaser.GameObjects.Text;
  private menuLeaderboardText!: Phaser.GameObjects.Text;
  private phaseWarning!: Phaser.GameObjects.Text;
  private ladybugWarning!: Phaser.GameObjects.Text;
  private maxHeightReached = 0;
  private startingY = 0;
  private finalScore = 0;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'left' | 'right', Phaser.Input.Keyboard.Key>;
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private escapeKey!: Phaser.Input.Keyboard.Key;
  private anchorPoints: AnchorPoint[] = [];
  private platforms: Platform[] = [];
  private flies: Fly[] = [];
  private butterflies: Butterfly[] = [];
  private ladybugs: Ladybug[] = [];
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
  private parallaxOriginY = 0;
  private generatedTop = 0;
  private elapsedGameTime = 0;
  private warningRemaining = 0;
  private ladybugWarningRemaining = 0;
  private nextSpikeY: number | null = null;
  private nextButterflyY: number | null = null;
  private nextLadybugY: number | null = null;
  private score = 0;
  private bonusPoints = 0;
  private butterflySpawnCount = 0;
  private ladybugSpawnCount = 0;
  private spikesActive = false;
  private butterfliesActive = false;
  private ladybugsActive = false;
  private hasShield = false;
  private shieldRemaining = 0;
  private gameStarted = false;
  private menuShowingRecords = false;
  private leaderboardUnavailable = false;
  private gameOver = false;
  private paused = false;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.load.image('spider', new URL('../spider.png', import.meta.url).href);
    this.load.image('fly', new URL('../fly.png', import.meta.url).href);
    this.load.image('butterfly', new URL('../butterfly.png', import.meta.url).href);
    this.load.image('bug', new URL('../bug.png', import.meta.url).href);
  }

  create(): void {
    const { width, height } = this.scale;
    const worldHeight = height * WORLD_HEIGHT_MULTIPLIER;
    const startingY = height * 3.5;
    this.parallaxOriginY = startingY - height * 0.68;
    this.startingY = startingY;
    this.worldHeight = worldHeight;
    this.score = 0;
    this.bonusPoints = 0;
    this.butterflySpawnCount = 0;
    this.ladybugSpawnCount = 0;
    this.maxHeightReached = 0;
    this.finalScore = 0;
    this.velocityX = 0;
    this.velocityY = 0;
    this.anchor = null;
    this.isReeling = false;
    this.isGrounded = false;
    this.anchorPoints = [];
    this.platforms = [];
    this.flies = [];
    this.butterflies = [];
    this.ladybugs = [];
    this.spikes = [];
    this.wallSegments = [];
    this.elapsedGameTime = 0;
    this.warningRemaining = 0;
    this.ladybugWarningRemaining = 0;
    this.nextSpikeY = null;
    this.nextButterflyY = null;
    this.nextLadybugY = null;
    this.spikesActive = false;
    this.butterfliesActive = false;
    this.ladybugsActive = false;
    this.hasShield = false;
    this.shieldRemaining = 0;
    this.gameStarted = false;
    this.menuShowingRecords = false;
    this.leaderboardUnavailable = false;
    this.waterY = worldHeight;
    this.gameOver = false;
    this.paused = false;
    this.parallaxObjects = [];
    this.cameras.main.setBackgroundColor('#080b20');

    this.wallSegments.push(
      this.createWallSegment(WALL_WIDTH / 2, worldHeight / 2, WALL_WIDTH, worldHeight),
      this.createWallSegment(width - WALL_WIDTH / 2, worldHeight / 2, WALL_WIDTH, worldHeight),
    );
    this.createNightSky(width, height, worldHeight);

    this.add
      .text(width / 2, 18, 'ПАУК', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: '#f1f5f9',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);

    this.scoreText = this.add.text(24, 24, 'Очки: 0 | Мухи: 0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '21px',
      color: '#f1f5f9',
    }).setScrollFactor(0).setDepth(12);
    this.timerText = this.add.text(width - 24, 24, 'Время: 00:00', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '21px',
      color: '#f1f5f9',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(12);
    const hudPanels = this.add.graphics().setScrollFactor(0).setDepth(11);
    hudPanels.fillStyle(0x0f172a, 0.72);
    hudPanels.lineStyle(1, 0x94a3b8, 0.3);
    hudPanels.fillRoundedRect(14, 16, 250, 40, 10);
    hudPanels.strokeRoundedRect(14, 16, 250, 40, 10);
    hudPanels.fillRoundedRect(width - 198, 16, 184, 40, 10);
    hudPanels.strokeRoundedRect(width - 198, 16, 184, 40, 10);
    this.phaseWarning = this.add
      .text(width / 2, height * 0.2, PHASE_TWO_CONFIG.warningText, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '26px',
        color: '#f1f5f9',
        backgroundColor: '#7f1d1d',
        padding: { x: 18, y: 12 },
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0);
    this.ladybugWarning = this.add
      .text(width / 2, height * 0.3, PHASE_FOUR_CONFIG.warningText, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#f1f5f9',
        backgroundColor: '#991b1b',
        padding: { x: 16, y: 10 },
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0);
    this.createControlHint(height);

    this.createPlatforms(width, height, startingY);
    this.createAnchorPoints(width, height, startingY);
    this.createStartingFlies(width, height, startingY);
    this.generatedTop = Math.min(...this.anchorPoints.map((point) => point.y));

    this.water = this.add.graphics().setDepth(2);
    this.waterGlow = this.add.ellipse(width / 2, worldHeight, 120, 34, 0x67e8f9, 0.12)
      .setDepth(3);
    this.rope = this.add.graphics().setDepth(7);
    this.player = this.textures.exists('spider')
      ? this.add.image(width * 0.3, startingY, 'spider').setDisplaySize(38, 38)
      : this.add.circle(width * 0.3, startingY, PLAYER_RADIUS, 0xf1f5f9);
    this.player.setDepth(8);
    this.shieldAura = this.add.circle(
      this.player.x,
      this.player.y,
      PLAYER_RADIUS + 14,
      0x86efac,
      0.3,
    )
      .setStrokeStyle(3, 0xbbf7d0, 0.75)
      .setDepth(7)
      .setVisible(false);

    const startingAnchor = this.anchorPoints[0];
    if (!startingAnchor) {
      throw new Error('At least one spider anchor point is required.');
    }
    this.attachTo(startingAnchor);

    this.input.on('pointerdown', this.handlePointerDown, this);
    this.cameras.main.scrollY = startingY - height * 0.68;
    this.createOverlays(width, height);
    this.showMenu();

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
    if (!this.gameStarted || this.gameOver || this.paused) return;

    const seconds = Math.min(delta / 1000, 0.05);
    this.elapsedGameTime += seconds;
    this.updateTimer();
    this.updatePhaseWarning(seconds);
    this.updateLadybugWarning(seconds);
    this.waterY -= WATER_RISE_SPEED * seconds;
    this.ensureWorldAhead();
    this.ensureSpikesAhead();
    this.ensureButterfliesAhead();
    this.ensureLadybugsAhead();
    this.updateWater(_time);
    this.updateSpider(seconds);
    this.updateShield(seconds);
    this.maxHeightReached = Math.max(
      this.maxHeightReached,
      this.startingY - this.player.y,
    );
    this.updateScoreText();
    this.updateCamera(seconds);
    this.checkFly();
    this.updateButterflyPositions();
    this.checkButterfly();
    this.updateLadybugPositions();
    this.checkLadybug();
    this.checkSpikeCollision();
    this.removeSubmergedObjects();

    if (!this.gameOver && this.player.y + PLAYER_RADIUS >= this.waterY) {
      this.endGame();
    }

    this.rope.clear();
    if (this.anchor) {
      this.rope.lineStyle(5, 0x67e8f9, 0.18);
      this.rope.lineBetween(this.anchor.x, this.anchor.y, this.player.x, this.player.y);
      this.rope.lineStyle(1.5, 0xe0f2fe, 0.92);
      this.rope.lineBetween(this.anchor.x, this.anchor.y, this.player.x, this.player.y);
    }
  }

  private createNightSky(width: number, height: number, worldHeight: number): void {
    const sky = this.add.graphics().setScrollFactor(0).setDepth(-100);
    sky.fillGradientStyle(0x080b20, 0x080b20, 0x21143b, 0x21143b, 1);
    sky.fillRect(0, 0, width, height);

    const moonY = this.parallaxY(this.parallaxOriginY + 120, 0.12);
    this.add.ellipse(width * 0.78, moonY, 150, 150, 0x93c5fd, 0.08)
      .setScrollFactor(0.12)
      .setDepth(-96);
    this.add.circle(width * 0.78, moonY, 34, 0xfef3c7, 0.9)
      .setScrollFactor(0.12)
      .setDepth(-95);

    const stars = this.add.graphics().setScrollFactor(0.2).setDepth(-90);
    stars.fillStyle(0xe0e7ff, 0.62);
    for (let index = 0; index < 100; index += 1) {
      const x = Phaser.Math.Between(32, width - 32);
      const y = this.parallaxY(Phaser.Math.Between(0, worldHeight), 0.2);
      const radius = Phaser.Math.FloatBetween(0.7, 1.8);
      stars.fillCircle(x, y, radius);
    }

    const branches = this.add.graphics().setScrollFactor(0.46).setDepth(-80);
    branches.lineStyle(11, 0x172b32, 0.8);
    for (let worldY = -40; worldY < worldHeight; worldY += 360) {
      const y = this.parallaxY(worldY, 0.46);
      branches.beginPath();
      branches.moveTo(0, y + 100);
      branches.lineTo(width * 0.12, y + 68);
      branches.lineTo(width * 0.22, y + 90);
      branches.moveTo(width, y + 190);
      branches.lineTo(width * 0.88, y + 152);
      branches.lineTo(width * 0.78, y + 174);
      branches.strokePath();
      branches.fillStyle(0x29433a, 0.76);
      branches.fillEllipse(width * 0.18, y + 70, 42, 16);
      branches.fillEllipse(width * 0.84, y + 158, 48, 17);
    }
  }

  private createWallSegment(
    x: number,
    y: number,
    width: number,
    height: number,
  ): Phaser.GameObjects.Rectangle {
    return this.add
      .rectangle(x, y, width, height, 0x334155, 0.78)
      .setStrokeStyle(1, 0x64748b, 0.45);
  }

  private parallaxY(worldY: number, scrollFactor: number): number {
    return worldY - (1 - scrollFactor) * this.parallaxOriginY;
  }

  private createAnchorPoint(x: number, y: number): AnchorPoint {
    const halo = this.add.circle(x, y, 19, 0x67e8f9, 0.16).setDepth(4);
    const marker = this.add.circle(x, y, 8, 0xa5f3fc)
      .setStrokeStyle(2, 0xe0f2fe, 0.9)
      .setDepth(5);
    return { x, y, marker, halo };
  }

  private createPlatform(x: number, y: number, width: number): Platform {
    const graphic = this.add
      .rectangle(x, y, width, 18, 0x3f6212)
      .setStrokeStyle(2, 0xa3a35a, 0.9)
      .setDepth(4);
    const leaf = this.add.ellipse(x, y - 10, Math.min(64, width * 0.32), 13, 0x65a30d)
      .setStrokeStyle(1, 0xb7d17c, 0.8)
      .setDepth(5);
    return { left: x - width / 2, right: x + width / 2, top: y - 9, graphic, leaf };
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
      return this.createAnchorPoint(width * x, startingY - height * rise);
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

  private createControlHint(height: number): void {
    const background = this.add
      .rectangle(16, height - 86, 440, 70, 0x020617, 0.7)
      .setOrigin(0);
    const hint = this.add
      .text(
        28,
        height - 78,
        'Клик по точке — зацепиться    •    Клик мимо — отпустить\nПробел — стоп / прыжок    •    A/D или ←/→ — качаться / идти\nEsc/P — пауза',
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '13px',
          color: '#f1f5f9',
          lineSpacing: 4,
        },
      )
      .setOrigin(0);
    this.add
      .container(0, 0, [background, hint])
      .setScrollFactor(0)
      .setDepth(10)
      .setAlpha(0.9);
  }

  private addFly(x: number, y: number): void {
    const graphic = this.textures.exists('fly')
      ? this.add.image(x, y, 'fly').setDisplaySize(28, 28)
      : this.add.circle(x, y, FLY_RADIUS, 0xfacc15);
    graphic.setDepth(6);
    this.flies.push({ x, y, graphic });
  }

  private ensureButterfliesAhead(): void {
    if (this.score < PHASE_THREE_CONFIG.fliesToStart) return;

    if (!this.butterfliesActive) {
      this.butterfliesActive = true;
      this.nextButterflyY =
        this.player.y - this.scale.height * PHASE_THREE_CONFIG.firstButterflyLeadScreens;
      this.phaseWarning.setText(PHASE_THREE_CONFIG.warningText);
      this.phaseWarning.setBackgroundColor('#6b21a8');
      this.phaseWarning.setAlpha(1);
      this.warningRemaining =
        PHASE_THREE_CONFIG.warningHoldSeconds + PHASE_THREE_CONFIG.warningFadeSeconds;
    }

    const spawnLimit =
      this.player.y - this.scale.height * PHASE_THREE_CONFIG.butterflySpawnAheadScreens;
    while (this.nextButterflyY !== null && this.nextButterflyY > spawnLimit) {
      this.spawnButterfly(this.nextButterflyY);
      this.nextButterflyY -= PHASE_THREE_CONFIG.butterflySpawnInterval;
    }
  }

  private spawnButterfly(y: number): void {
    const sequence = this.butterflySpawnCount;
    this.butterflySpawnCount += 1;
    const baseX = this.scale.width * (sequence % 2 === 0 ? 0.3 : 0.7);
    const graphic = this.textures.exists('butterfly')
      ? this.add.image(baseX, y, 'butterfly').setDisplaySize(
          PHASE_THREE_CONFIG.visualRadius * 2,
          PHASE_THREE_CONFIG.visualRadius * 2,
        )
      : this.add.circle(baseX, y, PHASE_THREE_CONFIG.visualRadius, 0xf0abfc)
          .setStrokeStyle(3, 0xfef3c7);
    graphic.setDepth(7);
    this.butterflies.push({
      baseX,
      baseY: y,
      graphic,
      spawnedAt: this.elapsedGameTime,
      phaseOffset: sequence * Math.PI / 2,
    });
  }

  private updateButterflyPositions(): void {
    const angularSpeed = 2 * Math.PI / PHASE_THREE_CONFIG.trajectoryPeriodSeconds;
    const minX = WALL_WIDTH + PHASE_THREE_CONFIG.visualRadius;
    const maxX = this.scale.width - WALL_WIDTH - PHASE_THREE_CONFIG.visualRadius;

    for (const butterfly of this.butterflies) {
      const elapsed = this.elapsedGameTime - butterfly.spawnedAt;
      const phase = elapsed * angularSpeed + butterfly.phaseOffset;
      const x = butterfly.baseX +
        Math.sin(phase) * PHASE_THREE_CONFIG.trajectoryAmplitudeX;
      const y = butterfly.baseY +
        Math.sin(phase + Math.PI / 2) * PHASE_THREE_CONFIG.trajectoryAmplitudeY;
      butterfly.graphic.setPosition(Phaser.Math.Clamp(x, minX, maxX), y);
    }
  }

  private checkButterfly(): void {
    this.butterflies = this.butterflies.filter((butterfly) => {
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        butterfly.graphic.x,
        butterfly.graphic.y,
      );
      if (distance > PLAYER_RADIUS + PHASE_THREE_CONFIG.collisionRadius) return true;

      this.tweens.add({
        targets: butterfly.graphic,
        scaleX: butterfly.graphic.scaleX * 1.8,
        scaleY: butterfly.graphic.scaleY * 1.8,
        alpha: 0,
        duration: 220,
        onComplete: () => butterfly.graphic.destroy(),
      });
      const rewardText = this.add.text(
        butterfly.graphic.x,
        butterfly.graphic.y - 12,
        `+${PHASE_THREE_CONFIG.scoreValue}`,
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '22px',
          color: '#f0abfc',
          stroke: '#312e81',
          strokeThickness: 4,
        },
      ).setOrigin(0.5).setDepth(10);
      this.tweens.add({
        targets: rewardText,
        y: butterfly.graphic.y - 48,
        alpha: 0,
        duration: 600,
        onComplete: () => rewardText.destroy(),
      });
      this.bonusPoints += PHASE_THREE_CONFIG.scoreValue;
      this.updateScoreText();
      return false;
    });
  }

  private ensureLadybugsAhead(): void {
    if (this.score < PHASE_FOUR_CONFIG.fliesToStart) return;

    if (!this.ladybugsActive) {
      this.ladybugsActive = true;
      this.nextLadybugY =
        this.player.y - this.scale.height * PHASE_FOUR_CONFIG.firstLadybugLeadScreens;
      this.ladybugWarning.setAlpha(1);
      this.ladybugWarningRemaining =
        PHASE_FOUR_CONFIG.warningHoldSeconds + PHASE_FOUR_CONFIG.warningFadeSeconds;
    }

    const spawnLimit =
      this.player.y - this.scale.height * PHASE_FOUR_CONFIG.ladybugSpawnAheadScreens;
    while (this.nextLadybugY !== null && this.nextLadybugY > spawnLimit) {
      this.spawnLadybug(this.nextLadybugY);
      this.nextLadybugY -= PHASE_FOUR_CONFIG.ladybugSpawnInterval;
    }
  }

  private spawnLadybug(y: number): void {
    const sequence = this.ladybugSpawnCount;
    this.ladybugSpawnCount += 1;
    const baseX = this.scale.width * (sequence % 2 === 0 ? 0.3 : 0.7);
    const graphic = this.textures.exists('bug')
      ? this.add.image(baseX, y, 'bug').setDisplaySize(
          PHASE_FOUR_CONFIG.visualRadius * 2,
          PHASE_FOUR_CONFIG.visualRadius * 2,
        )
      : this.add.container(baseX, y, [
          this.add.circle(0, 0, PHASE_FOUR_CONFIG.visualRadius, 0xdc2626)
            .setStrokeStyle(2, 0xfecaca),
          this.add.circle(-7, -5, 3, 0x111827),
          this.add.circle(7, -5, 3, 0x111827),
          this.add.circle(-7, 6, 3, 0x111827),
          this.add.circle(7, 6, 3, 0x111827),
        ]);
    graphic.setDepth(7);
    this.ladybugs.push({
      baseX,
      baseY: y,
      graphic,
      spawnedAt: this.elapsedGameTime,
      phaseOffset: sequence * Math.PI / 2,
    });
  }

  private updateLadybugPositions(): void {
    const angularSpeed = 2 * Math.PI / PHASE_FOUR_CONFIG.trajectoryPeriodSeconds;
    const minX = WALL_WIDTH + PHASE_FOUR_CONFIG.visualRadius;
    const maxX = this.scale.width - WALL_WIDTH - PHASE_FOUR_CONFIG.visualRadius;

    for (const ladybug of this.ladybugs) {
      const elapsed = this.elapsedGameTime - ladybug.spawnedAt;
      const phase = elapsed * angularSpeed + ladybug.phaseOffset;
      const x = ladybug.baseX +
        Math.sin(phase) * PHASE_FOUR_CONFIG.trajectoryAmplitudeX;
      const y = ladybug.baseY +
        Math.sin(phase + Math.PI / 2) * PHASE_FOUR_CONFIG.trajectoryAmplitudeY;
      ladybug.graphic.setPosition(Phaser.Math.Clamp(x, minX, maxX), y);
    }
  }

  private checkLadybug(): void {
    this.ladybugs = this.ladybugs.filter((ladybug) => {
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        ladybug.graphic.x,
        ladybug.graphic.y,
      );
      if (distance > PLAYER_RADIUS + PHASE_FOUR_CONFIG.collisionRadius) return true;

      this.tweens.add({
        targets: ladybug.graphic,
        scaleX: ladybug.graphic.scaleX * 1.5,
        scaleY: ladybug.graphic.scaleY * 1.5,
        alpha: 0,
        duration: 180,
        onComplete: () => ladybug.graphic.destroy(),
      });
      this.hasShield = true;
      this.shieldRemaining = PHASE_FOUR_CONFIG.shieldDurationSeconds;
      this.shieldAura.setPosition(this.player.x, this.player.y).setVisible(true);
      return false;
    });
  }

  private updateShield(seconds: number): void {
    if (!this.hasShield) {
      this.shieldAura.setVisible(false);
      return;
    }

    this.shieldRemaining = Math.max(0, this.shieldRemaining - seconds);
    if (this.shieldRemaining === 0) {
      this.hasShield = false;
      this.shieldAura.setVisible(false);
      return;
    }

    this.shieldAura
      .setPosition(this.player.x, this.player.y)
      .setAlpha(0.24 + Math.sin(this.elapsedGameTime * 8) * 0.08)
      .setVisible(true);
  }

  private updateLadybugWarning(seconds: number): void {
    if (this.ladybugWarningRemaining <= 0) return;
    this.ladybugWarningRemaining = Math.max(0, this.ladybugWarningRemaining - seconds);
    const alpha = Math.min(
      1,
      this.ladybugWarningRemaining / PHASE_FOUR_CONFIG.warningFadeSeconds,
    );
    this.ladybugWarning.setAlpha(alpha);
  }

  private updateTimer(): void {
    const totalSeconds = Math.floor(this.elapsedGameTime);
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    this.timerText.setText(`Время: ${minutes}:${seconds}`);
  }

  private updateScoreText(): void {
    this.scoreText.setText(`Очки: ${this.getCurrentPoints()} | Мухи: ${this.score}`);
  }

  private createPlatforms(width: number, height: number, startingY: number): void {
    const platformSpecs = [
      { x: width * 0.32, y: startingY - height * 0.75, width: 190 },
      { x: width * 0.72, y: startingY - height * 1.8, width: 210 },
      { x: width * 0.36, y: startingY - height * 2.75, width: 190 },
    ];

    this.platforms = platformSpecs.map((platform) =>
      this.createPlatform(platform.x, platform.y, platform.width),
    );
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
        color: '#f1f5f9',
        align: 'center',
        lineSpacing: 12,
      })
      .setOrigin(0.5);
    this.pauseOverlay = this.add
      .container(0, 0, [pauseBackground, pauseText])
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    const menuBackground = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x020617,
      0.94,
    );
    const menuTitle = this.add
      .text(width / 2, 82, 'ПАУК', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '48px',
        color: '#f1f5f9',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const menuInstructions = this.add
      .text(
        width / 2,
        150,
        'Клик по голубой точке — зацепиться и подтянуться\n' +
          'ПРОБЕЛ — остановить подтягивание / прыгнуть с платформы\n' +
          'A/D или стрелки — раскачка на нити / ходьба по платформе\n' +
          'Клик в пустоту — отпустить нить\n' +
          'Esc/P — пауза',
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '18px',
          color: '#f1f5f9',
          align: 'center',
          lineSpacing: 8,
        },
      )
      .setOrigin(0.5, 0);
    const startButton = this.add.rectangle(
      width / 2,
      height * 0.72,
      260,
      58,
      0x0e7490,
    ).setStrokeStyle(2, 0x67e8f9, 0.75);
    const startLabel = this.add
      .text(width / 2, height * 0.72, 'Начать игру', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '23px',
        color: '#f1f5f9',
      })
      .setOrigin(0.5);
    const openRecordsButton = this.add.rectangle(
      width / 2,
      height * 0.84,
      260,
      52,
      0x1e293b,
    ).setStrokeStyle(1, 0x94a3b8, 0.5);
    const openRecordsLabel = this.add
      .text(width / 2, height * 0.84, 'Рекорды', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '21px',
        color: '#f1f5f9',
      })
      .setOrigin(0.5);
    this.menuOverlay = this.add
      .container(0, 0, [
        menuBackground,
        menuTitle,
        menuInstructions,
        startButton,
        startLabel,
        openRecordsButton,
        openRecordsLabel,
      ])
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false);

    const recordsBackground = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x020617,
      0.96,
    );
    const recordsTitle = this.add
      .text(width / 2, 100, 'РЕКОРДЫ', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '36px',
        color: '#f1f5f9',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.menuLeaderboardText = this.add
      .text(width / 2, 170, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#f1f5f9',
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5, 0);
    const backButton = this.add.rectangle(
      width / 2,
      height * 0.86,
      240,
      54,
      0x334155,
    );
    const backLabel = this.add
      .text(width / 2, height * 0.86, 'Назад', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '21px',
        color: '#f1f5f9',
      })
      .setOrigin(0.5);
    this.recordsOverlay = this.add
      .container(0, 0, [recordsBackground, recordsTitle, this.menuLeaderboardText, backButton, backLabel])
      .setScrollFactor(0)
      .setDepth(201)
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
      .text(width / 2, 92, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5);
    const leaderboardTitle = this.add
      .text(width / 2, 178, 'ТОП-5 РЕКОРДОВ', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '21px',
        color: '#facc15',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.gameOverLeaderboardText = this.add
      .text(width / 2, 215, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#f1f5f9',
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);
    const restartButton = this.add
      .rectangle(width / 2, height - 52, 250, 58, 0x0e7490)
      .setStrokeStyle(2, 0x67e8f9, 0.75);
    const restartLabel = this.add
      .text(width / 2, height - 52, 'Начать сначала', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#f1f5f9',
      })
      .setOrigin(0.5);
    this.gameOverOverlay = this.add
      .container(0, 0, [
        gameOverBackground,
        this.gameOverText,
        leaderboardTitle,
        this.gameOverLeaderboardText,
        restartButton,
        restartLabel,
      ])
      .setScrollFactor(0)
      .setDepth(101)
      .setVisible(false);
  }

  private showMenu(): void {
    this.gameStarted = false;
    this.menuShowingRecords = false;
    this.menuOverlay.setVisible(true);
    this.recordsOverlay.setVisible(false);
    this.menuLeaderboardText.setText(this.formatLeaderboard(this.loadLeaderboard()));
  }

  private startGame(): void {
    this.gameStarted = true;
    this.menuOverlay.setVisible(false);
    this.recordsOverlay.setVisible(false);
  }

  private showMenuRecords(): void {
    this.menuShowingRecords = true;
    this.menuLeaderboardText.setText(this.formatLeaderboard(this.loadLeaderboard()));
    this.menuOverlay.setVisible(false);
    this.recordsOverlay.setVisible(true);
  }

  private formatLeaderboard(entries: LeaderboardEntry[]): string {
    if (this.leaderboardUnavailable) return 'Таблица рекордов недоступна в этом браузере.';
    if (entries.length === 0) return 'Рекордов пока нет. Сыграй первую партию!';

    return entries
      .slice(0, LEADERBOARD_DISPLAY_LIMIT)
      .map((entry, index) => `${index + 1}. ${entry.name} — ${entry.score}`)
      .join('\n');
  }

  private loadLeaderboard(): LeaderboardEntry[] {
    this.leaderboardUnavailable = false;
    try {
      const saved = window.localStorage.getItem(LEADERBOARD_KEY);
      if (!saved) return [];

      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((item): item is LeaderboardEntry => {
          if (typeof item !== 'object' || item === null) return false;
          const entry = item as Record<string, unknown>;
          return (
            typeof entry.name === 'string' &&
            typeof entry.score === 'number' &&
            Number.isFinite(entry.score) &&
            typeof entry.date === 'string'
          );
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, LEADERBOARD_LIMIT);
    } catch (error) {
      this.leaderboardUnavailable = true;
      console.warn('Не удалось прочитать локальную таблицу рекордов.', error);
      return [];
    }
  }

  private saveLeaderboardEntry(name: string, score: number): void {
    const entries = this.loadLeaderboard();
    if (this.leaderboardUnavailable) return;

    entries.push({ name, score, date: new Date().toISOString() });
    entries.sort((a, b) => b.score - a.score);

    try {
      window.localStorage.setItem(
        LEADERBOARD_KEY,
        JSON.stringify(entries.slice(0, LEADERBOARD_LIMIT)),
      );
    } catch (error) {
      this.leaderboardUnavailable = true;
      console.warn('Не удалось сохранить результат в локальную таблицу рекордов.', error);
    }
  }

  private askForRecordName(): void {
    let inputName: string | null;
    try {
      inputName = window.prompt('Введите имя для таблицы рекордов:', 'Паук');
    } catch (error) {
      console.warn('Браузер не разрешил запросить имя игрока.', error);
      return;
    }

    if (inputName === null) return;
    const name = inputName.trim().slice(0, 20) || 'Паук';
    this.saveLeaderboardEntry(name, this.finalScore);
  }

  private getCurrentPoints(): number {
    return this.score * 10 + Math.floor(this.maxHeightReached / 50) + this.bonusPoints;
  }

  private togglePause(): void {
    if (!this.gameStarted || this.gameOver) return;
    this.paused = !this.paused;
    this.tweens.killTweensOf(this.pauseOverlay);
    if (this.paused) {
      this.pauseOverlay.setAlpha(0).setVisible(true);
      this.tweens.add({ targets: this.pauseOverlay, alpha: 1, duration: 250 });
    } else {
      this.pauseOverlay.setVisible(false).setAlpha(1);
    }
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
      this.createWallSegment(WALL_WIDTH / 2, (previousTop + nextTop) / 2, WALL_WIDTH, chunkHeight + 2),
      this.createWallSegment(width - WALL_WIDTH / 2, (previousTop + nextTop) / 2, WALL_WIDTH, chunkHeight + 2),
    );
    this.createParallaxChunk(width, previousTop, chunkHeight);

    const xPositions = [0.38, 0.62, 0.84, 0.62, 0.38];
    const rises = [0.12, 0.3, 0.48, 0.66, 0.84];
    for (let index = 0; index < rises.length; index += 1) {
      const x = width * xPositions[index]!;
      const y = previousTop - chunkHeight * rises[index]!;
      this.anchorPoints.push(this.createAnchorPoint(x, y));
    }

    this.addFly(width * 0.28, previousTop - chunkHeight * 0.36);
    this.addFly(width * 0.72, previousTop - chunkHeight * 0.82);

    const platformX = width * (this.platforms.length % 2 === 0 ? 0.32 : 0.7);
    const platformY = previousTop - chunkHeight * 0.72;
    const platformWidth = 190;
    this.platforms.push(this.createPlatform(platformX, platformY, platformWidth));

    this.generatedTop = nextTop;
  }

  private createParallaxChunk(width: number, top: number, chunkHeight: number): void {
    const stars = this.add.graphics().setScrollFactor(0.2).setDepth(-90);
    stars.fillStyle(0xe0e7ff, 0.58);
    for (let index = 0; index < 24; index += 1) {
      stars.fillCircle(
        Phaser.Math.Between(32, width - 32),
        this.parallaxY(top - Phaser.Math.FloatBetween(0, chunkHeight), 0.2),
        Phaser.Math.FloatBetween(0.7, 1.7),
      );
    }
    this.parallaxObjects.push({ object: stars, worldY: top });

    const leaves = this.add.graphics().setScrollFactor(0.46).setDepth(-80);
    leaves.lineStyle(10, 0x172b32, 0.78);
    leaves.beginPath();
    leaves.moveTo(0, this.parallaxY(top - chunkHeight * 0.3, 0.46));
    leaves.lineTo(width * 0.13, this.parallaxY(top - chunkHeight * 0.34, 0.46));
    leaves.lineTo(width * 0.22, this.parallaxY(top - chunkHeight * 0.28, 0.46));
    leaves.moveTo(width, this.parallaxY(top - chunkHeight * 0.7, 0.46));
    leaves.lineTo(width * 0.88, this.parallaxY(top - chunkHeight * 0.74, 0.46));
    leaves.lineTo(width * 0.78, this.parallaxY(top - chunkHeight * 0.68, 0.46));
    leaves.strokePath();
    leaves.fillStyle(0x29433a, 0.8);
    leaves.fillEllipse(width * 0.18, this.parallaxY(top - chunkHeight * 0.34, 0.46), 42, 15);
    leaves.fillEllipse(width * 0.84, this.parallaxY(top - chunkHeight * 0.72, 0.46), 48, 17);
    this.parallaxObjects.push({ object: leaves, worldY: top });
  }

  private removeSubmergedObjects(): void {
    this.parallaxObjects = this.parallaxObjects.filter((decoration) => {
      if (decoration.worldY < this.waterY) return true;
      decoration.object.destroy();
      return false;
    });

    this.anchorPoints = this.anchorPoints.filter((point) => {
      if (point.y < this.waterY || point === this.anchor) return true;
      point.marker.destroy();
      point.halo.destroy();
      return false;
    });

    this.platforms = this.platforms.filter((platform) => {
      if (platform.top < this.waterY) return true;
      platform.graphic.destroy();
      platform.leaf.destroy();
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
      spike.highlight.destroy();
      return false;
    });

    this.flies = this.flies.filter((fly) => {
      if (fly.y < this.waterY) return true;
      fly.graphic.destroy();
      return false;
    });

    this.butterflies = this.butterflies.filter((butterfly) => {
      if (butterfly.graphic.y < this.waterY) return true;
      butterfly.graphic.destroy();
      return false;
    });

    this.ladybugs = this.ladybugs.filter((ladybug) => {
      if (ladybug.graphic.y < this.waterY) return true;
      this.tweens.killTweensOf(ladybug.graphic);
      ladybug.graphic.destroy();
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
      const highlight = this.add.triangle(
        x,
        y + 2,
        PHASE_TWO_CONFIG.spikeWidth * 0.7,
        PHASE_TWO_CONFIG.spikeHeight * 0.65,
        PHASE_TWO_CONFIG.spikeWidth / 2,
        0,
        PHASE_TWO_CONFIG.spikeWidth * 0.3,
        PHASE_TWO_CONFIG.spikeHeight * 0.65,
        0xfda4af,
      ).setAlpha(0.7);
      graphic.setDepth(6).setScale(0.9).setAlpha(0.55);
      highlight.setDepth(7).setScale(0.9).setAlpha(0.4);
      this.tweens.add({
        targets: [graphic, highlight],
        scale: 1.08,
        alpha: 1,
        duration: 520,
        yoyo: true,
        repeat: -1,
        delay: 500,
      });
      this.tweens.add({
        targets: [graphic, highlight],
        scale: 1,
        alpha: 0.8,
        duration: 350,
      });
      this.spikes.push({ x, y: y + 10, graphic, highlight });
    }
  }

  private checkSpikeCollision(): void {
    const collidedSpikes = this.spikes.filter(
      (spike) =>
        Phaser.Math.Distance.Between(this.player.x, this.player.y, spike.x, spike.y) <=
        PHASE_TWO_CONFIG.spikeHitRadius,
    );
    if (collidedSpikes.length === 0) return;

    if (this.hasShield) {
      const collidedSet = new Set(collidedSpikes);
      this.spikes = this.spikes.filter((spike) => {
        if (!collidedSet.has(spike)) return true;
        this.tweens.killTweensOf([spike.graphic, spike.highlight]);
        spike.graphic.destroy();
        spike.highlight.destroy();
        return false;
      });
      this.hasShield = false;
      this.shieldRemaining = 0;
      this.shieldAura.setVisible(false);
      return;
    }

    this.endGame(PHASE_TWO_CONFIG.collisionMessage);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.gameOver) {
      const buttonCenterY = this.scale.height - 52;
      const clickedRestart =
        Math.abs(pointer.x - this.scale.width / 2) <= 125 &&
        Math.abs(pointer.y - buttonCenterY) <= 29;
      if (clickedRestart) this.restart();
      return;
    }
    if (!this.gameStarted) {
      if (this.menuShowingRecords) {
        const backCenterY = this.scale.height * 0.86;
        if (
          Math.abs(pointer.x - this.scale.width / 2) <= 120 &&
          Math.abs(pointer.y - backCenterY) <= 27
        ) {
          this.menuShowingRecords = false;
          this.recordsOverlay.setVisible(false);
          this.menuOverlay.setVisible(true);
        }
        return;
      }

      const centerX = this.scale.width / 2;
      const startCenterY = this.scale.height * 0.72;
      const recordsCenterY = this.scale.height * 0.84;
      if (
        Math.abs(pointer.x - centerX) <= 130 &&
        Math.abs(pointer.y - startCenterY) <= 29
      ) {
        this.startGame();
      } else if (
        Math.abs(pointer.x - centerX) <= 130 &&
        Math.abs(pointer.y - recordsCenterY) <= 26
      ) {
        this.showMenuRecords();
      }
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
        return;
      }

      this.attachTo(nearestAnchor);
      this.isReeling = true;
      return;
    }

    if (this.anchor) {
      this.releaseThread();
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
    if (this.anchor) {
      this.anchor.marker.setFillStyle(0xa5f3fc);
      this.anchor.halo.setAlpha(0.16);
    }
    this.anchor = point;
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      point.x,
      point.y,
    );
    this.ropeLength = Math.max(distance, 1);
    point.marker.setFillStyle(0xffffff);
    point.halo.setAlpha(0.38);
  }

  private releaseThread(): void {
    if (!this.anchor || this.gameOver) return;
    this.anchor.marker.setFillStyle(0xa5f3fc);
    this.anchor.halo.setAlpha(0.16);
    this.anchor = null;
    this.isReeling = false;
  }

  private stopReeling(): void {
    if (!this.anchor) return;
    this.isReeling = false;
  }

  private jumpFromPlatform(): void {
    if (!this.gameStarted || this.gameOver || this.paused) return;
    if (this.anchor) {
      this.stopReeling();
      return;
    }
    if (!this.isGrounded) return;

    this.isGrounded = false;
    this.velocityY = -PLATFORM_JUMP_SPEED;
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

  private updateWater(time: number): void {
    const { width } = this.scale;
    this.water.clear();
    this.water.fillGradientStyle(0x67e8f9, 0x67e8f9, 0x082f49, 0x082f49, 0.9);
    this.water.fillRect(0, this.waterY, width, Math.max(0, this.worldHeight - this.waterY));

    this.water.lineStyle(3, 0xa5f3fc, 0.86);
    this.water.beginPath();
    for (let x = 0; x <= width; x += 12) {
      const waveY = this.waterY + Math.sin(x * 0.035 + time * 0.003) * 5;
      if (x === 0) this.water.moveTo(x, waveY);
      else this.water.lineTo(x, waveY);
    }
    this.water.strokePath();

    const distanceToWater = this.waterY - (this.player.y + PLAYER_RADIUS);
    const glowAlpha = distanceToWater < 180
      ? 0.08 + (1 - Math.max(0, distanceToWater) / 180) * (0.12 + Math.sin(time * 0.008) * 0.06)
      : 0.04;
    this.waterGlow
      .setPosition(this.player.x, this.waterY - 10)
      .setAlpha(glowAlpha);
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

      this.tweens.add({
        targets: fly.graphic,
        scaleX: fly.graphic.scaleX * 1.8,
        scaleY: fly.graphic.scaleY * 1.8,
        alpha: 0,
        duration: 180,
        onComplete: () => fly.graphic.destroy(),
      });
      const flash = this.add.circle(fly.x, fly.y, 8, 0xfef08a, 0.85).setDepth(9);
      this.tweens.add({
        targets: flash,
        scale: 2.4,
        alpha: 0,
        duration: 220,
        onComplete: () => flash.destroy(),
      });
      const pointsText = this.add.text(fly.x, fly.y - 12, '+10', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#fef08a',
        stroke: '#172554',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(10);
      this.tweens.add({
        targets: pointsText,
        y: fly.y - 42,
        alpha: 0,
        duration: 500,
        onComplete: () => pointsText.destroy(),
      });
      this.score += 1;
      this.updateScoreText();
      return false;
    });
  }

  private endGame(message = 'Вода поймала паука!'): void {
    this.gameOver = true;
    this.cameras.main.shake(200, 0.01);
    this.paused = false;
    this.isReeling = false;
    this.hasShield = false;
    this.shieldRemaining = 0;
    this.shieldAura.setVisible(false);
    this.finalScore = this.getCurrentPoints();
    if (this.anchor) {
      this.anchor.marker.setFillStyle(0xa5f3fc);
      this.anchor.halo.setAlpha(0.16);
    }
    this.anchor = null;
    this.pauseOverlay.setVisible(false);
    this.gameOverText.setText(
      `${message}\nСъедено мух: ${this.score}    Очки: ${this.finalScore}`,
    );
    this.gameOverLeaderboardText.setText(
      this.formatLeaderboard(this.loadLeaderboard()),
    );
    this.gameOverOverlay.setAlpha(0).setVisible(true);
    this.tweens.add({ targets: this.gameOverOverlay, alpha: 1, duration: 280 });
    this.time.delayedCall(280, () => {
      if (!this.scene.isActive()) return;
      this.askForRecordName();
      this.gameOverLeaderboardText.setText(
        this.formatLeaderboard(this.loadLeaderboard()),
      );
    });
  }

  private restart(): void {
    this.scene.restart();
  }
}
