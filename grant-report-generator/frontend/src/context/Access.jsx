import { createContext, useContext } from 'react'

export const AccessContext = createContext({ session: null, role: 'viewer', loading: true })
export function useAccess() { return useContext(AccessContext) }
