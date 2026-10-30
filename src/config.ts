// 'family' = private deployment (join by invite only). The default,
//            so a build that forgets the variable never opens self-serve sign-up.
// 'public'  = anyone can sign up and create their own family (`--mode public`).
export type AppMode = 'family' | 'public'

export const APP_MODE: AppMode = import.meta.env.VITE_APP_MODE === 'public' ? 'public' : 'family'
