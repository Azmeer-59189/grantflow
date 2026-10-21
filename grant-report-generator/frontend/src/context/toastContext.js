import { createContext, useContext } from 'react'

export const ToastContext = createContext({ show: () => {} })
export function useToast() { return useContext(ToastContext) }
