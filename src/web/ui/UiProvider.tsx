import {
  createContext,
  useContext,
  type ComponentType,
  type ReactNode,
} from "react"
import type { BadgeProps } from "./Badge"
import type { ButtonProps } from "./Button"
import type { CardProps } from "./Card"
import type { DataTableProps } from "./DataTable"
import type { DescriptionListProps } from "./DescriptionList"
import type { DialogProps } from "./Dialog"
import type { FieldProps } from "./Field"
import type { FigureProps } from "./Figure"
import type { HeaderProps } from "./Header"
import type { LinkProps } from "./Link"
import type { NoticeProps } from "./Notice"
import type { SelectProps } from "./Select"
import type { SkeletonProps } from "./Skeleton"

export type Slots = {
  Button: ComponentType<ButtonProps>
  Dialog: ComponentType<DialogProps>
  Card: ComponentType<CardProps>
  Badge: ComponentType<BadgeProps>
  Field: ComponentType<FieldProps>
  Select: ComponentType<SelectProps>
  DataTable: ComponentType<DataTableProps<never>>
  Link: ComponentType<LinkProps>
  Notice: ComponentType<NoticeProps>
  Skeleton: ComponentType<SkeletonProps>
  DescriptionList: ComponentType<DescriptionListProps>
  Header: ComponentType<HeaderProps>
  Figure: ComponentType<FigureProps>
}

const SlotContext = createContext<Partial<Slots>>({})

export function UiProvider(props: {
  overrides?: Partial<Slots>
  children: ReactNode
}) {
  return (
    <SlotContext.Provider value={props.overrides ?? {}}>
      {props.children}
    </SlotContext.Provider>
  )
}

// 差し替えが指定されていればそれを、なければ基底の実装を返す
export function useSlot<K extends keyof Slots>(
  name: K,
  fallback: Slots[K],
): Slots[K] {
  return (useContext(SlotContext)[name] as Slots[K] | undefined) ?? fallback
}
