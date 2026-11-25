import Phaser from 'phaser';
import { GameScene } from './GameScene';

export function createGame(parent: string): Phaser.Game {
  const isTouchLayout = window.matchMedia('(pointer: coarse)').matches;
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 640,
    backgroundColor: '#0f172a',
    scene: [GameScene],
    input: {
      activePointers: isTouchLayout ? 2 : 1,
    },
    scale: {
      mode: isTouchLayout ? Phaser.Scale.RESIZE : Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };

  return new Phaser.Game(config);
}
