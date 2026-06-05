import { SignUp } from "@clerk/nextjs"
import { Logo } from "@/components/logo"

export default function SignUpPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <Logo className="h-9" />
      <SignUp />
    </div>
  )
}
