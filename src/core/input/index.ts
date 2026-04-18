// ============================================================
// Input layer — adapters + bridge (input-agnostic engine)
// ============================================================

export type { IGameController, GameCommand } from './GameController'
export { InputBridge } from './InputBridge'
export type { SendMove, SendStop, SendFire } from './InputBridge'
export { DesktopInputAdapter } from './DesktopInputAdapter'
export { MobileInputAdapter } from './MobileInputAdapter'
