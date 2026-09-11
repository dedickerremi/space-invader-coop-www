import type { Difficulty } from './types'

// What the lobby offers. The server owns the actual modifiers
// (space-invader-coop-api internal/game/difficulty.go); these blurbs only
// describe them.
export const DIFFICULTIES: { id: Difficulty; label: string; blurb: string }[] = [
  { id: 'easy', label: 'Easy', blurb: 'The campaign as designed' },
  { id: 'medium', label: 'Medium', blurb: 'More fire, formations break sooner' },
  { id: 'hard', label: 'Hard', blurb: 'Faster everything, one life less' },
]

export function isDifficulty(value: unknown): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard'
}

/** Lives a player starts with, for the HUD's empty hearts. */
export function startingLives(difficulty?: Difficulty): number {
  return difficulty === 'hard' ? 2 : 3
}

export function difficultyLabel(difficulty?: Difficulty): string {
  return DIFFICULTIES.find((d) => d.id === difficulty)?.label ?? ''
}

const STORAGE_KEY = 'difficulty'

/** The difficulty the player picked last time, so the lobby preselects it. */
export function loadDifficulty(): Difficulty {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return isDifficulty(saved) ? saved : 'easy'
  } catch {
    return 'easy'
  }
}

export function saveDifficulty(difficulty: Difficulty): void {
  try {
    localStorage.setItem(STORAGE_KEY, difficulty)
  } catch {
    // Private mode or storage disabled: the choice just isn't remembered.
  }
}
