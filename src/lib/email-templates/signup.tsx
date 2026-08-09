import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { EmailShell, FallbackLink, greeting, styles } from './brand'

interface SignupEmailProps {
  siteName?: string
  siteUrl?: string
  recipient?: string
  userName?: string
  confirmationUrl: string
}

export const SignupEmail = ({ userName, confirmationUrl }: SignupEmailProps) => (
  <EmailShell preview="Confirm your MathGPL account to get started">
    <Heading style={styles.h1}>Welcome to MathGPL — confirm your account</Heading>
    <Text style={styles.text}>{greeting(userName)}</Text>
    <Text style={styles.text}>
      Welcome to MathGPL! Your account has been successfully created.
    </Text>
    <Text style={styles.text}>
      To activate and secure your account, please confirm your email address using the button
      below.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Confirm My Email
    </Button>
    <FallbackLink url={confirmationUrl} />
    <Text style={styles.small}>
      If you did not create this account, you can safely ignore this email.
    </Text>
    <Text style={styles.small}>
      For your security, do not share this verification link with anyone. It expires after a
      short time.
    </Text>
    <Text style={styles.text}>
      We look forward to helping you learn, teach and grow with MathGPL.
      <br />
      <br />
      Best regards,
      <br />
      The MathGPL Team
    </Text>
  </EmailShell>
)

export default SignupEmail
