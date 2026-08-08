import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { EmailShell, greeting, styles } from './brand'

interface MagicLinkEmailProps {
  siteName?: string
  userName?: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ userName, confirmationUrl }: MagicLinkEmailProps) => (
  <EmailShell preview="Your MathGPL login link">
    <Heading style={styles.h1}>Your MathGPL login link</Heading>
    <Text style={styles.text}>{greeting(userName)}</Text>
    <Text style={styles.text}>
      Use the button below to sign in to MathGPL. For your security this link expires shortly and
      can only be used once.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Sign In To MathGPL
    </Button>
    <Text style={styles.fallback}>
      If the button does not work, copy and paste this address into your browser:
      <br />
      {confirmationUrl}
    </Text>
    <Text style={styles.small}>
      If you did not request this link, you can safely ignore this email.
    </Text>
    <Text style={styles.text}>
      Best regards,
      <br />
      The MathGPL Team
    </Text>
  </EmailShell>
)

export default MagicLinkEmail
