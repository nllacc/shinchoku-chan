import { createContext, useContext, type ComponentType, type ReactNode } from "react"
import type { BadgeProps } from "./Badge"
import type { ButtonProps } from "./Button"
import type { CardProps } from "./Card"
import type { DialogProps } from "./Dialog"

export type Slots = {
  Button: ComponentType<ButtonProps>
  Dialog: ComponentType<DialogProps>
  Card: ComponentType<CardProps>
  Badge: ComponentType<BadgeProps>
}

const SlotContext = createContext<Partial<Slots>>({})

export function UiProvider(props: { overrides?: Partial<Slots>; children: ReactNode }) {
  return <SlotContext.Provider value={props.overrides ?? {}}>{props.children}</SlotContext.Provider>
}

// 差し替えが指定されていればそれを、なければ基底の実装を返す
export function useSlot<K extends keyof Slots>(name: K, fallback: Slots[K]): Slots[K] {
  return (useContext(SlotContext)[name] as Slots[K] | undefined) ?? fallback
}
