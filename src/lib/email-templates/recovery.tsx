import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { EmailShell, FallbackLink, greeting, styles } from './brand'

interface RecoveryEmailProps {
  siteName?: string
  userName?: string
  mathgplId?: string | null
  confirmationUrl: string
}

const idBox: React.CSSProperties = {
  margin: '18px 0',
  padding: '16px 18px',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  backgroundColor: '#f8fafc',
}

const idLabel: React.CSSProperties = {
  margin: 0,
  fontSize: '11px',
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: '#64748b',
}

const idValue: React.CSSProperties = {
  margin: '6px 0 0',
  fontFamily: 'Menlo, Consolas, monospace',
  fontSize: '22px',
  fontWeight: 700,
  letterSpacing: '2px',
  color: '#0f172a',
}

export const RecoveryEmail = ({ userName, mathgplId, confirmationUrl }: RecoveryEmailProps) => (
  <EmailShell preview="Your MathGPL ID and a link to reset your password">
    <Heading style={styles.h1}>Reset your MathGPL password</Heading>
    <Text style={styles.text}>{greeting(userName)}</Text>
    <Text style={styles.text}>
      We received a request to recover access to your MathGPL account.
    </Text>
    {mathgplId ? (
      <div style={idBox}>
        <Text style={idLabel}>Your MathGPL ID</Text>
        <Text style={idValue}>{mathgplId}</Text>
        <Text style={styles.small}>Use this ID with your password to log in.</Text>
      </div>
    ) : null}
    <Text style={styles.text}>
      If you made this request, use the button below to create a new password.
    </Text>

    <Button style={styles.button} href={confirmationUrl}>
      Reset My Password
    </Button>
    <FallbackLink url={confirmationUrl} />
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
