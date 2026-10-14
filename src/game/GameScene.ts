import Phaser from 'phaser';

const WALL_WIDTH = 24;
const PLAYER_RADIUS = 14;
const FLY_RADIUS = 10;
const GRAVITY = 820;
const SWING_GRAVITY_MULTIPLIER = 1.4;
const WATER_RISE_SPEED = 18;
const TOP_LIMIT = 92;
const MAX_ATTACH_DISTANCE = 460;
const REEL_SPEED = 150;
const MIN_ROPE_LENGTH = 72;
const ANCHOR_SELECT_RADIUS = 42;
const PLATFORM_JUMP_SPEED = 390;
const PLATFORM_MOVE_SPEED = 220;
const WORLD_HEIGHT_MULTIPLIER = 4;

type AnchorPoint = {
  x: number;
  y: number;
  marker: Phaser.GameObjects.Arc;
};

type Platform = {
  left: number;
  right: number;
  top: number;
};

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Arc;
  private fly!: Phaser.GameObjects.Arc;
  private rope!: Phaser.GameObjects.Graphics;
  private water!: Phaser.GameObjects.Rectangle;
  private scoreText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'left' | 'right', Phaser.Input.Keyboard.Key>;
  private anchorPoints: AnchorPoint[] = [];
  private platforms: Platform[] = [];
  private anchor: AnchorPoint | null = null;
  private ropeLength = 0;
  private isReeling = false;
  private isGrounded = false;
  private velocityX = 0;
  private velocityY = 0;
  private waterY = 0;
  private worldHeight = 0;
  private score = 0;
  private gameOver = false;

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
    this.waterY = worldHeight;
    this.gameOver = false;

    this.add.rectangle(WALL_WIDTH / 2, worldHeight / 2, WALL_WIDTH, worldHeight, 0x475569);
    this.add.rectangle(
      width - WALL_WIDTH / 2,
      worldHeight / 2,
      WALL_WIDTH,
      worldHeight,
      0x475569,
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
      .text(width / 2, 54, 'Зажми точку — подтянись. Клик в пустом месте — отпусти. На платформе: ←/→ или A/D, ПРОБЕЛ.', {
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

    this.createPlatforms(width, height, startingY);
    this.createAnchorPoints(width, height, startingY);

    this.water = this.add.rectangle(width / 2, worldHeight, width, 0, 0x0ea5e9, 0.8);
    this.rope = this.add.graphics();
    this.player = this.add.circle(width * 0.3, startingY, PLAYER_RADIUS, 0xf8fafc);
    this.fly = this.add.circle(width * 0.72, startingY - height * 0.25, FLY_RADIUS, 0xfacc15);

    const startingAnchor = this.anchorPoints[0];
    if (!startingAnchor) {
      throw new Error('At least one spider anchor point is required.');
    }
    this.attachTo(startingAnchor);

    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointerup', this.stopReeling, this);
    this.cameras.main.setBounds(0, 0, width, worldHeight);
    this.cameras.main.scrollY = startingY - height * 0.68;

    if (!this.input.keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }
    this.input.keyboard.on('keydown-R', this.restart, this);
    this.input.keyboard.on('keydown-SPACE', this.jumpFromPlatform, this);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<'left' | 'right', Phaser.Input.Keyboard.Key>;
  }

  update(_time: number, delta: number): void {
    if (this.gameOver) return;

    const seconds = Math.min(delta / 1000, 0.05);
    this.waterY = Math.max(TOP_LIMIT, this.waterY - WATER_RISE_SPEED * seconds);
    this.updateWater();
    this.updateSpider(seconds);
    this.updateCamera(seconds);
    this.checkFly();

    if (this.player.y + PLAYER_RADIUS >= this.waterY) {
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

  private createPlatforms(width: number, height: number, startingY: number): void {
    const platformSpecs = [
      { x: width * 0.32, y: startingY - height * 0.75, width: 190 },
      { x: width * 0.72, y: startingY - height * 1.8, width: 210 },
      { x: width * 0.36, y: startingY - height * 2.75, width: 190 },
    ];

    this.platforms = platformSpecs.map((platform) => {
      this.add.rectangle(platform.x, platform.y, platform.width, 18, 0x94a3b8);
      return {
        left: platform.x - platform.width / 2,
        right: platform.x + platform.width / 2,
        top: platform.y - 9,
      };
    });
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.gameOver) {
      this.restart();
      return;
    }

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
      this.statusText.setText('Паутина подтягивает! Отпусти кнопку, чтобы раскачаться.');
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
    this.isReeling = false;
  }

  private jumpFromPlatform(): void {
    if (this.gameOver || !this.isGrounded || this.anchor) return;
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
    } else {
      this.keepSpiderInBounds(width);
      this.landOnPlatform(previousY);
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

    if (this.player.y < TOP_LIMIT + PLAYER_RADIUS) {
      this.player.y = TOP_LIMIT + PLAYER_RADIUS;
      this.velocityY = Math.abs(this.velocityY) * 0.65;
    }
  }

  private updateCamera(seconds: number): void {
    const camera = this.cameras.main;
    const targetY = Phaser.Math.Clamp(
      this.player.y - this.scale.height * 0.68,
      0,
      this.worldHeight - this.scale.height,
    );
    camera.scrollY += (targetY - camera.scrollY) * Math.min(1, seconds * 5);
  }

  private landOnPlatform(previousY: number): void {
    if (this.velocityY < 0) return;

    const previousBottom = previousY + PLAYER_RADIUS;
    const currentBottom = this.player.y + PLAYER_RADIUS;
    const platform = this.platforms.find(
      (item) =>
        this.player.x >= item.left - PLAYER_RADIUS &&
        this.player.x <= item.right + PLAYER_RADIUS &&
        previousBottom <= item.top &&
        currentBottom >= item.top,
    );
    if (!platform) return;

    this.player.y = platform.top - PLAYER_RADIUS;
    this.velocityY = 0;
    this.velocityX *= 0.8;
    this.isGrounded = true;
  }

  private updateWater(): void {
    const { width } = this.scale;
    this.water.setSize(width, this.worldHeight - this.waterY);
    this.water.setPosition(width / 2, (this.worldHeight + this.waterY) / 2);
  }

  private checkFly(): void {
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.fly.x,
      this.fly.y,
    );
    if (distance > PLAYER_RADIUS + FLY_RADIUS) return;

    this.score += 1;
    this.scoreText.setText(`Мухи: ${this.score}`);
    this.fly.setPosition(
      Phaser.Math.Between(WALL_WIDTH + 50, this.scale.width - WALL_WIDTH - 50),
      Phaser.Math.Between(
        Math.max(TOP_LIMIT + 30, this.player.y - this.scale.height * 0.7),
        Math.min(
          this.worldHeight - this.scale.height * 0.15,
          this.player.y + this.scale.height * 0.35,
        ),
      ),
    );
  }

  private endGame(): void {
    this.gameOver = true;
    this.isReeling = false;
    if (this.anchor) this.anchor.marker.setFillStyle(0x38bdf8);
    this.anchor = null;
    this.statusText
      .setText(`Вода поймала паука! Съедено мух: ${this.score}\nНажми R или кликни, чтобы начать заново.`)
      .setColor('#ffffff')
      .setFontSize(24)
      .setAlign('center')
      .setOrigin(0.5)
      .setPosition(this.scale.width / 2, this.scale.height / 2)
      .setScrollFactor(0);
  }

  private restart(): void {
    this.scene.restart();
  }
}
