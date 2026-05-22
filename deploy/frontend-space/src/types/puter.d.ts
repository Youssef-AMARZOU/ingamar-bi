interface PuterAI {
  chat: (prompt: string, options?: { model?: string; stream?: boolean }) => Promise<string>
}

interface PuterAuth {
  signIn: () => Promise<any>
  isSignedIn: () => boolean
  getUser: () => any
}

interface Puter {
  ai: PuterAI
  auth: PuterAuth
  print: (text: string) => void
}

interface Window {
  puter?: Puter
}
