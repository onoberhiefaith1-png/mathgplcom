import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { EmailShell, greeting, styles } from './brand'

interface RecoveryEmailProps {
  siteName?: string
  userName?: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ userName, confirmationUrl }: RecoveryEmailProps) => (
  <EmailShell preview="Reset your MathGPL password">
    <Heading style={styles.h1}>Reset your MathGPL password</Heading>
    <Text style={styles.text}>{greeting(userName)}</Text>
    <Text style={styles.text}>
      We received a request to reset the password for your MathGPL account.
    </Text>
    <Text style={styles.text}>
      If you made this request, use the button below to create a new password.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Reset My Password
    </Button>
    <Text style={styles.fallback}>
      If the button does not work, copy and paste this address into your browser:
      <br />
      {confirmationUrl}
    </Text>
    <Text style={styles.small}>
      For your security, this link expires shortly and can only be used for this password-reset
      request. We never include your password in an email.
    </Text>
    <Text style={styles.small}>
      If you did not request a password reset, you can safely ignore this email — your password
      will remain unchanged. If these emails keep arriving unexpectedly, please contact MathGPL
      Support.
    </Text>
    <Text style={styles.text}>
      Best regards,
      <br />
      The MathGPL Team
    </Text>
  </EmailShell>
)

export default RecoveryEmail
